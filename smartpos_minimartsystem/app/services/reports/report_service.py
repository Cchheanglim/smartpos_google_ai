"""Business reports: summary KPIs, rankings, hourly rush chart and exports."""
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal

from app.models.reports.report_models import CashierProductivity, DateRange, RankedRow, SalesSummary
from app.models.sales.sale import PaymentMethod
from app.repositories.inventory.product_repository import ProductRepository
from app.repositories.reports.report_repository import ReportRepository
from app.utils.csv_export import to_csv
from app.utils.xlsx_export import XlsxWorkbook


@dataclass
class Bar:
    """A row plus its width (0-100) for the CSS bar charts."""

    label: str
    amount: Decimal
    quantity: int
    percent: float


@dataclass
class HourBar:
    hour: int
    amount: Decimal
    quantity: int
    percent: float

    @property
    def label(self) -> str:
        h = self.hour % 12 or 12
        return f"{h}{'AM' if self.hour < 12 else 'PM'}"


@dataclass
class ReportPage:
    period: DateRange
    summary: SalesSummary
    by_day: list[Bar]
    by_hour: list[HourBar]
    by_category: list[Bar]
    by_payment: list[Bar]
    by_cashier: list[CashierProductivity]
    top_products: list[Bar]
    waste: list[Bar]
    inventory: dict
    can_export: bool = False


class ReportService:
    DEFAULT_DAYS = 30
    MAX_DAYS = 366

    def __init__(self, report_repo: ReportRepository | None = None,
                 product_repo: ProductRepository | None = None) -> None:
        self.report_repo = report_repo or ReportRepository()
        self.product_repo = product_repo or ProductRepository()

    def make_period(self, start: date | None, end: date | None, today: date | None = None) -> DateRange:
        today = today or date.today()
        end = end or today
        start = start or end - timedelta(days=self.DEFAULT_DAYS - 1)
        period = DateRange(start, end)            # validates start <= end
        if period.days > self.MAX_DAYS:
            raise ValueError("Please choose a period of one year or less.")
        return period

    @staticmethod
    def to_bars(rows: list[RankedRow], by_quantity: bool = False) -> list[Bar]:
        values = [(r.quantity if by_quantity else r.amount) for r in rows]
        top = max(values, default=0) or 1
        return [Bar(r.label, r.amount, r.quantity, round(float(v) / float(top) * 100, 1))
                for r, v in zip(rows, values)]

    def _hour_bars(self, period: DateRange) -> list[HourBar]:
        by_hour = self.report_repo.sales_by_hour(period)
        top = max((amt for amt, _ in by_hour.values()), default=0) or 1
        return [HourBar(h, *by_hour.get(h, (Decimal("0.00"), 0)),
                        round(float(by_hour.get(h, (0, 0))[0]) / float(top) * 100, 1)) for h in range(24)]

    def report_page(self, start: date | None = None, end: date | None = None, can_export: bool = False) -> ReportPage:
        period = self.make_period(start, end)
        payments = self.report_repo.revenue_by_payment(period)
        payments = [RankedRow(PaymentMethod(r.label).label, r.amount, r.quantity) for r in payments]
        return ReportPage(
            period=period,
            summary=self.report_repo.summary(period),
            by_day=self.to_bars(self.report_repo.revenue_by_day(period)),
            by_hour=self._hour_bars(period),
            by_category=self.to_bars(self.report_repo.revenue_by_category(period)),
            by_payment=self.to_bars(payments),
            by_cashier=self.report_repo.cashier_productivity(period),
            top_products=self.to_bars(self.report_repo.top_products_by_revenue(period)),
            waste=self.to_bars(self.report_repo.waste_by_reason(period)),
            inventory=self.product_repo.inventory_totals(),
            can_export=can_export,
        )

    def export_sales_csv(self, start: date | None = None, end: date | None = None) -> tuple[str, str]:
        period = self.make_period(start, end)
        rows = self.report_repo.sales_rows_for_export(period)
        csv_text = to_csv(
            ["Receipt", "Date", "Cashier", "Customer", "Payment", "Currency", "Subtotal", "Discounts",
             "Tax", "COGS", "Refunded", "Total"],
            ([f"INV-{r['id']:06d}", r["created_at"], r["cashier"], r["customer"], r["payment_method"],
              r["currency_mode"], r["subtotal"], r["discounts"], r["tax_amount"], r["cogs"], r["refunded"],
              r["total_amount"]] for r in rows),
        )
        return f"sales_{period.start}_{period.end}.csv", csv_text

    def export_sales_xlsx(self, start: date | None = None, end: date | None = None) -> tuple[str, bytes]:
        """Sales ledger + inventory summary as a two-sheet Excel workbook."""
        period = self.make_period(start, end)
        rows = self.report_repo.sales_rows_for_export(period)
        wb = XlsxWorkbook()
        wb.add_sheet(
            "Sales", ["Receipt", "Date", "Cashier", "Customer", "Payment", "Currency", "Subtotal",
                     "Discounts", "Tax", "COGS", "Refunded", "Total"],
            ([f"INV-{r['id']:06d}", str(r["created_at"]), r["cashier"], r["customer"], r["payment_method"],
              r["currency_mode"], float(r["subtotal"]), float(r["discounts"]), float(r["tax_amount"]),
              float(r["cogs"]), float(r["refunded"]), float(r["total_amount"])] for r in rows))
        products = self.product_repo.list_for_export()
        wb.add_sheet(
            "Inventory", ["SKU", "Barcode", "Name", "Category", "Supplier", "Price", "Cost", "In Stock",
                         "Threshold", "Stock Value", "Margin %"],
            ([p.sku, p.barcode or "", p.name, p.category_name or "", p.supplier_name or "", float(p.price),
              float(p.cost), p.quantity_in_stock, p.low_stock_threshold, float(p.stock_value),
              float(p.margin_percent)] for p in products))
        return f"smartpos_{period.start}_{period.end}.xlsx", wb.to_bytes()
