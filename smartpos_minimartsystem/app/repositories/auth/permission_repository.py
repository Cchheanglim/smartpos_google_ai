"""Data access for permissions and per-user permission overrides."""
from typing import Any, Mapping

from app.models.auth.permission import Permission
from app.repositories.base_repository import BaseRepository


class PermissionRepository(BaseRepository[Permission]):
    table_name = "permissions"
    default_order = "group_name, id"

    def _to_model(self, row: Mapping[str, Any] | None) -> Permission | None:
        return Permission.from_row(row)

    def find_by_name(self, name: str) -> Permission | None:
        return self._to_model(self._fetch_one(f"{self._select_sql()} WHERE name = %s", (name,)))

    def create(self, permission: Permission) -> int:
        return self._execute(
            "INSERT INTO permissions (name, display_name, description, group_name) VALUES (%s, %s, %s, %s)",
            (permission.name, permission.display_name, permission.description or None,
             permission.group_name or "General"))

    # ---- individual overrides (user_permissions) ----
    def names_for_user(self, user_id: int) -> set[str]:
        rows = self._fetch_all(
            "SELECT p.name FROM user_permissions up JOIN permissions p ON p.id = up.permission_id "
            "WHERE up.user_id = %s", (user_id,))
        return {r["name"] for r in rows}

    def replace_user_permissions(self, user_id: int, permission_ids: list[int], granted_by: int) -> None:
        """Replace one person's override set (caller wraps this in a transaction)."""
        self._execute("DELETE FROM user_permissions WHERE user_id = %s", (user_id,))
        for pid in permission_ids:
            self._execute("INSERT INTO user_permissions (user_id, permission_id, granted_by) VALUES (%s, %s, %s)",
                          (user_id, pid, granted_by))
