"""Authentication and RBAC decisions."""
from flask import g, has_app_context

from app.models.auth.user import User
from app.repositories.auth.permission_repository import PermissionRepository
from app.repositories.auth.role_repository import RoleRepository
from app.repositories.auth.user_repository import UserRepository
from app.utils.security import PasswordHasher


class AuthService:
    """
    Logs users in and resolves capabilities as
    user -> role -> permissions, plus any individual overrides granted to that user.
    """

    def __init__(self, user_repo: UserRepository | None = None,
                 role_repo: RoleRepository | None = None,
                 hasher: PasswordHasher | None = None,
                 permission_repo: PermissionRepository | None = None) -> None:
        self.user_repo = user_repo or UserRepository()
        self.role_repo = role_repo or RoleRepository()
        self.hasher = hasher or PasswordHasher()
        self.permission_repo = permission_repo or PermissionRepository()

    def load_user(self, user_id: str) -> User | None:
        """Used by Flask-Login on every request; inactive (resigned) users are rejected."""
        if not str(user_id).isdigit():
            return None
        user = self.user_repo.find_by_id(int(user_id))
        return user if user and user.is_active else None

    def authenticate(self, email: str, password: str) -> User:
        """Return the user for valid credentials, else raise ValueError.

        The same message is used for "no such email" and "wrong password"
        so the login form cannot be used to discover valid accounts.
        """
        user = self.user_repo.find_by_email(email.strip().lower())
        if user is None or not self.hasher.verify(user.password_hash, password):
            raise ValueError("Invalid email or password.")
        if not user.is_active:
            raise ValueError("This account has been deactivated. Please contact an administrator.")
        return user

    def verify_password(self, user: User, password: str) -> bool:
        """Re-check the signed-in user's password (used to unlock the terminal)."""
        fresh = self.user_repo.find_by_id(user.id)
        return bool(fresh and fresh.is_active and self.hasher.verify(fresh.password_hash, password))

    def permissions_for(self, user: User) -> set[str]:
        """Role permissions ∪ individual overrides (cached once per request)."""
        if not getattr(user, "is_authenticated", False):
            return set()
        cache_key = f"_perms_user_{user.id}"
        if has_app_context() and cache_key in g:
            return g.get(cache_key)
        perms = set(self.role_repo.permission_names_for_role(user.role_id))
        perms |= self.permission_repo.names_for_user(user.id)
        if has_app_context():
            setattr(g, cache_key, perms)
        return perms

    def has_permission(self, user: User, permission_name: str) -> bool:
        return permission_name in self.permissions_for(user)

    def switchable_users(self, current: User) -> list[User]:
        """Active colleagues who can take over this terminal (fast user switching)."""
        return [u for u in self.user_repo.list_active() if u.id != current.id]
