"""
Category and Supplier Domain Entities
"""

from typing import Dict, Any, Optional
from .base import BaseModel


class Category(BaseModel):
    """Merchandise department or product category."""
    
    def __init__(
        self,
        id: Optional[int],
        name: str,
        description: str = '',
        icon: str = 'fa-box',
        is_active: bool = True
    ):
        super().__init__(id)
        if not name:
            raise ValueError("Category name cannot be empty.")
        self.name = name.strip()
        self.description = description.strip() if description else ''
        self.icon = icon or 'fa-box'
        self.is_active = is_active

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'icon': self.icon,
            'is_active': self.is_active
        }


class Supplier(BaseModel):
    """Wholesale distributor or supplier."""
    
    def __init__(
        self,
        id: Optional[int],
        name: str,
        contact_person: str = '',
        phone: str = '',
        email: str = '',
        address: str = '',
        is_active: bool = True
    ):
        super().__init__(id)
        if not name:
            raise ValueError("Supplier name cannot be empty.")
        self.name = name.strip()
        self.contact_person = contact_person.strip() if contact_person else ''
        self.phone = phone.strip() if phone else ''
        self.email = email.strip() if email else ''
        self.address = address.strip() if address else ''
        self.is_active = is_active

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'contact_person': self.contact_person,
            'phone': self.phone,
            'email': self.email,
            'address': self.address,
            'is_active': self.is_active
        }
