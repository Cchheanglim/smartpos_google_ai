"""Immutable audit-trail entry."""
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Mapping


@dataclass(frozen=True)
class AuditEntry:
    """Who did what, when. Frozen: audit entries are never edited."""

    id: int | None
    action: str
    details: str = ""
    user_id: int | None = None
    user_name: str = ""
    created_at: datetime | None = None

    @property
    def action_label(self) -> str:
        return self.action.replace("_", " ").replace(".", " · ").title()

    @classmethod
    def from_row(cls, row: Mapping[str, Any] | None) -> "AuditEntry | None":
        if row is None:
            return None
        return cls(id=row["id"], action=row["action"], details=row.get("details") or "",
                   user_id=row.get("user_id"), user_name=row.get("user_name") or "System",
                   created_at=row.get("created_at"))
