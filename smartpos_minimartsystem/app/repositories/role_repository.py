"""
Role and Permissions Repository
"""

from typing import List, Dict, Any, Optional
from .db_manager import db_manager
from ..models.role import Role, Permission


class RoleRepository:
    """Handles persistence and retrieval of roles and system permissions."""

    def __init__(self, db=None):
        self.db = db or db_manager

    def get_all_roles(self) -> List[Role]:
        roles_data = self.db.execute_query("SELECT * FROM roles ORDER BY id ASC;")
        roles = []
        for r in roles_data:
            perm_rows = self.db.execute_query(
                """
                SELECT p.name FROM permissions p
                JOIN role_permissions rp ON p.id = rp.permission_id
                WHERE rp.role_id = %s;
                """,
                (r['id'],)
            )
            perms = [row['name'] for row in perm_rows]
            roles.append(Role(
                id=r['id'],
                name=r['name'],
                display_name=r['display_name'],
                description=r.get('description', ''),
                is_system=bool(r.get('is_system', 1)),
                permissions=perms
            ))
        return roles

    def get_role_by_name(self, name: str) -> Optional[Role]:
        row = self.db.execute_one("SELECT * FROM roles WHERE name = %s;", (name,))
        if not row:
            return None
        perm_rows = self.db.execute_query(
            """
            SELECT p.name FROM permissions p
            JOIN role_permissions rp ON p.id = rp.permission_id
            WHERE rp.role_id = %s;
            """,
            (row['id'],)
        )
        perms = [p['name'] for p in perm_rows]
        return Role(
            id=row['id'],
            name=row['name'],
            display_name=row['display_name'],
            description=row.get('description', ''),
            is_system=bool(row.get('is_system', 1)),
            permissions=perms
        )

    def get_system_permissions(self) -> List[Permission]:
        rows = self.db.execute_query("SELECT * FROM permissions ORDER BY id ASC;")
        return [
            Permission(
                id=row['id'],
                name=row['name'],
                display_name=row['display_name'],
                description=row.get('description', ''),
                is_system=bool(row.get('is_system', 1))
            )
            for row in rows
        ]

    def update_role_permissions(self, role_name: str, permission_names: List[str]) -> bool:
        role = self.get_role_by_name(role_name)
        if not role:
            return False

        # Clear existing role_permissions for this role
        self.db.execute_non_query("DELETE FROM role_permissions WHERE role_id = %s;", (role.id,))

        for perm_name in permission_names:
            perm_row = self.db.execute_one("SELECT id FROM permissions WHERE name = %s;", (perm_name,))
            if perm_row:
                self.db.execute_non_query(
                    "INSERT INTO role_permissions (role_id, permission_id) VALUES (%s, %s);",
                    (role.id, perm_row['id'])
                )
        return True
