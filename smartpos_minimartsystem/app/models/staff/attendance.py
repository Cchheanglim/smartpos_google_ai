"""Shift attendance and cash-drawer reconciliation models."""
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Mapping

from app.models.base import to_money


class DrawerStatus(Enum):
    """Outcome of counting the drawer at the end of a shift."""

    BALANCED = ("Balanced", "badge-ok")
    OVERAGE = ("Overage", "badge-warn")
    SHORTAGE = ("Shortage", "badge-low")

    def __init__(self, label: str, css: str) -> None:
        self.label = label
        self.css = css

    @classmethod
    def for_difference(cls, difference: Decimal, tolerance: Decimal = Decimal("0.00")) -> "DrawerStatus":
        if difference > tolerance:
            return cls.OVERAGE
        if difference < -tolerance:
            return cls.SHORTAGE
        return cls.BALANCED


class CashMovementKind(Enum):
    FLOAT = ("float", "Opening float")
    SALE = ("sale", "Cash sale")
    REFUND = ("refund", "Cash refund")
    CASH_IN = ("cash_in", "Cash added")
    CASH_OUT = ("cash_out", "Cash removed")

    def __new__(cls, value: str, label: str) -> "CashMovementKind":
        obj = object.__new__(cls)
        obj._value_ = value
        obj.label = label
        return obj


@dataclass(frozen=True)
class CashMovement:
    """One append-only line in a drawer's cash log (signed USD amount)."""

    id: int | None
    attendance_id: int
    kind: CashMovementKind
    amount: Decimal
    reference: str = ""
    created_by_name: str = ""
    created_at: datetime | None = None

    @classmethod
    def from_row(cls, row: Mapping[str, Any] | None) -> "CashMovement | None":
        if row is None:
            return None
        return cls(id=row["id"], attendance_id=row["attendance_id"], kind=CashMovementKind(row["kind"]),
                   amount=to_money(row["amount"]), reference=row.get("reference") or "",
                   created_by_name=row.get("created_by_name") or "", created_at=row.get("created_at"))


@dataclass
class AttendanceSession:
    """
    One clock-in → clock-out shift for a staff member, with the cash drawer
    they were responsible for. Once closed it is read-only.
    """

    id: int | None
    user_id: int
    clock_in: datetime | None = None
    clock_out: datetime | None = None
    opening_float: Decimal = Decimal("0.00")
    expected_cash: Decimal | None = None
    counted_cash: Decimal | None = None
    cash_difference: Decimal | None = None
    notes: str = ""
    user_name: str = ""
    closed_by_name: str = ""
    drawer_balance: Decimal = Decimal("0.00")   # live sum of cash movements (open shifts)
    sale_count: int = 0

    MAX_FLOAT = Decimal("10000")

    def __post_init__(self) -> None:
        self.opening_float = to_money(self.opening_float)
        self.drawer_balance = to_money(self.drawer_balance)
        for name in ("expected_cash", "counted_cash", "cash_difference"):
            if getattr(self, name) is not None:
                setattr(self, name, to_money(getattr(self, name)))

    @classmethod
    def check_float(cls, amount: Decimal) -> None:
        if amount < 0:
            raise ValueError("Opening float cannot be negative.")
        if amount > cls.MAX_FLOAT:
            raise ValueError(f"Opening float cannot exceed ${cls.MAX_FLOAT:,.0f}.")

    @property
    def is_open(self) -> bool:
        return self.clock_out is None

    @property
    def duration_hours(self) -> Decimal:
        if not self.clock_in:
            return Decimal("0")
        end = self.clock_out or datetime.now()
        return Decimal((end - self.clock_in).total_seconds() / 3600).quantize(Decimal("0.1"))

    @property
    def status(self) -> DrawerStatus | None:
        if self.cash_difference is None:
            return None
        return DrawerStatus.for_difference(self.cash_difference)

    def close(self, expected: Decimal, counted: Decimal) -> DrawerStatus:
        """Record the drawer count; returns Balanced / Overage / Shortage."""
        if not self.is_open:
            raise ValueError("This shift is already closed.")
        counted = to_money(counted)
        if counted < 0:
            raise ValueError("Counted cash cannot be negative.")
        self.expected_cash = to_money(expected)
        self.counted_cash = counted
        self.cash_difference = counted - self.expected_cash
        self.clock_out = datetime.now()
        return DrawerStatus.for_difference(self.cash_difference)

    @classmethod
    def from_row(cls, row: Mapping[str, Any] | None) -> "AttendanceSession | None":
        if row is None:
            return None
        return cls(
            id=row["id"], user_id=row["user_id"], clock_in=row.get("clock_in"), clock_out=row.get("clock_out"),
            opening_float=row.get("opening_float") or 0, expected_cash=row.get("expected_cash"),
            counted_cash=row.get("counted_cash"), cash_difference=row.get("cash_difference"),
            notes=row.get("notes") or "", user_name=row.get("user_name") or "",
            closed_by_name=row.get("closed_by_name") or "",
            drawer_balance=row.get("drawer_balance") or 0, sale_count=int(row.get("sale_count") or 0),
        )
