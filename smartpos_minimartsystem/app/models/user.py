"""
User Domain Model
Encapsulates staff identities, credentials, work shifts, and access resolution.
"""

from typing import List, Set, Dict, Any, Optional
from datetime import datetime, time
from .base import BaseModel
from ..extensions import PasswordHasher


class User(BaseModel):
    """Represents an employee / system user with assigned role and shifts."""
    
    def __init__(
        self,
        id: Optional[int],
        name: str,
        email: str,
        password_hash: str,
        role_id: int,
        role_name: str = 'cashier',
        phone: str = '',
        shift_name: str = 'Morning',
        shift_start: str = '06:00:00',
        shift_end: str = '14:00:00',
        is_active: bool = True,
        profile_picture: str = 'f86e67858910489ba513eae41ad5b941.png',
        extra_permissions: Optional[List[str]] = None,
        role_permissions: Optional[List[str]] = None,
        created_at: Optional[datetime] = None
    ):
        super().__init__(id, created_at)
        self.name = name.strip()
        self.email = email.strip().lower()
        self.phone = phone.strip() if phone else ''
        self._password_hash = password_hash
        self.role_id = role_id
        self.role_name = role_name
        self.shift_name = shift_name
        self.shift_start = shift_start
        self.shift_end = shift_end
        self.is_active = is_active
        self.profile_picture = profile_picture or 'f86e67858910489ba513eae41ad5b941.png'
        self._extra_permissions: Set[str] = set(extra_permissions or [])
        self._role_permissions: Set[str] = set(role_permissions or [])

    @property
    def is_authenticated(self) -> bool:
        """Returns True if the user is active and authenticated."""
        return self.is_active

    @property
    def is_super_admin(self) -> bool:
        """Checks if the user holds the highest super_admin role."""
        return self.role_name == 'super_admin'

    @property
    def is_admin(self) -> bool:
        """Checks if the user has administrative privileges."""
        return self.role_name in ('super_admin', 'admin')

    @property
    def is_cashier(self) -> bool:
        """Checks if user operates the POS cashier terminal."""
        return self.role_name == 'cashier'

    @property
    def is_inventory_manager(self) -> bool:
        """Checks if user manages the product catalog and stock adjustments."""
        return self.role_name == 'inventory_manager'

    @property
    def resolved_permissions(self) -> Set[str]:
        """Resolves access as: user -> role -> permissions + extra overrides."""
        return self._role_permissions.union(self._extra_permissions)

    def set_role_permissions(self, perms: List[str]) -> None:
        """Updates the cached permissions associated with the user's role."""
        self._role_permissions = set(perms)

    def has_permission(self, permission_name: str) -> bool:
        """
        Server-side permission guard.
        Super Admin & Admin automatically possess all permissions.
        """
        if self.is_admin:
            return True
        perms = self.resolved_permissions
        if permission_name in perms:
            return True
        # Common aliases
        if permission_name == 'process_sales' and 'process_sale' in perms:
            return True
        if permission_name == 'process_sale' and 'process_sales' in perms:
            return True
        if permission_name == 'manage_customers' and 'manage_loyalty_customers' in perms:
            return True
        if permission_name == 'manage_loyalty_customers' and 'manage_customers' in perms:
            return True
        return False

    def verify_password(self, plaintext: str) -> bool:
        """Verifies candidate plaintext against the user's stored hash."""
        return PasswordHasher.verify_password(plaintext, self._password_hash)

    def set_password(self, plaintext: str) -> None:
        """Hashes and updates the user's password."""
        self._password_hash = PasswordHasher.hash_password(plaintext)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'role_id': self.role_id,
            'role_name': self.role_name,
            'shift_name': self.shift_name,
            'shift_start': self.shift_start,
            'shift_end': self.shift_end,
            'is_active': self.is_active,
            'profile_picture': self.profile_picture,
            'extra_permissions': list(self._extra_permissions),
            'resolved_permissions': list(self.resolved_permissions)
        }
