"""Role / permission matrix management."""
from itertools import groupby
from typing import Callable, ContextManager

from app.extensions import transaction
from app.models.auth.role import Role
from app.models.auth.user import User
from app.repositories.auth.permission_repository import PermissionRepository
from app.repositories.auth.role_repository import RoleRepository
from app.repositories.staff.audit_repository import AuditRepository
from app.services.errors import NotFoundError
from app.services.notifications.telegram_service import TelegramService


class RoleService:
    # The Super Admin role can never lose these, otherwise nobody could fix RBAC again.
    PROTECTED_PERMISSIONS = {"manage_roles", "manage_users"}

    def __init__(self, role_repo: RoleRepository | None = None,
                 permission_repo: PermissionRepository | None = None,
                 tx: Callable[[], ContextManager] = transaction,
                 audit_repo: AuditRepository | None = None,
                 telegram: TelegramService | None = None) -> None:
        self.role_repo = role_repo or RoleRepository()
        self.permission_repo = permission_repo or PermissionRepository()
        self.tx = tx
        self.audit_repo = audit_repo or AuditRepository()
        self.telegram = telegram or TelegramService()

    def matrix_page(self) -> dict:
        permissions = self.permission_repo.list_all()
        groups = [(name, list(items)) for name, items in groupby(permissions, key=lambda p: p.group_name)]
        return {"roles": self.role_repo.list_all(), "permissions": permissions, "groups": groups}

    def list_roles(self) -> list[Role]:
        return self.role_repo.list_all()

    def get_role(self, role_id: int) -> Role:
        role = self.role_repo.find_by_id(role_id)
        if role is None:
            raise NotFoundError("Role not found.")
        return role

    def create_role(self, name: str, description: str, acting_user: User | None = None) -> Role:
        """A new, empty role a Super Admin/Admin can then grant permissions to."""
        slug = "_".join(name.strip().lower().split())
        slug = "".join(ch for ch in slug if ch.isalnum() or ch == "_").strip("_") or "role"
        if not name.strip():
            raise ValueError("Role name is required.")
        if self.role_repo.find_by_name(slug):
            raise ValueError(f"A role named '{slug}' already exists.")
        role = Role(id=None, name=slug, display_name=name.strip()[:60], description=description.strip()[:255])
        role.id = self.role_repo.create(role)
        if acting_user is not None:
            self.audit_repo.record(acting_user.id, "role.create", role.display_name)
        self.telegram.notify_role_created(role.display_name, acting_user.name if acting_user else "Unknown")
        return role

    def delete_role(self, role_id: int, acting_user: User | None = None) -> Role:
        role = self.get_role(role_id)
        if role.is_system:
            raise ValueError(f"'{role.display_name}' is a built-in role and cannot be deleted.")
        if role.user_count:
            raise ValueError(f"'{role.display_name}' still has {role.user_count} staff member(s) assigned. "
                             "Move them to another role first.")
        with self.tx():
            self.role_repo.delete(role_id)
            if acting_user is not None:
                self.audit_repo.record(acting_user.id, "role.delete", role.display_name)
        return role

    def role_permissions_page(self, role_id: int) -> dict:
        """Data for the single-role 'Configure' editor (one role at a time)."""
        role = self.get_role(role_id)
        permissions = self.permission_repo.list_all()
        groups = [(name, list(items)) for name, items in groupby(permissions, key=lambda p: p.group_name)]
        return {"role": role, "permissions": permissions, "groups": groups}

    def update_role_permissions(self, role_id: int, permission_ids: list[int],
                                acting_user: User | None = None) -> Role:
        """Save just one role's permission set (used by the per-role Configure page)."""
        role = self.get_role(role_id)
        known = {p.id: p.name for p in self.permission_repo.list_all()}
        chosen = sorted({pid for pid in permission_ids if pid in known})
        if role.is_super_admin:
            names = {known[pid] for pid in chosen}
            missing = self.PROTECTED_PERMISSIONS - names
            if missing:
                raise ValueError("The Super Admin role must keep: " + ", ".join(sorted(missing)) + ".")
            if acting_user is not None and not acting_user.is_super_admin:
                raise ValueError("Only a Super Admin can change the Super Admin role.")
        with self.tx():
            self.role_repo.replace_permissions(role_id, chosen)
            if acting_user is not None:
                self.audit_repo.record(acting_user.id, "role.permissions", role.display_name)
        return role

    def update_matrix(self, matrix: dict[int, list[int]], acting_user: User | None = None) -> list[Role]:
        """Replace every role's permission set in one transaction."""
        roles = self.role_repo.list_all()
        permissions = {p.id: p.name for p in self.permission_repo.list_all()}
        for role in roles:
            chosen = {permissions[pid] for pid in matrix.get(role.id, []) if pid in permissions}
            if role.is_super_admin:
                missing = self.PROTECTED_PERMISSIONS - chosen
                if missing:
                    raise ValueError("The Super Admin role must keep: " + ", ".join(sorted(missing)) + ".")
                if acting_user is not None and not acting_user.is_super_admin and chosen != role.permission_names:
                    raise ValueError("Only a Super Admin can change the Super Admin role.")
        with self.tx():
            for role in roles:
                chosen = [pid for pid in matrix.get(role.id, []) if pid in permissions]
                self.role_repo.replace_permissions(role.id, sorted(set(chosen)))
            if acting_user is not None:
                self.audit_repo.record(acting_user.id, "rbac.matrix", "Role permission matrix saved")
        return roles
