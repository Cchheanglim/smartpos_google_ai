"""Builds the home dashboard, tailored to the signed-in user's permissions."""
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal

from app.models.auth.user import User
from app.models.reports.report_models import DateRange
from app.repositories.inventory.product_repository import ProductRepository
from app.repositories.inventory.stock_movement_repository import StockMovementRepository
from app.repositories.reports.report_repository import ReportRepository
from app.repositories.sales.sale_repository import SaleRepository
from app.repositories.staff.attendance_repository import AttendanceRepository
from app.repositories.staff.task_repository import TaskRepository
from app.services.auth.auth_service import AuthService


@dataclass
class DashboardData:
    sees_all_sales: bool = False
    sees_inventory: bool = False
    today: dict = field(default_factory=dict)
    recent_sales: list = field(default_factory=list)
    low_stock: list = field(default_factory=list)
    movements: list = field(default_factory=list)
    inventory: dict = field(default_factory=dict)
    kpis: dict = field(default_factory=dict)
    by_hour: list = field(default_factory=list)
    open_shifts: list = field(default_factory=list)
    my_shift: object = None
    my_open_tasks: int = 0
    cash_in_drawers: Decimal = Decimal("0.00")


class DashboardService:
    def __init__(self, product_repo: ProductRepository | None = None,
                 stock_repo: StockMovementRepository | None = None,
                 sale_repo: SaleRepository | None = None,
                 report_repo: ReportRepository | None = None,
                 attendance_repo: AttendanceRepository | None = None,
                 task_repo: TaskRepository | None = None,
                 auth_service: AuthService | None = None) -> None:
        self.product_repo = product_repo or ProductRepository()
        self.stock_repo = stock_repo or StockMovementRepository()
        self.sale_repo = sale_repo or SaleRepository()
        self.report_repo = report_repo or ReportRepository()
        self.attendance_repo = attendance_repo or AttendanceRepository()
        self.task_repo = task_repo or TaskRepository()
        self.auth_service = auth_service or AuthService()

    def overview(self, user: User) -> DashboardData:
        perms = self.auth_service.permissions_for(user)
        sees_all_sales = "view_reports" in perms
        sees_inventory = bool({"manage_products", "adjust_stock", "view_reports"} & perms)
        data = DashboardData(sees_all_sales=sees_all_sales, sees_inventory=sees_inventory,
                             today=self.sale_repo.today_totals(None if sees_all_sales else user.id),
                             my_shift=self.attendance_repo.find_open_for(user.id),
                             my_open_tasks=self.task_repo.count_open_for(user.id))
        if "process_sale" in perms or sees_all_sales:
            data.recent_sales = self.sale_repo.search(cashier_id=None if sees_all_sales else user.id, limit=6)
        if sees_inventory:
            data.low_stock = self.product_repo.list_low_stock(8)
            data.movements = self.stock_repo.list_recent(8)
            data.inventory = self.product_repo.inventory_totals()
        if "manage_cashier_accounts" in perms or "adjust_drawer_cash" in perms:
            data.open_shifts = self.attendance_repo.list_open()
            data.cash_in_drawers = self.attendance_repo.total_cash_in_drawers()
        if sees_all_sales:
            period = DateRange(date.today() - timedelta(days=6), date.today())
            summary = self.report_repo.summary(period)
            data.kpis = {
                "revenue": summary.revenue, "net_profit": summary.net_profit,
                "gross_profit": summary.gross_profit, "transactions": summary.transactions,
                "average_basket": summary.average_basket,
            }
            by_hour = self.report_repo.sales_by_hour(DateRange(date.today(), date.today()))
            top = max((amt for amt, _ in by_hour.values()), default=0) or 1
            data.by_hour = [{"hour": h, "amount": by_hour.get(h, (0, 0))[0],
                            "percent": round(float(by_hour.get(h, (0, 0))[0]) / float(top) * 100, 1)}
                            for h in range(24)]
        return data
