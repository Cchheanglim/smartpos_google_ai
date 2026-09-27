"""Typed inputs for the inventory module (products, stock, categories, suppliers)."""
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any, Mapping

from app.forms.base import FormReader
from app.repositories.inventory.product_repository import ProductFilter


@dataclass(frozen=True)
class ProductInput:
    sku: str
    name: str
    category_id: int | None
    supplier_id: int | None
    price: Decimal
    cost: Decimal
    quantity_in_stock: int
    low_stock_threshold: int
    barcode: str = ""

    @classmethod
    def from_form(cls, form: Mapping[str, Any]) -> "ProductInput":
        f = FormReader(form)
        return cls(
            sku=f.text("sku").upper(),
            name=f.required("name", "Product name"),
            category_id=f.optional_int("category_id"),
            supplier_id=f.optional_int("supplier_id"),
            price=f.decimal("price", "Selling price"),
            cost=f.decimal("cost", "Cost price"),
            quantity_in_stock=f.integer("quantity_in_stock", "Opening stock"),
            low_stock_threshold=f.integer("low_stock_threshold", "Low-stock threshold", default=5),
            barcode="".join(ch for ch in f.text("barcode") if ch.isdigit()),
        )


def product_filter_from_args(args: Mapping[str, Any], per_page: int) -> ProductFilter:
    f = FormReader(args)
    return ProductFilter(
        search=f.text("q"),
        category_id=f.optional_int("category_id"),
        supplier_id=f.optional_int("supplier_id"),
        stock=f.text("stock"),
        sort=f.text("sort") or "name",
        page=max(f.integer("page", "Page", default=1), 1),
        per_page=per_page,
    )


@dataclass(frozen=True)
class StockAdjustmentInput:
    direction: str      # "in" or "out"
    quantity: int
    reason: str
    note: str

    @property
    def signed_change(self) -> int:
        return self.quantity if self.direction == "in" else -self.quantity

    @classmethod
    def from_form(cls, form: Mapping[str, Any]) -> "StockAdjustmentInput":
        f = FormReader(form)
        reason = f.text("reason") or "count_adjustment"
        direction = f.text("direction")
        if direction not in ("in", "out"):
            # Waste reasons (damaged, breakage, ...) always remove stock.
            direction = "out" if reason in ("damaged", "breakage", "supplier_return", "internal_use") else "in"
        return cls(
            direction=direction,
            quantity=f.integer("quantity", "Quantity"),
            reason=reason,
            note=f.text("note")[:255],
        )


@dataclass(frozen=True)
class CategoryInput:
    name: str
    description: str
    icon: str

    @classmethod
    def from_form(cls, form: Mapping[str, Any]) -> "CategoryInput":
        f = FormReader(form)
        return cls(name=f.required("name", "Category name"), description=f.text("description"),
                   icon=f.text("icon") or "fa-box")


@dataclass(frozen=True)
class SupplierInput:
    name: str
    contact_name: str
    phone: str
    email: str
    address: str

    @classmethod
    def from_form(cls, form: Mapping[str, Any]) -> "SupplierInput":
        f = FormReader(form)
        return cls(name=f.required("name", "Supplier name"), contact_name=f.text("contact_name"),
                   phone=f.text("phone"), email=f.text("email").lower(), address=f.text("address"))


@dataclass(frozen=True)
class POLineInput:
    product_id: int
    quantity: int
    unit_cost: Decimal


@dataclass(frozen=True)
class PurchaseOrderInput:
    """Header + product lines posted by the purchase-order form.

    Lines arrive as parallel lists ``line_product``, ``line_qty`` and
    ``line_cost``; blank rows are skipped.
    """

    supplier_id: int | None
    expected_date: "date | None"
    notes: str
    lines: list[POLineInput]

    @classmethod
    def from_form(cls, form: Mapping[str, Any]) -> "PurchaseOrderInput":
        f = FormReader(form)
        products, qtys, costs = f.list_of("line_product"), f.list_of("line_qty"), f.list_of("line_cost")
        lines = []
        for index, product in enumerate(products):
            if not product.isdigit():
                continue
            qty = qtys[index] if index < len(qtys) else ""
            cost = costs[index] if index < len(costs) else ""
            try:
                quantity = int(qty or 0)
            except ValueError:
                raise ValueError(f"Line {index + 1}: quantity must be a whole number.") from None
            if quantity <= 0:
                continue  # not ordering this product — a 0 quantity is not an error
            try:
                lines.append(POLineInput(int(product), quantity, Decimal(cost or "0")))
            except (ValueError, ArithmeticError):
                raise ValueError(f"Line {index + 1}: quantity and cost must be numbers.") from None
        return cls(supplier_id=f.optional_int("supplier_id"),
                   expected_date=f.optional_date("expected_date", "Expected delivery date"),
                   notes=f.text("notes"), lines=lines)
