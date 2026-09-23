"""
Customer Domain Entity and CRM Loyalty Tiers
"""

from enum import Enum
from typing import Dict, Any, Optional
from .base import BaseModel


class LoyaltyTier(Enum):
    """Customer membership tiers with corresponding discount privileges."""
    BRONZE = ('Bronze', 0.0, 0, '#8C8889')
    SILVER = ('Silver', 2.0, 100, '#A0AEC0')
    GOLD = ('Gold', 5.0, 300, '#D69E2E')
    VIP = ('VIP', 10.0, 600, '#7D39EB')

    def __init__(self, label: str, discount_rate: float, min_spend: float, color: str):
        self.label = label
        self.discount_rate = discount_rate
        self.min_spend = min_spend
        self.color = color

    @classmethod
    def from_string(cls, name: str) -> 'LoyaltyTier':
        for tier in cls:
            if tier.label.lower() == name.lower() or tier.name.lower() == name.lower():
                return tier
        return cls.BRONZE

    @classmethod
    def determine_tier(cls, total_spent: float) -> 'LoyaltyTier':
        if total_spent >= 600.0:
            return cls.VIP
        if total_spent >= 300.0:
            return cls.GOLD
        if total_spent >= 100.0:
            return cls.SILVER
        return cls.BRONZE


class Customer(BaseModel):
    """Represents a registered store customer with CRM loyalty points."""
    
    def __init__(
        self,
        id: Optional[int],
        name: str,
        phone: str,
        email: str = '',
        tier: str = 'Bronze',
        points: int = 0,
        discount_rate: float = 0.0,
        total_spent: float = 0.0,
        notes: str = '',
        is_active: bool = True
    ):
        super().__init__(id)
        if not name:
            raise ValueError("Customer name cannot be empty.")
        if not phone:
            raise ValueError("Customer phone cannot be empty.")

        self.name = name.strip()
        self.phone = phone.strip()
        self.email = email.strip() if email else ''
        self._tier = LoyaltyTier.from_string(tier)
        self.points = max(0, int(points))
        self.discount_rate = float(discount_rate) if discount_rate else self._tier.discount_rate
        self.total_spent = round(float(total_spent), 2)
        self.notes = notes.strip() if notes else ''
        self.is_active = is_active

    @property
    def tier(self) -> LoyaltyTier:
        return self._tier

    @tier.setter
    def tier(self, value: Any) -> None:
        if isinstance(value, LoyaltyTier):
            self._tier = value
        else:
            self._tier = LoyaltyTier.from_string(str(value))
        self.discount_rate = self._tier.discount_rate

    @property
    def masked_tag(self) -> str:
        """Returns customer identifier tag with masked phone number."""
        if len(self.phone) >= 7:
            return f"{self.name} ({self.phone[:3]}***{self.phone[-3:]})"
        return f"{self.name} ({self.phone})"

    def add_spend(self, amount: float) -> None:
        """Records purchase spend, awards points (1 pt per $1), and recalculates tier."""
        if amount > 0:
            self.total_spent = round(self.total_spent + amount, 2)
            earned_points = int(amount)
            self.points += earned_points
            new_tier = LoyaltyTier.determine_tier(self.total_spent)
            if new_tier != self._tier:
                self.tier = new_tier

    def redeem_points(self, points_to_redeem: int) -> float:
        """
        Redeems points for cash discount ($0.01 per point).
        Returns the discount amount in USD.
        """
        if points_to_redeem <= 0:
            return 0.0
        usable = min(self.points, points_to_redeem)
        self.points -= usable
        return round(usable * 0.01, 2)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'phone': self.phone,
            'email': self.email,
            'tier': self._tier.label,
            'tier_color': self._tier.color,
            'points': self.points,
            'discount_rate': self.discount_rate,
            'total_spent': self.total_spent,
            'masked_tag': self.masked_tag,
            'notes': self.notes,
            'is_active': self.is_active
        }
