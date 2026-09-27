"""Role domain model."""
from dataclasses import dataclass, field
from typing import Any, Mapping


@dataclass
class Role:
    """A job role (Admin, Cashier, ...) that owns a set of permission names."""

    SUPER_ADMIN = "super_admin"

    id: int
    name: str
    display_name: str
    description: str = ""
    is_system: bool = False
    user_count: int = 0
    permission_names: set[str] = field(default_factory=set)

    @property
    def is_super_admin(self) -> bool:
        return self.name == self.SUPER_ADMIN

    def grants(self, permission_name: str) -> bool:
        """True if this role includes ``permission_name``."""
        return permission_name in self.permission_names

    def __contains__(self, permission_name: str) -> bool:
        return self.grants(permission_name)

    @classmethod
    def from_row(cls, row: Mapping[str, Any] | None) -> "Role | None":
        if row is None:
            return None
        return cls(
            id=row["id"],
            name=row["name"],
            display_name=row.get("display_name") or row["name"].replace("_", " ").title(),
            description=row.get("description") or "",
            is_system=bool(row.get("is_system") or 0),
            user_count=int(row.get("user_count") or 0),
        )
