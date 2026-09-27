"""
Dual-currency (USD / Khmer Riel) tender objects.

All prices are kept in USD. Cash can be handed over in USD, in KHR or in a
mix of both; change can be given back in either currency. Riel amounts are
rounded to the nearest 100 ៛ because smaller riel notes are not in use.
"""
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum

from app.models.base import CENT, to_money

USD_NOTES: tuple[int, ...] = (1, 5, 10, 20, 50, 100)
KHR_NOTES: tuple[int, ...] = (1000, 5000, 10000, 20000, 50000, 100000)


@dataclass(frozen=True)
class ExchangeRate:
    """How many riel one US dollar buys (e.g. 4100)."""

    khr_per_usd: int
    RIEL_STEP = 100

    def __post_init__(self) -> None:
        if not 1000 <= int(self.khr_per_usd) <= 10000:
            raise ValueError("Exchange rate must be between 1,000 and 10,000 riel per dollar.")
        object.__setattr__(self, "khr_per_usd", int(self.khr_per_usd))

    def to_khr(self, usd: Decimal) -> int:
        """USD → riel, rounded to the nearest 100 ៛."""
        riel = Decimal(usd) * self.khr_per_usd / self.RIEL_STEP
        return int(riel.quantize(Decimal(1), rounding=ROUND_HALF_UP)) * self.RIEL_STEP

    def to_usd(self, khr: int) -> Decimal:
        """Riel → USD (2 dp)."""
        return (Decimal(int(khr)) / self.khr_per_usd).quantize(CENT, rounding=ROUND_HALF_UP)

    def __str__(self) -> str:
        return f"$1 = {self.khr_per_usd:,} ៛"


class CurrencyMode(Enum):
    USD = "usd"
    KHR = "khr"
    MIXED = "mixed"

    @property
    def label(self) -> str:
        return {"usd": "US Dollar", "khr": "Khmer Riel", "mixed": "USD + Riel"}[self.value]


class ChangeCurrency(Enum):
    USD = "usd"
    KHR = "khr"


@dataclass(frozen=True)
class CashTender:
    """The notes a customer hands over."""

    mode: CurrencyMode
    usd: Decimal
    khr: int
    rate: ExchangeRate

    def __post_init__(self) -> None:
        object.__setattr__(self, "usd", to_money(self.usd))
        object.__setattr__(self, "khr", int(self.khr or 0))
        if self.usd < 0 or self.khr < 0:
            raise ValueError("Cash amounts cannot be negative.")
        if self.mode is CurrencyMode.USD and self.khr:
            object.__setattr__(self, "khr", 0)
        if self.mode is CurrencyMode.KHR and self.usd:
            object.__setattr__(self, "usd", Decimal("0.00"))

    @property
    def paid_usd(self) -> Decimal:
        """Everything handed over, expressed in USD."""
        return self.usd + self.rate.to_usd(self.khr)

    def change_for(self, total: Decimal, currency: ChangeCurrency) -> "Change":
        """Work out the change, or raise ValueError when the customer paid too little."""
        total = to_money(total)
        if self.paid_usd < total:
            short = total - self.paid_usd
            raise ValueError(f"Cash received is short by ${short:.2f} ({self.rate.to_khr(short):,} ៛).")
        change_usd = self.paid_usd - total
        if currency is ChangeCurrency.KHR:
            return Change(currency, change_usd, self.rate.to_khr(change_usd))
        return Change(currency, change_usd, 0)


@dataclass(frozen=True)
class Change:
    """Change handed back to the customer."""

    currency: ChangeCurrency
    usd: Decimal
    khr: int

    @property
    def display(self) -> str:
        if self.currency is ChangeCurrency.KHR:
            return f"{self.khr:,} ៛"
        return f"${self.usd:.2f}"


class Bank:
    """One entry in the KHQR bank-picker (static reference data, not a DB table)."""

    __slots__ = ("code", "name", "logo")

    def __init__(self, code: str, name: str, logo: str) -> None:
        self.code, self.name, self.logo = code, name, logo


class CardBrand:
    """One entry in the credit/debit card-brand picker."""

    __slots__ = ("code", "name", "logo")

    def __init__(self, code: str, name: str, logo: str) -> None:
        self.code, self.name, self.logo = code, name, logo


#: Cambodian banks offered on the KHQR payment screen. ``logo`` is a path under
#: app/static/img/banks/ (stylised badges in each bank's real brand colours).
BANKS: list[Bank] = [
    Bank("aba", "ABA Bank", "img/banks/aba.svg"),
    Bank("wing", "Wing Bank", "img/banks/wing.svg"),
    Bank("acleda", "ACLEDA Bank", "img/banks/acleda.svg"),
    Bank("canadia", "Canadia Bank", "img/banks/canadia.svg"),
    Bank("chipmong", "Chip Mong Bank", "img/banks/chipmong.svg"),
    Bank("prince", "Prince Bank", "img/banks/prince.svg"),
    Bank("sathapana", "Sathapana Bank", "img/banks/sathapana.svg"),
    Bank("cpb", "Cambodia Post Bank", "img/banks/cpb.svg"),
    Bank("vattanac", "Vattanac Bank", "img/banks/vattanac.svg"),
]

#: Card brands offered on the Credit/Debit Card payment screen.
CARD_BRANDS: list[CardBrand] = [
    CardBrand("visa", "Visa", "img/cards/visa.svg"),
    CardBrand("mastercard", "Mastercard", "img/cards/mastercard.svg"),
    CardBrand("amex", "American Express", "img/cards/amex.svg"),
]
