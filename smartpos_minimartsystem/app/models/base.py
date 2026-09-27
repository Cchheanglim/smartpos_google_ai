"""Shared helpers for the plain-Python domain models (POPOs)."""
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

CENT = Decimal("0.01")


def to_money(value: Any) -> Decimal:
    """Convert DB/user values (Decimal, float, str, None) to a 2-dp Decimal."""
    if value is None or value == "":
        return Decimal("0.00")
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)
