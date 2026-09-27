"""
Request-parsing helpers.

Routes use the ``*Input.from_form()`` classes in this package to turn raw
form strings into typed values. Anything unparseable raises ValueError
with a friendly message; the route catches it and flashes it. Business
rules (e.g. "price must be > 0", "SKU must be unique") are NOT checked
here — they belong to the domain models and services.
"""
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any, Mapping


class FormReader:
    """Typed accessors over a Flask ``request.form`` / ``request.args`` mapping."""

    def __init__(self, data: Mapping[str, Any]) -> None:
        self._data = data

    def text(self, key: str, default: str = "") -> str:
        return (self._data.get(key) or default).strip()

    def required(self, key: str, label: str) -> str:
        value = self.text(key)
        if not value:
            raise ValueError(f"{label} is required.")
        return value

    def decimal(self, key: str, label: str, default: str = "0") -> Decimal:
        raw = self.text(key) or default
        try:
            return Decimal(raw)
        except InvalidOperation:
            raise ValueError(f"{label} must be a number.") from None

    def integer(self, key: str, label: str, default: int = 0) -> int:
        raw = self.text(key)
        if not raw:
            return default
        try:
            return int(raw)
        except ValueError:
            raise ValueError(f"{label} must be a whole number.") from None

    def optional_int(self, key: str) -> int | None:
        raw = self.text(key)
        return int(raw) if raw.isdigit() else None

    def checkbox(self, key: str) -> bool:
        return self._data.get(key) in ("on", "1", "true", "yes")

    def int_list(self, key: str) -> list[int]:
        getter = getattr(self._data, "getlist", None)
        values = getter(key) if getter else []
        return [int(v) for v in values if str(v).isdigit()]

    def optional_decimal(self, key: str, label: str) -> Decimal | None:
        return self.decimal(key, label) if self.text(key) else None

    def optional_date(self, key: str, label: str) -> date | None:
        raw = self.text(key)
        if not raw:
            return None
        try:
            return date.fromisoformat(raw)
        except ValueError:
            raise ValueError(f"{label} must be a valid date.") from None

    def list_of(self, key: str) -> list[str]:
        getter = getattr(self._data, "getlist", None)
        return [str(v).strip() for v in (getter(key) if getter else [])]
