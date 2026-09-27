"""Staff lifecycle: hire, edit, deactivate (resigned), reactivate, overrides, moderation."""
from dataclasses import dataclass, field
from typing import Callable, ContextManager

from app.extensions import transaction
from app.forms.staff_forms import StaffInput
from app.models.auth.permission import Permission
from app.models.auth.role import Role
from app.models.auth.user import User
from app.models.staff.shift import Shift
from app.repositories.auth.permission_repository import PermissionRepository
from app.repositories.auth.role_repository import RoleRepository
from app.repositories.auth.user_repository import UserRepository
from app.repositories.staff.attendance_repository import AttendanceRepository
from app.repositories.staff.audit_repository import AuditRepository
from app.repositories.staff.shift_repository import ShiftRepository
from app.services.errors import NotFoundError
from app.services.notifications.telegram_service import TelegramService
from app.utils.security import PasswordHasher


@dataclass
class StaffDirectory:
    users: list[User]
    roles: list[Role]
    shifts: list[Shift]
    counts: dict
    status: str
    term: str
    role_id: int | None


@dataclass
class StaffFormPage:
    user: User | None
    roles: list[Role]
    shifts: list[Shift]
    permissions: list[Permission] = field(default_factory=list)
    role_permissions: set[str] = field(default_factory=set)
    overrides: set[str] = field(default_factory=set)


class StaffService:
    """
    Accounts are never hard-deleted once they have history: deactivation
    blocks login but keeps every sale, refund and shift linked to the person.
    """

    def __init__(self, user_repo: UserRepository | None = None,
                 role_repo: RoleRepository | None = None,
                 hasher: PasswordHasher | None = None,
                 tx: Callable[[], ContextManager] = transaction,
                 permission_repo: PermissionRepository | None = None,
                 shift_repo: ShiftRepository | None = None,
                 attendance_repo: AttendanceRepository | None = None,
                 audit_repo: AuditRepository | None = None,
                 telegram: TelegramService | None = None) -> None:
        self.user_repo = user_repo or UserRepository()
        self.role_repo = role_repo or RoleRepository()
        self.hasher = hasher or PasswordHasher()
        self.tx = tx
        self.permission_repo = permission_repo or PermissionRepository()
        self.shift_repo = shift_repo or ShiftRepository()
        self.attendance_repo = attendance_repo or AttendanceRepository()
        self.audit_repo = audit_repo or AuditRepository()
        self.telegram = telegram or TelegramService()

    # ---------------- read ----------------
    def directory(self, term: str = "", role_id: int | None = None, status: str = "active") -> StaffDirectory:
        active = {"active": True, "resigned": False}.get(status)
        return StaffDirectory(
            users=self.user_repo.search(term, role_id, active), roles=self.role_repo.list_all(),
            shifts=self.shift_repo.list_all(), counts=self.user_repo.status_counts(),
            status=status if active is not None else "all", term=term, role_id=role_id)

    def form_page(self, user_id: int | None = None) -> StaffFormPage:
        user = self._get(user_id) if user_id is not None else None
        page = StaffFormPage(user=user, roles=self.role_repo.list_all(), shifts=self.shift_repo.list_all(),
                             permissions=self.permission_repo.list_all())
        if user:
            page.role_permissions = self.role_repo.permission_names_for_role(user.role_id)
            page.overrides = self.permission_repo.names_for_user(user.id)
        return page

    # ---------------- lifecycle ----------------
    def create_staff(self, data: StaffInput, acting_user: User | None = None) -> User:
        self._validate(data)
        role = self._role_assignable(data.role_id, acting_user)
        if self.user_repo.find_by_email(data.email):
            raise ValueError("A staff member with this email already exists.")
        user = User(id=0, name=data.name, email=data.email, phone=data.phone or None,
                    role_id=role.id, role_name=role.name, role_display_name=role.display_name,
                    password_hash=self.hasher.hash(data.password), active=True, shift_id=data.shift_id)
        user.id = self.user_repo.create(user)
        self._audit(acting_user, "staff.create", f"{user.name} <{user.email}> as {role.display_name}")
        self.telegram.notify_staff_added(user.name, role.display_name, acting_user.name if acting_user else "Unknown")
        return user

    def update_staff(self, user_id: int, data: StaffInput, acting_user: User) -> User:
        self._validate(data, require_password=False)
        user = self._get(user_id)
        self._check_can_manage(user, acting_user)
        other = self.user_repo.find_by_email(data.email)
        if other and other.id != user_id:
            raise ValueError("Another staff member already uses this email.")
        new_role = self._role_assignable(data.role_id, acting_user)
        if user.id == acting_user.id and new_role.id != user.role_id:
            raise ValueError("You cannot change your own role.")
        if user.is_super_admin and user.is_active and not new_role.is_super_admin \
                and self.user_repo.count_active_in_role("super_admin") <= 1:
            raise ValueError("At least one active Super Admin account must remain.")
        changed_role = new_role.id != user.role_id
        user.name, user.email, user.phone = data.name, data.email, data.phone or None
        user.role_id, user.shift_id = new_role.id, data.shift_id
        self.user_repo.update(user)
        if changed_role:
            self._audit(acting_user, "staff.role", f"{user.name} → {new_role.display_name}")
        return user

    def deactivate(self, user_id: int, acting_user: User, reason: str = "") -> User:
        """Mark a resigned employee inactive: login is blocked, history is preserved."""
        user = self._get(user_id)
        self._check_can_manage(user, acting_user)
        if user.id == acting_user.id:
            raise ValueError("You cannot deactivate your own account.")
        if not user.is_active:
            raise ValueError(f"{user.name} is already deactivated.")
        if user.is_super_admin and self.user_repo.count_active_in_role("super_admin") <= 1:
            raise ValueError("At least one active Super Admin account must remain.")
        if self.attendance_repo.find_open_for(user.id):
            raise ValueError(f"{user.name} still has an open shift. Close the drawer first (Cash Drawers page).")
        reason = (reason or "Resigned").strip()[:255]
        with self.tx():
            self.user_repo.set_active(user.id, False, reason)
            self._audit(acting_user, "staff.deactivate", f"{user.name}: {reason}")
        user.active, user.deactivation_reason = False, reason
        return user

    def reactivate(self, user_id: int, acting_user: User, new_password: str = "",
                   role_id: int | None = None) -> User:
        """Restore a former employee, optionally with a fresh password and a new role."""
        user = self._get(user_id)
        if user.is_active:
            raise ValueError(f"{user.name} is already active.")
        with self.tx():
            if role_id and role_id != user.role_id:
                role = self._role_assignable(role_id, acting_user)
                user.role_id = role.id
                self.user_repo.update(user)
            if new_password:
                self.user_repo.update_password(user.id, self.hasher.hash(new_password))
            self.user_repo.set_active(user.id, True)
            self._audit(acting_user, "staff.reactivate", user.name)
        user.active = True
        return user

    def delete_staff(self, user_id: int, acting_user: User) -> User:
        """Hard delete — only allowed for accounts that never sold, refunded or worked a shift."""
        user = self._get(user_id)
        self._check_can_manage(user, acting_user)
        if user.id == acting_user.id:
            raise ValueError("You cannot delete your own account.")
        if self.user_repo.has_history(user.id):
            raise ValueError(f"{user.name} has sales or shift history. Deactivate the account instead "
                             "so the audit trail stays intact.")
        if user.is_super_admin and self.user_repo.count_active_in_role("super_admin") <= 1:
            raise ValueError("At least one active Super Admin account must remain.")
        with self.tx():
            self.user_repo.delete(user.id)
            self._audit(acting_user, "staff.delete", f"{user.name} <{user.email}>")
        return user

    def reset_password(self, user_id: int, new_password: str, acting_user: User | None = None) -> User:
        user = self._get(user_id)
        if acting_user is not None:
            self._check_can_manage(user, acting_user)
        self.user_repo.update_password(user.id, self.hasher.hash(new_password))
        self._audit(acting_user, "staff.password_reset", user.name)
        self.telegram.notify_password_reset(user.name, acting_user.name if acting_user else "Self-service")
        return user

    def remove_avatar(self, user_id: int, acting_user: User) -> User:
        """Profile moderation: remove an inappropriate profile picture."""
        user = self._get(user_id)
        self._check_can_manage(user, acting_user)
        self.user_repo.clear_avatar(user.id)
        self._audit(acting_user, "staff.avatar_removed", user.name)
        user.avatar_filename = None
        return user

    def set_overrides(self, user_id: int, permission_ids: list[int], acting_user: User) -> set[str]:
        """Grant individual permissions on top of the person's role."""
        user = self._get(user_id)
        self._check_can_manage(user, acting_user)
        if user.id == acting_user.id:
            raise ValueError("You cannot grant extra permissions to yourself.")
        known = {p.id: p.name for p in self.permission_repo.list_all()}
        chosen = sorted({pid for pid in permission_ids if pid in known})
        with self.tx():
            self.permission_repo.replace_user_permissions(user.id, chosen, acting_user.id)
            self._audit(acting_user, "staff.overrides",
                        f"{user.name}: {', '.join(known[p] for p in chosen) or 'none'}")
        return {known[p] for p in chosen}

    # ---------------- helpers ----------------
    def _get(self, user_id: int) -> User:
        user = self.user_repo.find_by_id(user_id)
        if user is None:
            raise NotFoundError("Staff member not found.")
        return user

    def _role_assignable(self, role_id: int, acting_user: User | None) -> Role:
        role = self.role_repo.find_by_id(role_id)
        if role is None:
            raise ValueError("Selected role does not exist.")
        if role.is_super_admin and acting_user is not None and not acting_user.is_super_admin:
            raise ValueError("Only a Super Admin can grant the Super Admin role.")
        return role

    @staticmethod
    def _check_can_manage(target: User, acting_user: User) -> None:
        if target.is_super_admin and not acting_user.is_super_admin:
            raise ValueError("Only a Super Admin can change a Super Admin account.")

    def _validate(self, data: StaffInput, require_password: bool = True) -> None:
        if "@" not in data.email or "." not in data.email.split("@")[-1]:
            raise ValueError("Please enter a valid email address.")
        if len(data.name) > 100:
            raise ValueError("Name must be 100 characters or fewer.")
        if self.role_repo.find_by_id(data.role_id) is None:
            raise ValueError("Selected role does not exist.")
        if data.shift_id and self.shift_repo.find_by_id(data.shift_id) is None:
            raise ValueError("Selected shift does not exist.")
        if require_password:
            self.hasher.check_strength(data.password)

    def _audit(self, acting_user: User | None, action: str, details: str) -> None:
        self.audit_repo.record(acting_user.id if acting_user else None, action, details)
