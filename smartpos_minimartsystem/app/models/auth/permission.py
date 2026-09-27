"""Permission domain model."""
from dataclasses import dataclass
from typing import Any, Mapping


@dataclass
class Permission:
    """One named capability, e.g. ``manage_products`` or ``process_sale``."""

    id: int
    name: str
    display_name: str
    description: str = ""
    group_name: str = "General"

    @classmethod
    def from_row(cls, row: Mapping[str, Any] | None) -> "Permission | None":
        if row is None:
            return None
        return cls(
            id=row["id"],
            name=row["name"],
            display_name=row.get("display_name") or row["name"],
            description=row.get("description") or "",
            group_name=row.get("group_name") or "General",
        )
