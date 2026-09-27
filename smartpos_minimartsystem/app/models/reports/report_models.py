"""Read-only value objects returned by reporting queries."""
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Any, Mapping

from app.models.base import to_money


@dataclass(frozen=True)
class DateRange:
    """Inclusive reporting period with validation."""

    start: date
    end: date

    def __post_init__(self) -> None:
        if self.start > self.end:
            raise ValueError("Start date must be on or before end date.")

    @property
    def days(self) -> int:
        return (self.end - self.start).days + 1


@dataclass(frozen=True)
class SalesSummary:
    transactions: int
    revenue: Decimal
    cost: Decimal
    refunds: Decimal
    discounts: Decimal
    items_sold: int
    refunded_cost: Decimal = Decimal("0.00")

    @property
    def net_revenue(self) -> Decimal:
        return self.revenue - self.refunds

    @property
    def gross_profit(self) -> Decimal:
        """Revenue minus cost of goods sold (COGS)."""
        return self.revenue - self.cost

    @property
    def gross_sales(self) -> Decimal:
        """Sales before any discount: revenue + discounts given."""
        return self.revenue + self.discounts

    @property
    def net_profit(self) -> Decimal:
        """Profit after refunds (refunded goods go back on the shelf, so their cost is recovered)."""
        return (self.revenue - self.refunds) - (self.cost - self.refunded_cost)

    @property
    def average_basket(self) -> Decimal:
        if not self.transactions:
            return Decimal("0.00")
        return to_money(self.revenue / self.transactions)

    @property
    def margin_percent(self) -> Decimal:
        if not self.revenue:
            return Decimal("0.0")
        return (self.gross_profit / self.revenue * 100).quantize(Decimal("0.1"))

    @classmethod
    def from_row(cls, row: Mapping[str, Any] | None) -> "SalesSummary":
        row = row or {}
        return cls(
            transactions=int(row.get("transactions") or 0),
            revenue=to_money(row.get("revenue")),
            cost=to_money(row.get("cost")),
            refunds=to_money(row.get("refunds")),
            discounts=to_money(row.get("discounts")),
            items_sold=int(row.get("items_sold") or 0),
            refunded_cost=to_money(row.get("refunded_cost")),
        )


@dataclass(frozen=True)
class RankedRow:
    """A labelled amount used for top-product / by-category / by-day bars."""

    label: str
    amount: Decimal
    quantity: int = 0

    @classmethod
    def from_row(cls, row: Mapping[str, Any]) -> "RankedRow":
        return cls(label=str(row["label"]), amount=to_money(row.get("amount")),
                   quantity=int(row.get("quantity") or 0))


@dataclass(frozen=True)
class CashierProductivity:
    """Sales and drawer-compliance figures for one staff member."""

    user_id: int
    name: str
    transactions: int
    revenue: Decimal
    shifts: int
    balanced_shifts: int
    variance_total: Decimal

    @property
    def average_ticket(self) -> Decimal:
        return to_money(self.revenue / self.transactions) if self.transactions else Decimal("0.00")

    @property
    def compliance_percent(self) -> int | None:
        """Share of closed shifts whose drawer balanced exactly (None if no closed shifts)."""
        if not self.shifts:
            return None
        return round(self.balanced_shifts * 100 / self.shifts)

    @classmethod
    def from_row(cls, row: Mapping[str, Any]) -> "CashierProductivity":
        return cls(user_id=row["user_id"], name=row["name"], transactions=int(row.get("transactions") or 0),
                   revenue=to_money(row.get("revenue")), shifts=int(row.get("shifts") or 0),
                   balanced_shifts=int(row.get("balanced_shifts") or 0),
                   variance_total=to_money(row.get("variance_total")))
