"""Stock movement (inventory ledger entry) domain model."""
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Mapping


class MovementReason(Enum):
    """
    Why stock changed. Values are stored in ``stock_movements.reason``.

    Each member carries (value, label, direction) where direction is
    +1 = may only add stock, -1 = may only remove stock, 0 = either.
    """

    INITIAL = ("initial", "Opening stock", 1)
    RESTOCK = ("restock", "Restock / delivery", 1)
    SALE = ("sale", "Sale", -1)
    REFUND = ("refund", "Customer return", 1)
    DAMAGED = ("damaged", "Damaged goods", -1)
    BREAKAGE = ("breakage", "Breakage", -1)
    COUNT_ADJUSTMENT = ("count_adjustment", "Inventory count adjustment", 0)
    SUPPLIER_RETURN = ("supplier_return", "Supplier return", -1)
    INTERNAL_USE = ("internal_use", "Internal usage", -1)
    PURCHASE_ORDER = ("purchase_order", "Purchase order received", 1)

    def __new__(cls, value: str, label: str, direction: int) -> "MovementReason":
        obj = object.__new__(cls)
        obj._value_ = value
        obj.label = label
        obj.direction = direction
        return obj

    @classmethod
    def manual_choices(cls) -> list["MovementReason"]:
        """Reasons a staff member may pick for a manual adjustment (waste auditing)."""
        return [cls.RESTOCK, cls.DAMAGED, cls.BREAKAGE, cls.COUNT_ADJUSTMENT,
                cls.SUPPLIER_RETURN, cls.INTERNAL_USE]

    @property
    def is_waste(self) -> bool:
        """Losses that count as shrinkage in reports."""
        return self in (MovementReason.DAMAGED, MovementReason.BREAKAGE, MovementReason.INTERNAL_USE)

    def check_change(self, change: int) -> None:
        """Raise ValueError if ``change`` goes the wrong way for this reason."""
        if change == 0:
            raise ValueError("Quantity must be at least 1.")
        if self.direction > 0 and change < 0:
            raise ValueError(f"'{self.label}' can only add stock.")
        if self.direction < 0 and change > 0:
            raise ValueError(f"'{self.label}' can only remove stock.")


@dataclass(frozen=True)
class StockMovement:
    """Immutable ledger line: +n (in) or -n (out) for one product."""

    id: int
    product_id: int
    change_amount: int
    reason: MovementReason
    note: str = ""
    product_name: str = ""
    created_by_name: str = ""
    created_at: datetime | None = None

    @property
    def is_inbound(self) -> bool:
        return self.change_amount > 0

    @classmethod
    def from_row(cls, row: Mapping[str, Any] | None) -> "StockMovement | None":
        if row is None:
            return None
        return cls(
            id=row["id"],
            product_id=row["product_id"],
            change_amount=int(row["change_amount"]),
            reason=MovementReason(row["reason"]),
            note=row.get("note") or "",
            product_name=row.get("product_name") or "",
            created_by_name=row.get("created_by_name") or "System",
            created_at=row.get("created_at"),
        )
