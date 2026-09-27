"""Held (parked) order domain model."""
import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Mapping

CartData = dict[str, Any]


@dataclass
class HeldOrder:
    """
    A cart put aside so the cashier can serve another customer, resumed later.

    ``cart`` holds ``{"items": <session cart>, "state": <discount/customer/points>}``.
    """

    id: int | None
    cashier_id: int
    label: str
    cart: CartData = field(default_factory=dict)
    customer_phone: str = ""
    held_at: datetime | None = None
    cashier_name: str = ""

    MAX_LABEL = 80

    def __post_init__(self) -> None:
        self.label = (self.label or "").strip()[: self.MAX_LABEL]

    @property
    def items(self) -> dict[str, Any]:
        return self.cart.get("items", {})

    def validate(self) -> None:
        if not self.items:
            raise ValueError("There is nothing in the cart to hold.")
        if not self.label:
            raise ValueError("Give the held order a short label (e.g. customer name).")

    @property
    def item_count(self) -> int:
        total = 0
        for line in self.items.values():
            total += int(line.get("qty", 0)) if isinstance(line, dict) else int(line)
        return total

    def cart_json(self) -> str:
        return json.dumps(self.cart, separators=(",", ":"))

    @classmethod
    def from_row(cls, row: Mapping[str, Any] | None) -> "HeldOrder | None":
        if row is None:
            return None
        try:
            cart = json.loads(row.get("cart_json") or "{}")
        except ValueError:
            cart = {}
        return cls(id=row["id"], cashier_id=row["cashier_id"], label=row["label"], cart=cart,
                   customer_phone=row.get("customer_phone") or "", held_at=row.get("held_at"),
                   cashier_name=row.get("cashier_name") or "")
