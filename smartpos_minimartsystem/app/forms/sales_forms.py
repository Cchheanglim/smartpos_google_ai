"""Typed inputs for checkout, refunds, sales history and customers."""
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any, Mapping

from app.forms.base import FormReader


@dataclass(frozen=True)
class CheckoutInput:
    """Everything the tender panel posts when a sale is completed."""

    customer_phone: str
    discount_type: str
    discount_value: Decimal
    points_to_redeem: int
    payment_method: str
    currency_mode: str = "usd"
    cash_usd: Decimal = Decimal("0")
    cash_khr: int = 0
    change_currency: str = "usd"
    qr_bank: str = ""
    card_brand: str = ""
    split_card_amount: Decimal = Decimal("0")
    split_qr_amount: Decimal = Decimal("0")

    @classmethod
    def from_form(cls, form: Mapping[str, Any]) -> "CheckoutInput":
        f = FormReader(form)
        return cls(
            customer_phone=f.text("customer_phone"),
            discount_type="fixed" if f.text("discount_type") == "fixed" else "percent",
            discount_value=f.decimal("discount_value", "Discount"),
            points_to_redeem=f.integer("points_to_redeem", "Points to redeem"),
            payment_method=f.text("payment_method") or "cash",
            currency_mode=f.text("currency_mode") or "usd",
            cash_usd=f.decimal("cash_usd", "Cash (USD)"),
            cash_khr=f.integer("cash_khr", "Cash (KHR)"),
            change_currency="khr" if f.text("change_currency") == "khr" else "usd",
            qr_bank=f.text("qr_bank"), card_brand=f.text("card_brand"),
            split_card_amount=f.decimal("split_card_amount", "Card portion"),
            split_qr_amount=f.decimal("split_qr_amount", "QR portion"),
        )


@dataclass(frozen=True)
class CartLineInput:
    product_id: int
    quantity: int
    note: str

    @classmethod
    def from_form(cls, form: Mapping[str, Any]) -> "CartLineInput":
        f = FormReader(form)
        return cls(product_id=f.integer("product_id", "Product"), quantity=f.integer("quantity", "Quantity", 1),
                   note=f.text("note")[:120])


@dataclass(frozen=True)
class RefundInput:
    quantities: dict[int, int]     # sale_item_id -> quantity to refund
    reason: str

    @classmethod
    def from_form(cls, form: Mapping[str, Any]) -> "RefundInput":
        f = FormReader(form)
        quantities: dict[int, int] = {}
        for key in form.keys():
            if key.startswith("qty_"):
                item_id = key[4:]
                qty = f.integer(key, "Refund quantity")
                if item_id.isdigit() and qty > 0:
                    quantities[int(item_id)] = qty
        return cls(quantities=quantities, reason=f.required("reason", "Refund reason")[:255])


@dataclass(frozen=True)
class SalesFilterInput:
    term: str = ""
    start: date | None = None
    end: date | None = None
    payment_method: str = ""
    cashier_id: int | None = None

    @classmethod
    def from_args(cls, args: Mapping[str, Any]) -> "SalesFilterInput":
        f = FormReader(args)
        return cls(term=f.text("q"), start=_parse_date(f.text("start")),
                   end=_parse_date(f.text("end")), payment_method=f.text("payment_method"),
                   cashier_id=f.optional_int("cashier_id"))


def _parse_date(raw: str) -> date | None:
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError:
        raise ValueError("Dates must be in YYYY-MM-DD format.") from None


@dataclass(frozen=True)
class CustomerInput:
    phone: str
    name: str
    notes: str
    points: int | None      # only honoured for users with adjust_loyalty_points

    @classmethod
    def from_form(cls, form: Mapping[str, Any]) -> "CustomerInput":
        f = FormReader(form)
        return cls(phone=f.required("phone", "Phone"), name=f.required("name", "Name"),
                   notes=f.text("notes")[:255],
                   points=f.integer("points", "Points") if f.text("points") else None)


def date_range_from_args(args: Mapping[str, Any]) -> tuple[date | None, date | None]:
    f = FormReader(args)
    return _parse_date(f.text("start")), _parse_date(f.text("end"))
