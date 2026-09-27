"""Refund and RefundItem domain models."""
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any, Mapping

from app.models.base import to_money


@dataclass
class RefundItem:
    id: int | None
    refund_id: int | None
    sale_item_id: int
    product_id: int
    product_name: str
    quantity: int
    amount: Decimal

    def __post_init__(self) -> None:
        self.amount = to_money(self.amount)

    @classmethod
    def from_row(cls, row: Mapping[str, Any] | None) -> "RefundItem | None":
        if row is None:
            return None
        return cls(
            id=row["id"],
            refund_id=row["refund_id"],
            sale_item_id=row["sale_item_id"],
            product_id=row["product_id"],
            product_name=row.get("product_name") or "",
            quantity=int(row["quantity"]),
            amount=row["amount"],
        )


@dataclass
class Refund:
    id: int | None
    sale_id: int
    processed_by: int
    refund_amount: Decimal
    reason: str = ""
    processed_by_name: str = ""
    attendance_id: int | None = None
    payment_method: str = ""
    item_count: int = 0
    created_at: datetime | None = None
    items: list[RefundItem] = field(default_factory=list)

    @property
    def receipt_number(self) -> str:
        return f"INV-{self.sale_id:06d}"

    @property
    def reference(self) -> str:
        return f"RF-{self.id:05d}" if self.id else "RF-new"

    def __post_init__(self) -> None:
        self.refund_amount = to_money(self.refund_amount)

    @classmethod
    def from_row(cls, row: Mapping[str, Any] | None) -> "Refund | None":
        if row is None:
            return None
        return cls(
            id=row["id"],
            sale_id=row["sale_id"],
            processed_by=row["processed_by"],
            refund_amount=row["refund_amount"],
            reason=row.get("reason") or "",
            processed_by_name=row.get("processed_by_name") or "",
            attendance_id=row.get("attendance_id"),
            payment_method=row.get("payment_method") or "",
            item_count=int(row.get("item_count") or 0),
            created_at=row.get("created_at"),
        )
