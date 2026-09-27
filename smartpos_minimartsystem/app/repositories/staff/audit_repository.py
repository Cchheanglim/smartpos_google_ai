"""Append-only access to the audit_log table (no update or delete methods by design)."""
from typing import Any, Mapping

from app.models.staff.audit import AuditEntry
from app.repositories.base_repository import BaseRepository


class AuditRepository(BaseRepository[AuditEntry]):
    table_name = "audit_log"

    def _to_model(self, row: Mapping[str, Any] | None) -> AuditEntry | None:
        return AuditEntry.from_row(row)

    def _select_sql(self) -> str:
        return "SELECT l.*, u.name AS user_name FROM audit_log l LEFT JOIN users u ON u.id = l.user_id"

    def _alias(self) -> str:
        return "l."

    def record(self, user_id: int | None, action: str, details: str = "") -> int:
        return self._execute("INSERT INTO audit_log (user_id, action, details) VALUES (%s, %s, %s)",
                             (user_id, action, (details or "")[:500]))

    def recent(self, action_prefix: str = "", limit: int = 100) -> list[AuditEntry]:
        sql, params = f"{self._select_sql()} WHERE 1=1", []
        if action_prefix:
            sql += " AND l.action LIKE %s"
            params.append(f"{action_prefix}%")
        sql += " ORDER BY l.created_at DESC, l.id DESC LIMIT %s"
        params.append(limit)
        return [self._to_model(r) for r in self._fetch_all(sql, params)]

    def delete(self, entity_id: int) -> int:  # noqa: D401 - deliberately disabled
        """Audit entries are immutable."""
        raise PermissionError("Audit log entries cannot be deleted.")
