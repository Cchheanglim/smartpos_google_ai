"""Loyalty customer (CRM) domain model."""
import re
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, Mapping

from app.models.base import to_money


class LoyaltyTier(Enum):
    """Tier ladder: (label, minimum points, member discount %)."""

    BRONZE = ("Bronze", 0, 0)
    SILVER = ("Silver", 100, 3)
    GOLD = ("Gold", 300, 5)
    VIP = ("VIP", 500, 10)

    def __init__(self, label: str, min_points: int, discount_percent: int) -> None:
        self.label = label
        self.min_points = min_points
        self.discount_percent = discount_percent

    @classmethod
    def for_points(cls, points: int) -> "LoyaltyTier":
        """Highest tier whose threshold ``points`` has reached."""
        best = cls.BRONZE
        for tier in cls:
            if points >= tier.min_points:
                best = tier
        return best


@dataclass
class Customer:
    """A registered loyalty member, identified by phone number."""

    POINTS_PER_DOLLAR = 1
    POINT_VALUE = Decimal("0.05")        # 1 point = 5 cents off
    MIN_REDEEM_POINTS = 20
    PHONE_PATTERN = re.compile(r"^0\d{8,9}$")

    id: int | None
    phone: str
    name: str
    points: int = 0
    total_spent: Decimal = Decimal("0.00")
    notes: str = ""
    created_at: datetime | None = None

    def __post_init__(self) -> None:
        self.phone = self.normalize_phone(self.phone)
        self.total_spent = to_money(self.total_spent)
        self.points = int(self.points or 0)

    @staticmethod
    def normalize_phone(raw: str | None) -> str:
        """Strip spaces/dashes so '012 345 678' and '012-345-678' match."""
        return re.sub(r"[\s\-()]", "", raw or "")

    def validate(self) -> None:
        if not self.name.strip():
            raise ValueError("Customer name is required.")
        if not self.PHONE_PATTERN.match(self.phone):
            raise ValueError("Phone must be a Cambodian number like 012345678 (9–10 digits, starting with 0).")
        if self.points < 0:
            raise ValueError("Points cannot be negative.")

    @property
    def tier(self) -> LoyaltyTier:
        return LoyaltyTier.for_points(self.points)

    @property
    def discount_percent(self) -> int:
        return self.tier.discount_percent

    @property
    def masked_phone(self) -> str:
        """Privacy-friendly display: 012***678."""
        if len(self.phone) < 6:
            return self.phone
        return f"{self.phone[:3]}***{self.phone[-3:]}"

    @classmethod
    def points_for(cls, amount: Decimal) -> int:
        """Loyalty points earned for spending ``amount`` dollars."""
        return int(amount) * cls.POINTS_PER_DOLLAR

    @property
    def points_value(self) -> Decimal:
        """Dollar value of the whole points balance."""
        return self.POINT_VALUE * self.points

    @property
    def can_redeem(self) -> bool:
        return self.points >= self.MIN_REDEEM_POINTS

    def max_redeemable(self, amount_due: Decimal) -> int:
        """Most points usable on a bill of ``amount_due`` dollars."""
        if not self.can_redeem:
            return 0
        return min(self.points, int(Decimal(amount_due) / self.POINT_VALUE))

    def check_redemption(self, points: int, amount_due: Decimal) -> None:
        """Raise ValueError unless ``points`` may be redeemed against ``amount_due``."""
        if points == 0:
            return
        if points < self.MIN_REDEEM_POINTS:
            raise ValueError(f"At least {self.MIN_REDEEM_POINTS} points are needed to redeem.")
        if points > self.points:
            raise ValueError(f"{self.name} only has {self.points} points.")
        if points > self.max_redeemable(amount_due):
            raise ValueError(f"At most {self.max_redeemable(amount_due)} points can be used on this bill.")

    @classmethod
    def from_row(cls, row: Mapping[str, Any] | None) -> "Customer | None":
        if row is None:
            return None
        return cls(
            id=row["id"],
            phone=row["phone"],
            name=row["name"],
            points=row.get("points") or 0,
            total_spent=row.get("total_spent") or 0,
            notes=row.get("notes") or "",
            created_at=row.get("created_at"),
        )
