"""Small, pure formatting helpers registered as Jinja2 filters."""
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from flask import current_app


def money(value: Any) -> str:
    """Format a number as US dollars, e.g. 1234.5 -> '$1,234.50'."""
    try:
        amount = Decimal(str(value or 0))
    except Exception:
        return "$0.00"
    sign = "-" if amount < 0 else ""
    return f"{sign}${abs(amount):,.2f}"


def khr(value: Any) -> str:
    """Convert a USD amount to Cambodian Riel for display only."""
    rate = current_app.config.get("KHR_EXCHANGE_RATE", 4100)
    try:
        riel = Decimal(str(value or 0)) * rate
    except Exception:
        riel = Decimal(0)
    # Riel is normally rounded to the nearest 100.
    rounded = int((riel / 100).quantize(Decimal("1")) * 100)
    return f"{rounded:,}៛"


def datetime_short(value: Any) -> str:
    """Render a datetime as '23 Sep 2026, 14:05'."""
    if isinstance(value, datetime):
        return value.strftime("%d %b %Y, %H:%M")
    if isinstance(value, date):
        return value.strftime("%d %b %Y")
    return str(value or "")


def riel(value: Any) -> str:
    """Format an already-computed riel amount (int), e.g. 41000 -> '41,000៛'."""
    try:
        amount = int(value or 0)
    except Exception:
        amount = 0
    return f"{amount:,}៛"
