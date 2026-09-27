"""Purchase order (supplier procurement) domain models."""
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Mapping

from app.models.base import to_money


class POStatus(Enum):
    """
    Purchase-order state machine::

        draft ──► ordered ──► received
          │          │
          └──────────┴──────► cancelled

    ``received`` and ``cancelled`` are terminal.
    """

    DRAFT = "draft"
    ORDERED = "ordered"
    RECEIVED = "received"
    CANCELLED = "cancelled"

    @property
    def label(self) -> str:
        return self.value.title()

    @property
    def allowed_next(self) -> frozenset["POStatus"]:
        return _TRANSITIONS[self]

    @property
    def is_terminal(self) -> bool:
        return not self.allowed_next

    def can_become(self, target: "POStatus") -> bool:
        return target in self.allowed_next


_TRANSITIONS: dict[POStatus, frozenset[POStatus]] = {
    POStatus.DRAFT: frozenset({POStatus.ORDERED, POStatus.CANCELLED}),
    POStatus.ORDERED: frozenset({POStatus.RECEIVED, POStatus.CANCELLED}),
    POStatus.RECEIVED: frozenset(),
    POStatus.CANCELLED: frozenset(),
}


@dataclass
class PurchaseOrderItem:
    """One product line on a purchase order."""

    id: int | None
    po_id: int | None
    product_id: int
    quantity: int
    unit_cost: Decimal
    product_name: str = ""
    product_sku: str = ""

    def __post_init__(self) -> None:
        self.unit_cost = to_money(self.unit_cost)
        self.quantity = int(self.quantity)

    def validate(self) -> None:
        if self.quantity <= 0:
            raise ValueError("Each order line needs a quantity of at least 1.")
        if self.quantity > 100_000:
            raise ValueError("Order quantity is unrealistically large.")
        if self.unit_cost < 0:
            raise ValueError("Unit cost cannot be negative.")

    @property
    def line_total(self) -> Decimal:
        return self.unit_cost * self.quantity

    @classmethod
    def from_row(cls, row: Mapping[str, Any] | None) -> "PurchaseOrderItem | None":
        if row is None:
            return None
        return cls(id=row["id"], po_id=row["po_id"], product_id=row["product_id"],
                   quantity=row["quantity"], unit_cost=row["unit_cost"],
                   product_name=row.get("product_name") or "", product_sku=row.get("product_sku") or "")


@dataclass
class PurchaseOrder:
    """A supplier order that moves stock into the shop once it is received."""

    id: int | None
    supplier_id: int
    status: POStatus = POStatus.DRAFT
    expected_date: date | None = None
    notes: str = ""
    created_by: int | None = None
    supplier_name: str = ""
    created_by_name: str = ""
    received_by_name: str = ""
    created_at: datetime | None = None
    ordered_at: datetime | None = None
    received_at: datetime | None = None
    cancelled_at: datetime | None = None
    items: list[PurchaseOrderItem] = field(default_factory=list)
    stored_total: Decimal | None = None      # from list queries (items not loaded)

    @property
    def reference(self) -> str:
        return f"PO-{self.id:05d}" if self.id else "PO-new"

    @property
    def total_cost(self) -> Decimal:
        if self.items:
            return sum((i.line_total for i in self.items), Decimal("0.00"))
        return to_money(self.stored_total)

    @property
    def unit_count(self) -> int:
        return sum(i.quantity for i in self.items)

    @property
    def is_overdue(self) -> bool:
        return (self.status is POStatus.ORDERED and self.expected_date is not None
                and self.expected_date < date.today())

    def transition_to(self, target: POStatus) -> None:
        """Move to ``target`` or raise ValueError if the workflow forbids it."""
        if not self.status.can_become(target):
            raise ValueError(f"A {self.status.label.lower()} purchase order cannot be marked {target.label.lower()}.")
        if target is POStatus.ORDERED and not self.items:
            raise ValueError("Add at least one product before placing the order.")
        self.status = target

    @classmethod
    def from_row(cls, row: Mapping[str, Any] | None) -> "PurchaseOrder | None":
        if row is None:
            return None
        return cls(
            id=row["id"], supplier_id=row["supplier_id"], status=POStatus(row["status"]),
            expected_date=_as_date(row.get("expected_date")), notes=row.get("notes") or "",
            created_by=row.get("created_by"), supplier_name=row.get("supplier_name") or "",
            created_by_name=row.get("created_by_name") or "", received_by_name=row.get("received_by_name") or "",
            created_at=row.get("created_at"), ordered_at=row.get("ordered_at"),
            received_at=row.get("received_at"), cancelled_at=row.get("cancelled_at"),
            stored_total=row.get("total_cost"),
        )


def _as_date(value: Any) -> date | None:
    """MySQL returns DATE as ``date``; tolerate strings too."""
    if value is None or isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])
