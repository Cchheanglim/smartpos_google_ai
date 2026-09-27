"""
Shopping cart domain objects used at checkout.

The cart is not a database table — it lives in the user's session as a
``{product_id: {"qty": n, "note": "..."}}`` mapping. ``Cart`` rebuilds rich
``CartLine`` objects from that mapping and owns every pricing rule
(manual discount, member discount, points redemption, tax), so the maths is
written once and is unit-testable without Flask or MySQL.
"""
from dataclasses import dataclass, field
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from typing import Iterator

from app.models.base import CENT, to_money
from app.models.inventory.product import Product


def _pct(amount: Decimal, percent: Decimal) -> Decimal:
    return (amount * percent / Decimal(100)).quantize(CENT, rounding=ROUND_HALF_UP)


class DiscountType(Enum):
    PERCENT = "percent"
    FIXED = "fixed"


@dataclass(frozen=True)
class Discount:
    """
    A manual cart discount, either a percentage or a fixed dollar amount.

    Value object: validated on creation and never mutated.
    """

    kind: DiscountType = DiscountType.PERCENT
    value: Decimal = Decimal("0")

    MAX_PERCENT = Decimal(50)

    def __post_init__(self) -> None:
        object.__setattr__(self, "value", Decimal(str(self.value or 0)))
        if self.value < 0:
            raise ValueError("Discount cannot be negative.")
        if self.kind is DiscountType.PERCENT and self.value > self.MAX_PERCENT:
            raise ValueError(f"A percentage discount cannot exceed {self.MAX_PERCENT}%.")

    @classmethod
    def none(cls) -> "Discount":
        return cls()

    def amount_for(self, subtotal: Decimal) -> Decimal:
        """Dollar amount taken off ``subtotal`` (a fixed discount is capped at the subtotal)."""
        if self.kind is DiscountType.PERCENT:
            return _pct(subtotal, self.value)
        return min(to_money(self.value), subtotal)

    def __bool__(self) -> bool:
        return self.value > 0

    def __str__(self) -> str:
        if self.kind is DiscountType.PERCENT:
            return f"{self.value.normalize():f}%"
        return f"${to_money(self.value)}"


@dataclass
class CartLine:
    """One product in the cart, with an optional note ("no ice", "gift wrap")."""

    product: Product
    quantity: int
    note: str = ""

    @property
    def line_total(self) -> Decimal:
        return (self.product.price * self.quantity).quantize(CENT)

    @property
    def exceeds_stock(self) -> bool:
        return self.quantity > self.product.quantity_in_stock


@dataclass(frozen=True)
class PricingSummary:
    """Immutable result of pricing a cart (all amounts in USD)."""

    subtotal: Decimal
    discount: Discount
    discount_amount: Decimal
    member_discount_percent: Decimal
    member_discount_amount: Decimal
    points_redeemed: int
    points_discount: Decimal
    tax_percent: Decimal
    tax_amount: Decimal
    total: Decimal
    item_count: int

    @property
    def total_savings(self) -> Decimal:
        return self.discount_amount + self.member_discount_amount + self.points_discount

    @property
    def before_points(self) -> Decimal:
        """Amount left after the manual and member discounts (the cap for point redemption)."""
        return self.subtotal - self.discount_amount - self.member_discount_amount


@dataclass
class Cart:
    """A list of cart lines plus the pricing rules."""

    lines: list[CartLine] = field(default_factory=list)

    def __iter__(self) -> Iterator[CartLine]:
        return iter(self.lines)

    def __len__(self) -> int:
        return len(self.lines)

    def __bool__(self) -> bool:
        return bool(self.lines)

    @property
    def item_count(self) -> int:
        return sum(line.quantity for line in self.lines)

    @property
    def subtotal(self) -> Decimal:
        return sum((line.line_total for line in self.lines), Decimal("0.00"))

    def price(self, discount: Discount | None = None,
              member_discount_percent: Decimal = Decimal(0),
              points_redeemed: int = 0,
              point_value: Decimal = Decimal("0.05"),
              tax_percent: Decimal = Decimal(0)) -> PricingSummary:
        """
        Price the cart. Order of operations:
        subtotal → manual discount → member tier discount → points redemption → tax.
        Points can never push the total below zero.
        """
        discount = discount or Discount.none()
        member_discount_percent = Decimal(str(member_discount_percent))
        tax_percent = Decimal(str(tax_percent))
        if not (0 <= tax_percent <= 100):
            raise ValueError("Tax must be between 0% and 100%.")
        if points_redeemed < 0:
            raise ValueError("Points to redeem cannot be negative.")

        subtotal = to_money(self.subtotal)
        discount_amount = discount.amount_for(subtotal)
        after_discount = subtotal - discount_amount
        member_amount = _pct(after_discount, member_discount_percent)
        after_member = after_discount - member_amount
        points_discount = min(to_money(point_value * points_redeemed), after_member)
        taxable = after_member - points_discount
        tax_amount = _pct(taxable, tax_percent)
        return PricingSummary(
            subtotal=subtotal, discount=discount, discount_amount=discount_amount,
            member_discount_percent=member_discount_percent, member_discount_amount=member_amount,
            points_redeemed=points_redeemed, points_discount=points_discount,
            tax_percent=tax_percent, tax_amount=tax_amount,
            total=to_money(taxable + tax_amount), item_count=self.item_count,
        )
