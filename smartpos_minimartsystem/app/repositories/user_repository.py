"""
User and Staff Repository
Handles SQL operations for user records, authentication lookup, and role/permission associations.
"""

from typing import List, Optional
from datetime import datetime
from .base_repository import BaseRepository
from .db_manager import db_manager
from ..models.user import User


class UserRepository(BaseRepository[User]):
    """Data access repository for users and staff members."""

    def __init__(self, db=None):
        self.db = db or db_manager

    def _map_row_to_user(self, row: dict) -> User:
        user_id = row['id']
        # Load extra permission overrides
        perm_rows = self.db.execute_query(
            "SELECT permission_name FROM user_permissions WHERE user_id = %s;",
            (user_id,)
        )
        extra_perms = [p['permission_name'] for p in perm_rows]

        # Load role permissions
        role_perm_rows = self.db.execute_query(
            """
            SELECT p.name FROM permissions p
            JOIN role_permissions rp ON p.id = rp.permission_id
            WHERE rp.role_id = %s;
            """,
            (row['role_id'],)
        )
        role_perms = [p['name'] for p in role_perm_rows]

        return User(
            id=row['id'],
            name=row['name'],
            email=row['email'],
            password_hash=row['password_hash'],
            role_id=row['role_id'],
            role_name=row.get('role_name', 'cashier'),
            phone=row.get('phone', ''),
            shift_name=row.get('shift_name', 'Morning'),
            shift_start=str(row.get('shift_start', '06:00:00')),
            shift_end=str(row.get('shift_end', '14:00:00')),
            is_active=bool(row.get('is_active', 1)),
            profile_picture=row.get('profile_picture', 'f86e67858910489ba513eae41ad5b941.png'),
            extra_permissions=extra_perms,
            role_permissions=role_perms
        )

    def get_by_id(self, entity_id: int) -> Optional[User]:
        query = """
            SELECT u.*, r.name as role_name 
            FROM users u 
            JOIN roles r ON u.role_id = r.id 
            WHERE u.id = %s;
        """
        row = self.db.execute_one(query, (entity_id,))
        return self._map_row_to_user(row) if row else None

    def get_by_email(self, email: str) -> Optional[User]:
        query = """
            SELECT u.*, r.name as role_name 
            FROM users u 
            JOIN roles r ON u.role_id = r.id 
            WHERE LOWER(u.email) = LOWER(%s);
        """
        row = self.db.execute_one(query, (email.strip(),))
        return self._map_row_to_user(row) if row else None

    def get_all(self) -> List[User]:
        query = """
            SELECT u.*, r.name as role_name 
            FROM users u 
            JOIN roles r ON u.role_id = r.id 
            ORDER BY u.id ASC;
        """
        rows = self.db.execute_query(query)
        return [self._map_row_to_user(row) for row in rows]

    def create(self, user: User) -> User:
        query = """
            INSERT INTO users (name, email, phone, password_hash, role_id, shift_name, shift_start, shift_end, is_active, profile_picture)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """
        new_id = self.db.execute_non_query(query, (
            user.name,
            user.email,
            user.phone,
            user._password_hash,
            user.role_id,
            user.shift_name,
            user.shift_start,
            user.shift_end,
            1 if user.is_active else 0,
            user.profile_picture
        ))
        user.id = new_id
        return user

    def update(self, user: User) -> bool:
        query = """
            UPDATE users SET 
                name = %s, 
                email = %s, 
                phone = %s, 
                password_hash = %s,
                role_id = %s, 
                shift_name = %s, 
                shift_start = %s, 
                shift_end = %s, 
                is_active = %s,
                profile_picture = %s
            WHERE id = %s;
        """
        self.db.execute_non_query(query, (
            user.name,
            user.email,
            user.phone,
            user._password_hash,
            user.role_id,
            user.shift_name,
            user.shift_start,
            user.shift_end,
            1 if user.is_active else 0,
            user.profile_picture,
            user.id
        ))
        return True

    def delete(self, entity_id: int) -> bool:
        query = "UPDATE users SET is_active = 0 WHERE id = %s;"
        self.db.execute_non_query(query, (entity_id,))
        return True

    def update_role(self, user_id: int, new_role_id: int) -> bool:
        query = "UPDATE users SET role_id = %s WHERE id = %s;"
        self.db.execute_non_query(query, (new_role_id, user_id))
        return True

    def set_extra_permissions(self, user_id: int, permissions: List[str]) -> bool:
        self.db.execute_non_query("DELETE FROM user_permissions WHERE user_id = %s;", (user_id,))
        for perm in permissions:
            self.db.execute_non_query(
                "INSERT INTO user_permissions (user_id, permission_name) VALUES (%s, %s);",
                (user_id, perm)
            )
        return True
