"""User (staff account) domain model."""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Mapping


@dataclass
class User:
    """
    A staff member who can log in.

    The four Flask-Login members (``is_authenticated``, ``is_active``,
    ``is_anonymous``, ``get_id``) are implemented directly, so this stays a
    plain Python object with no framework base class.
    """

    id: int
    name: str
    email: str
    role_id: int
    role_name: str
    role_display_name: str
    password_hash: str = ""
    phone: str | None = None
    avatar_filename: str | None = None
    active: bool = True
    shift_id: int | None = None
    shift_name: str | None = None
    shift_label: str | None = None
    deactivated_at: datetime | None = None
    deactivation_reason: str | None = None
    created_at: datetime | None = None
    extra_permissions: set[str] = field(default_factory=set)

    # ---- Flask-Login protocol ----
    @property
    def is_authenticated(self) -> bool:
        return True

    @property
    def is_active(self) -> bool:
        return self.active

    @property
    def is_anonymous(self) -> bool:
        return False

    def get_id(self) -> str:
        return str(self.id)

    # ---- domain behaviour ----
    @property
    def initials(self) -> str:
        """Two-letter initials used when there is no avatar picture."""
        parts = [p for p in self.name.split() if p]
        return "".join(p[0] for p in parts[:2]).upper() or "?"

    @property
    def is_super_admin(self) -> bool:
        return self.role_name == "super_admin"

    @property
    def is_admin(self) -> bool:
        """Admins and super admins (store management)."""
        return self.role_name in ("super_admin", "admin")

    @property
    def status_label(self) -> str:
        return "Active" if self.active else "Resigned"

    @classmethod
    def from_row(cls, row: Mapping[str, Any] | None) -> "User | None":
        if row is None:
            return None
        return cls(
            id=row["id"],
            name=row["name"],
            email=row["email"],
            role_id=row["role_id"],
            role_name=row.get("role_name") or "",
            role_display_name=row.get("role_display_name") or row.get("role_name") or "",
            password_hash=row.get("password_hash") or "",
            phone=row.get("phone"),
            avatar_filename=row.get("avatar_filename"),
            active=bool(row.get("is_active", 1)),
            shift_id=row.get("shift_id"),
            shift_name=row.get("shift_name"),
            shift_label=_shift_label(row),
            deactivated_at=row.get("deactivated_at"),
            deactivation_reason=row.get("deactivation_reason"),
            created_at=row.get("created_at"),
        )


def _shift_label(row: Mapping[str, Any]) -> str | None:
    """Readable shift hours from the joined shifts row, if any."""
    if not row.get("shift_start"):
        return None
    from app.models.staff.shift import Shift
    return Shift(None, row.get("shift_name") or "", row["shift_start"], row["shift_end"]).label
