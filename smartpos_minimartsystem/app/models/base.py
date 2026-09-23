"""
Base Domain Model and Value Objects
Defines common model protocols, serialization helpers, and currency Value Objects.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, Optional


class BaseModel(ABC):
    """Abstract base class for all SmartPOS domain entities."""
    
    def __init__(self, id: Optional[int] = None, created_at: Optional[datetime] = None):
        self._id = id
        self._created_at = created_at or datetime.now()

    @property
    def id(self) -> Optional[int]:
        """Unique entity identifier."""
        return self._id

    @id.setter
    def id(self, value: int) -> None:
        if self._id is not None and self._id != value:
            raise ValueError("Entity identifier cannot be reassigned once established.")
        self._id = int(value)

    @property
    def created_at(self) -> datetime:
        """Timestamp when entity was created."""
        return self._created_at

    @abstractmethod
    def to_dict(self) -> Dict[str, Any]:
        """Serializes domain model attributes to a standard dictionary."""
        pass

    def __eq__(self, other: object) -> bool:
        """Entities are equal if they have the same type and non-null ID."""
        if not isinstance(other, self.__class__):
            return False
        if self.id is None or other.id is None:
            return False
        return self.id == other.id

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(id={self.id})>"


@dataclass(frozen=True)
class Money:
    """
    Immutable Value Object representing an amount of money in USD.
    Provides precise financial arithmetic and Cambodian Riel (KHR) conversion.
    """
    amount: Decimal
    currency: str = 'USD'
    
    def __post_init__(self):
        if not isinstance(self.amount, Decimal):
            object.__setattr__(self, 'amount', Decimal(str(self.amount)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
        else:
            object.__setattr__(self, 'amount', self.amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))

    @classmethod
    def from_float(cls, value: float) -> 'Money':
        """Constructs Money from a floating-point number safely."""
        return cls(amount=Decimal(str(round(value, 2))))

    def to_khr(self, exchange_rate: float = 4100.0) -> int:
        """Converts USD amount to Cambodian Riel rounded to nearest 100 Riels."""
        khr = float(self.amount) * exchange_rate
        return int(round(khr / 100.0) * 100)

    def __add__(self, other: 'Money') -> 'Money':
        if not isinstance(other, Money) or self.currency != other.currency:
            raise TypeError("Cannot add money of different currencies or types.")
        return Money(self.amount + other.amount, self.currency)

    def __sub__(self, other: 'Money') -> 'Money':
        if not isinstance(other, Money) or self.currency != other.currency:
            raise TypeError("Cannot subtract money of different currencies or types.")
        return Money(self.amount - other.amount, self.currency)

    def __mul__(self, factor: float) -> 'Money':
        return Money(self.amount * Decimal(str(factor)), self.currency)

    def __str__(self) -> str:
        return f"${float(self.amount):.2f}"

    def __float__(self) -> float:
        return float(self.amount)
