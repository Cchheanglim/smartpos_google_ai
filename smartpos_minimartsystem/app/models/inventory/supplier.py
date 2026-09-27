"""Supplier domain model."""
from dataclasses import dataclass
from typing import Any, Mapping


@dataclass
class Supplier:
    """A company the shop buys stock from."""

    id: int
    name: str
    contact_name: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    product_count: int = 0

    @classmethod
    def from_row(cls, row: Mapping[str, Any] | None) -> "Supplier | None":
        if row is None:
            return None
        return cls(
            id=row["id"],
            name=row["name"],
            contact_name=row.get("contact_name") or "",
            phone=row.get("phone") or "",
            email=row.get("email") or "",
            address=row.get("address") or "",
            product_count=int(row.get("product_count") or 0),
        )
