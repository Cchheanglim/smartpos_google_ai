"""Data access for roles and the role_permissions junction table."""
from typing import Any, Mapping

from app.models.auth.role import Role
from app.repositories.base_repository import BaseRepository


class RoleRepository(BaseRepository[Role]):
    table_name = "roles"

    def _to_model(self, row: Mapping[str, Any] | None) -> Role | None:
        role = Role.from_row(row)
        if role is not None:
            role.permission_names = self.permission_names_for_role(role.id)
        return role

    def _select_sql(self) -> str:
        return ("SELECT r.*, (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id AND u.is_active = 1) AS user_count "
                "FROM roles r")

    def _alias(self) -> str:
        return "r."

    def find_by_name(self, name: str) -> Role | None:
        return self._to_model(self._fetch_one(f"{self._select_sql()} WHERE r.name = %s", (name,)))

    def permission_names_for_role(self, role_id: int) -> set[str]:
        rows = self._fetch_all(
            "SELECT p.name FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id "
            "WHERE rp.role_id = %s", (role_id,))
        return {r["name"] for r in rows}

    def replace_permissions(self, role_id: int, permission_ids: list[int]) -> None:
        """Replace a role's permission set (caller wraps this in a transaction)."""
        self._execute("DELETE FROM role_permissions WHERE role_id = %s", (role_id,))
        for pid in permission_ids:
            self._execute("INSERT INTO role_permissions (role_id, permission_id) VALUES (%s, %s)",
                          (role_id, pid))

    def create(self, role: Role) -> int:
        return self._execute(
            "INSERT INTO roles (name, display_name, description, is_system) VALUES (%s, %s, %s, 0)",
            (role.name, role.display_name, role.description or None))
