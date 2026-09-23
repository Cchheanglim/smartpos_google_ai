"""
Authentication and Authorization Service
Orchestrates login verification, password hashing, and role-based access checks.
"""

from typing import Optional, Tuple
from ..models.user import User
from ..repositories.user_repository import UserRepository
from ..repositories.role_repository import RoleRepository
from ..extensions import PasswordHasher


class AuthService:
    """Service handling credential verification, security policies, and RBAC."""

    def __init__(self, user_repo: Optional[UserRepository] = None, role_repo: Optional[RoleRepository] = None):
        self.user_repo = user_repo or UserRepository()
        self.role_repo = role_repo or RoleRepository()

    def authenticate(self, email: str, password: str) -> Tuple[Optional[User], Optional[str]]:
        """
        Validates email and plaintext password.
        Returns (User, None) on success, or (None, error_message) on failure.
        """
        if not email or not password:
            return None, "Please provide both email and password."

        user = self.user_repo.get_by_email(email)
        if not user:
            return None, "Invalid email address or password."

        if not user.is_active:
            return None, "This employee account has been deactivated. Please contact an administrator."

        if not user.verify_password(password):
            return None, "Invalid email address or password."

        return user, None

    def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Loads user by ID with resolved role permissions."""
        return self.user_repo.get_by_id(user_id)

    def change_password(self, user_id: int, current_password: str, new_password: str) -> Tuple[bool, str]:
        """Allows staff to change their own password upon confirming current password."""
        user = self.user_repo.get_by_id(user_id)
        if not user:
            return False, "User not found."

        if not user.verify_password(current_password):
            return False, "Current password does not match."

        if len(new_password) < 6:
            return False, "New password must be at least 6 characters long."

        user.set_password(new_password)
        self.user_repo.update(user)
        return True, "Password updated successfully."

    def reset_password_by_admin(self, target_user_id: int, new_password: str) -> Tuple[bool, str]:
        """Administrative password reset."""
        user = self.user_repo.get_by_id(target_user_id)
        if not user:
            return False, "User not found."

        if len(new_password) < 6:
            return False, "Password must be at least 6 characters long."

        user.set_password(new_password)
        self.user_repo.update(user)
        return True, f"Password for {user.name} was successfully reset."
