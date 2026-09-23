"""
Role and Permission Domain Entities
Encapsulates Role-Based Access Control (RBAC) domain models.
"""

from typing import List, Set, Dict, Any, Optional
from .base import BaseModel


class Permission(BaseModel):
    """Represents a specific system capability (e.g. 'process_sale')."""
    
    def __init__(
        self,
        id: Optional[int],
        name: str,
        display_name: str,
        description: str = '',
        is_system: bool = True
    ):
        super().__init__(id)
        if not name:
            raise ValueError("Permission name cannot be empty.")
        self.name = name.strip()
        self.display_name = display_name.strip()
        self.description = description
        self.is_system = is_system

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'display_name': self.display_name,
            'description': self.description,
            'is_system': self.is_system
        }


class Role(BaseModel):
    """Represents a user role aggregating a set of permissions."""
    
    def __init__(
        self,
        id: Optional[int],
        name: str,
        display_name: str,
        description: str = '',
        is_system: bool = True,
        permissions: Optional[List[str]] = None
    ):
        super().__init__(id)
        if not name:
            raise ValueError("Role name cannot be empty.")
        self.name = name.strip()
        self.display_name = display_name.strip()
        self.description = description
        self.is_system = is_system
        self._permissions: Set[str] = set(permissions or [])

    @property
    def permissions(self) -> Set[str]:
        """Returns the set of permission names granted to this role."""
        return set(self._permissions)

    def add_permission(self, permission_name: str) -> None:
        """Grants a permission to this role."""
        self._permissions.add(permission_name)

    def remove_permission(self, permission_name: str) -> None:
        """Revokes a permission from this role."""
        self._permissions.discard(permission_name)

    def has_permission(self, permission_name: str) -> bool:
        """Checks if this role possesses a given permission."""
        return permission_name in self._permissions

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'display_name': self.display_name,
            'description': self.description,
            'is_system': self.is_system,
            'permissions': list(self._permissions)
        }
