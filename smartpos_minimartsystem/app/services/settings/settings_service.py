"""Runtime store settings: USD→KHR exchange rate and default tax."""
from decimal import Decimal

from flask import current_app, has_app_context

from app.models.sales.tender import ExchangeRate
from app.repositories.settings.settings_repository import SettingsRepository
from app.repositories.staff.audit_repository import AuditRepository


class SettingsService:
    RATE_KEY = "khr_exchange_rate"
    TAX_KEY = "default_tax_percent"

    def __init__(self, settings_repo: SettingsRepository | None = None,
                 audit_repo: AuditRepository | None = None) -> None:
        self.settings_repo = settings_repo or SettingsRepository()
        self.audit_repo = audit_repo or AuditRepository()

    @staticmethod
    def _config(name: str, default):
        return current_app.config.get(name, default) if has_app_context() else default

    def exchange_rate(self) -> ExchangeRate:
        if not has_app_context():
            return ExchangeRate(int(self._config("KHR_EXCHANGE_RATE", 4100)))
        stored = self.settings_repo.get(self.RATE_KEY)
        value = int(stored) if stored and stored.isdigit() else int(self._config("KHR_EXCHANGE_RATE", 4100))
        return ExchangeRate(value)

    def tax_percent(self) -> Decimal:
        if not has_app_context():
            return Decimal(str(self._config("DEFAULT_TAX_PERCENT", 0)))
        stored = self.settings_repo.get(self.TAX_KEY)
        return Decimal(stored) if stored else Decimal(str(self._config("DEFAULT_TAX_PERCENT", 0)))

    def update_exchange_rate(self, value: int, user_id: int) -> ExchangeRate:
        """Validate and store a new rate; the change is written to the audit log."""
        old = self.exchange_rate()
        rate = ExchangeRate(value)                      # raises ValueError when out of range
        self.settings_repo.set(self.RATE_KEY, str(rate.khr_per_usd), user_id)
        self.audit_repo.record(user_id, "settings.exchange_rate",
                               f"{old.khr_per_usd:,} ៛ → {rate.khr_per_usd:,} ៛ per USD")
        return rate

    def update_tax_percent(self, value: Decimal, user_id: int) -> Decimal:
        if not Decimal(0) <= value <= Decimal(30):
            raise ValueError("Tax must be between 0% and 30%.")
        self.settings_repo.set(self.TAX_KEY, str(value), user_id)
        self.audit_repo.record(user_id, "settings.tax", f"Default tax set to {value}%")
        return value
