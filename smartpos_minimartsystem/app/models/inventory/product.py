"""Product domain model — the centre of the Inventory vertical slice."""
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Mapping

from app.models.base import to_money


class StockStatus(Enum):
    """Stock level classification shown as a badge in the UI."""

    OUT = "Out of stock"
    LOW = "Low stock"
    OK = "In stock"


@dataclass
class Product:
    """
    A sellable item.

    Protected state: price, cost, stock and threshold are validated by
    ``validate()`` and by the property setters, so an object can never
    silently hold a negative price or stock level.
    """

    id: int | None
    sku: str
    name: str
    price: Decimal
    barcode: str | None = None
    cost: Decimal = Decimal("0.00")
    quantity_in_stock: int = 0
    low_stock_threshold: int = 5
    category_id: int | None = None
    category_name: str | None = None
    category_icon: str | None = None
    supplier_id: int | None = None
    supplier_name: str | None = None
    image_filename: str | None = None
    created_at: datetime | None = None

    def __post_init__(self) -> None:
        self.price = to_money(self.price)
        self.cost = to_money(self.cost)
        self.quantity_in_stock = int(self.quantity_in_stock)
        self.low_stock_threshold = int(self.low_stock_threshold)

    # ---- business rules ----
    def validate(self) -> None:
        """Raise ValueError if the object is in an invalid state."""
        if not self.name or not self.name.strip():
            raise ValueError("Product name is required.")
        if len(self.name) > 150:
            raise ValueError("Product name must be 150 characters or fewer.")
        if not self.sku or not self.sku.strip():
            raise ValueError("SKU is required.")
        if self.barcode and (not self.barcode.isdigit() or not 8 <= len(self.barcode) <= 14):
            raise ValueError("Barcode must be 8–14 digits (EAN-8, UPC-A, EAN-13 or GTIN-14).")
        if self.price <= 0:
            raise ValueError("Selling price must be greater than zero.")
        if self.cost < 0:
            raise ValueError("Cost price cannot be negative.")
        if self.quantity_in_stock < 0:
            raise ValueError("Stock quantity cannot be negative.")
        if self.low_stock_threshold < 0:
            raise ValueError("Low-stock threshold cannot be negative.")

    def can_fulfil(self, quantity: int) -> bool:
        """True if ``quantity`` units can be sold from current stock."""
        return 0 < quantity <= self.quantity_in_stock

    @property
    def status(self) -> StockStatus:
        if self.quantity_in_stock <= 0:
            return StockStatus.OUT
        if self.quantity_in_stock <= self.low_stock_threshold:
            return StockStatus.LOW
        return StockStatus.OK

    @property
    def is_low_stock(self) -> bool:
        return self.status is not StockStatus.OK

    @property
    def margin(self) -> Decimal:
        """Profit per unit."""
        return self.price - self.cost

    @property
    def margin_percent(self) -> Decimal:
        """Gross profit margin: profit as a share of the selling price."""
        if self.price == 0:
            return Decimal("0")
        return (self.margin / self.price * 100).quantize(Decimal("0.1"))

    @property
    def markup_percent(self) -> Decimal:
        """Markup: profit as a share of the cost price."""
        if self.cost == 0:
            return Decimal("0")
        return (self.margin / self.cost * 100).quantize(Decimal("0.1"))

    @property
    def scan_code(self) -> str:
        """What a barcode scanner reads: the EAN barcode if set, else the SKU."""
        return self.barcode or self.sku

    @property
    def stock_value(self) -> Decimal:
        """Current stock valued at cost."""
        return self.cost * self.quantity_in_stock

    @property
    def icon(self) -> str:
        return self.category_icon or "fa-box"

    @property
    def image_src(self) -> str | None:
        """The value to put straight into an <img src>: a full external URL as-is,
        or None when the stored value is a locally uploaded filename (the caller
        should build that path itself, e.g. via Flask's url_for)."""
        if self.image_filename and self.image_filename.startswith(("http://", "https://")):
            return self.image_filename
        return None

    @property
    def is_local_image(self) -> bool:
        return bool(self.image_filename) and self.image_src is None

    def __str__(self) -> str:
        return f"{self.sku} · {self.name}"

    @classmethod
    def from_row(cls, row: Mapping[str, Any] | None) -> "Product | None":
        if row is None:
            return None
        return cls(
            id=row["id"],
            sku=row["sku"],
            name=row["name"],
            price=row["price"],
            barcode=row.get("barcode") or None,
            cost=row.get("cost") or 0,
            quantity_in_stock=row.get("quantity_in_stock") or 0,
            low_stock_threshold=row.get("low_stock_threshold") or 0,
            category_id=row.get("category_id"),
            category_name=row.get("category_name"),
            category_icon=row.get("category_icon"),
            supplier_id=row.get("supplier_id"),
            supplier_name=row.get("supplier_name"),
            image_filename=row.get("image_filename"),
            created_at=row.get("created_at"),
        )
