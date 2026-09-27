"""Sale and SaleItem domain models."""
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Mapping

from app.models.base import to_money
from app.models.sales.tender import BANKS, CARD_BRANDS, ChangeCurrency, CurrencyMode


class PaymentMethod(Enum):
    CASH = "cash"
    KHQR = "khqr"
    CARD = "card"
    SPLIT = "split"

    @property
    def label(self) -> str:
        return {"cash": "Cash", "khqr": "ABA PAY / KHQR", "card": "Credit / Debit Card",
                "split": "Split / Mixed"}[self.value]

    @property
    def icon(self) -> str:
        return {"cash": "fa-money-bill-wave", "khqr": "fa-qrcode", "card": "fa-credit-card",
                "split": "fa-layer-group"}[self.value]

    @property
    def is_cash(self) -> bool:
        return self in (PaymentMethod.CASH, PaymentMethod.SPLIT)

    @property
    def has_cash_component(self) -> bool:
        return self in (PaymentMethod.CASH, PaymentMethod.SPLIT)


@dataclass
class SaleItem:
    id: int | None
    sale_id: int | None
    product_id: int
    product_name: str
    quantity: int
    unit_price: Decimal
    unit_cost: Decimal = Decimal("0.00")
    refunded_quantity: int = 0
    note: str = ""

    def __post_init__(self) -> None:
        self.unit_price = to_money(self.unit_price)
        self.unit_cost = to_money(self.unit_cost)

    @property
    def line_total(self) -> Decimal:
        return self.unit_price * self.quantity

    @property
    def refundable_quantity(self) -> int:
        return self.quantity - self.refunded_quantity

    @classmethod
    def from_row(cls, row: Mapping[str, Any] | None) -> "SaleItem | None":
        if row is None:
            return None
        return cls(
            id=row["id"], sale_id=row["sale_id"], product_id=row["product_id"],
            product_name=row["product_name"], quantity=int(row["quantity"]),
            unit_price=row["unit_price"], unit_cost=row.get("unit_cost") or 0,
            refunded_quantity=int(row.get("refunded_quantity") or 0), note=row.get("note") or "",
        )


@dataclass
class Sale:
    """A completed checkout, including how it was paid."""

    id: int | None
    cashier_id: int
    subtotal: Decimal
    total_amount: Decimal
    payment_method: PaymentMethod
    discount_type: str = "percent"
    discount_value: Decimal = Decimal("0")
    discount_amount: Decimal = Decimal("0.00")
    member_discount_amount: Decimal = Decimal("0.00")
    points_redeemed: int = 0
    points_discount: Decimal = Decimal("0.00")
    tax_percent: Decimal = Decimal("0")
    tax_amount: Decimal = Decimal("0.00")
    currency_mode: CurrencyMode | None = None
    cash_usd: Decimal | None = None
    cash_khr: int | None = None
    change_currency: ChangeCurrency | None = None
    change_usd: Decimal | None = None
    change_khr: int | None = None
    exchange_rate: int = 4100
    qr_bank: str | None = None
    card_brand: str | None = None
    split_card_amount: Decimal | None = None
    split_qr_amount: Decimal | None = None
    customer_id: int | None = None
    attendance_id: int | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    points_earned: int = 0
    refunded_amount: Decimal = Decimal("0.00")
    cashier_name: str = ""
    created_at: datetime | None = None
    items: list[SaleItem] = field(default_factory=list)

    MONEY_FIELDS = ("subtotal", "discount_amount", "member_discount_amount", "points_discount",
                    "tax_amount", "total_amount", "refunded_amount")
    OPTIONAL_MONEY_FIELDS = ("split_card_amount", "split_qr_amount")

    def __post_init__(self) -> None:
        for name in self.MONEY_FIELDS:
            setattr(self, name, to_money(getattr(self, name)))
        self.discount_value = Decimal(str(self.discount_value or 0))
        self.tax_percent = Decimal(str(self.tax_percent or 0))
        for name in ("cash_usd", "change_usd", *self.OPTIONAL_MONEY_FIELDS):
            if getattr(self, name) is not None:
                setattr(self, name, to_money(getattr(self, name)))
        if isinstance(self.payment_method, str):
            self.payment_method = PaymentMethod(self.payment_method)
        if isinstance(self.currency_mode, str):
            self.currency_mode = CurrencyMode(self.currency_mode)
        if isinstance(self.change_currency, str):
            self.change_currency = ChangeCurrency(self.change_currency)

    @property
    def receipt_number(self) -> str:
        return f"INV-{self.id:06d}" if self.id else "INV-PENDING"

    @property
    def qr_bank_name(self) -> str:
        return next((b.name for b in BANKS if b.code == self.qr_bank), self.qr_bank or "")

    @property
    def card_brand_name(self) -> str:
        return next((c.name for c in CARD_BRANDS if c.code == self.card_brand), self.card_brand or "")

    @property
    def net_amount(self) -> Decimal:
        return self.total_amount - self.refunded_amount

    @property
    def total_khr(self) -> int:
        from app.models.sales.tender import ExchangeRate
        return ExchangeRate(self.exchange_rate).to_khr(self.total_amount)

    @property
    def cash_paid_usd(self) -> Decimal:
        """USD value of the notes handed over (cash sales only)."""
        if not self.payment_method.is_cash:
            return self.total_amount
        from app.models.sales.tender import ExchangeRate
        return (self.cash_usd or Decimal(0)) + ExchangeRate(self.exchange_rate).to_usd(self.cash_khr or 0)

    @property
    def discount_label(self) -> str:
        if not self.discount_value:
            return ""
        return f"{self.discount_value.normalize():f}%" if self.discount_type == "percent" else "fixed"

    @property
    def total_savings(self) -> Decimal:
        return self.discount_amount + self.member_discount_amount + self.points_discount

    @property
    def is_split(self) -> bool:
        return self.payment_method is PaymentMethod.SPLIT

    @property
    def is_fully_refunded(self) -> bool:
        return bool(self.items) and all(i.refundable_quantity == 0 for i in self.items)

    @property
    def status_label(self) -> str:
        if self.refunded_amount <= 0:
            return "Completed"
        return "Refunded" if self.refunded_amount >= self.total_amount else "Partially refunded"

    @property
    def item_count(self) -> int:
        return sum(i.quantity for i in self.items)

    @property
    def cost_of_goods(self) -> Decimal:
        return sum((i.unit_cost * i.quantity for i in self.items), Decimal("0.00"))

    @classmethod
    def from_row(cls, row: Mapping[str, Any] | None) -> "Sale | None":
        if row is None:
            return None
        return cls(
            id=row["id"], cashier_id=row["cashier_id"], subtotal=row["subtotal"],
            total_amount=row["total_amount"], payment_method=PaymentMethod(row["payment_method"]),
            discount_type=row.get("discount_type") or "percent",
            discount_value=row.get("discount_value") or 0,
            discount_amount=row.get("discount_amount") or 0,
            member_discount_amount=row.get("member_discount_amount") or 0,
            points_redeemed=int(row.get("points_redeemed") or 0),
            points_discount=row.get("points_discount") or 0,
            tax_percent=row.get("tax_percent") or 0, tax_amount=row.get("tax_amount") or 0,
            currency_mode=row.get("currency_mode"), cash_usd=row.get("cash_usd"),
            cash_khr=row.get("cash_khr"), change_currency=row.get("change_currency"),
            change_usd=row.get("change_usd"), change_khr=row.get("change_khr"),
            exchange_rate=int(row.get("exchange_rate") or 4100),
            qr_bank=row.get("qr_bank"), card_brand=row.get("card_brand"),
            split_card_amount=row.get("split_card_amount"), split_qr_amount=row.get("split_qr_amount"),
            customer_id=row.get("customer_id"), attendance_id=row.get("attendance_id"),
            customer_name=row.get("customer_name"), customer_phone=row.get("customer_phone"),
            points_earned=int(row.get("points_earned") or 0),
            refunded_amount=row.get("refunded_amount") or 0,
            cashier_name=row.get("cashier_name") or "", created_at=row.get("created_at"),
        )
