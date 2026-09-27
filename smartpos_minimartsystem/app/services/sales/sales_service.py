"""Sales history and receipts."""
from dataclasses import dataclass

from app.forms.sales_forms import SalesFilterInput
from app.models.auth.user import User
from app.models.sales.refund import Refund
from app.models.sales.sale import PaymentMethod, Sale
from app.repositories.auth.user_repository import UserRepository
from app.repositories.sales.refund_repository import RefundRepository
from app.repositories.sales.sale_repository import SaleRepository
from app.services.auth.auth_service import AuthService
from app.services.errors import NotFoundError


@dataclass
class ReceiptView:
    sale: Sale
    refunds: list[Refund]


class SalesService:
    def __init__(self, sale_repo: SaleRepository | None = None,
                 refund_repo: RefundRepository | None = None,
                 auth_service: AuthService | None = None,
                 user_repo: UserRepository | None = None) -> None:
        self.sale_repo = sale_repo or SaleRepository()
        self.refund_repo = refund_repo or RefundRepository()
        self.auth_service = auth_service or AuthService()
        self.user_repo = user_repo or UserRepository()

    def history_page(self, filters: SalesFilterInput, user: User) -> dict:
        """Managers see every sale; a cashier only sees their own."""
        if filters.start and filters.end and filters.start > filters.end:
            raise ValueError("Start date must be on or before end date.")
        own_only = not self.auth_service.has_permission(user, "view_reports")
        sales = self.sale_repo.search(
            term=filters.term, start=filters.start, end=filters.end,
            payment_method=filters.payment_method,
            cashier_id=user.id if own_only else filters.cashier_id,
            limit=300,
        )
        return {
            "sales": sales,
            "filters": filters,
            "own_only": own_only,
            "payment_methods": list(PaymentMethod),
            "cashiers": [] if own_only else self.user_repo.search(),
            "total": sum((s.net_amount for s in sales), start=0),
            "refund_total": sum((s.refunded_amount for s in sales), start=0),
        }

    def refund_log(self, filters: SalesFilterInput) -> dict:
        """Auditable list of every refund with who processed it, when and why."""
        refunds = self.refund_repo.search(filters.start, filters.end, filters.cashier_id)
        return {"refunds": refunds, "filters": filters, "staff": self.user_repo.search(),
                "total": sum((r.refund_amount for r in refunds), start=0)}

    def receipt(self, sale_id: int, user: User) -> ReceiptView:
        sale = self.sale_repo.find_with_items(sale_id)
        if sale is None:
            raise NotFoundError("Sale not found.")
        if sale.cashier_id != user.id and not self.auth_service.has_permission(user, "view_reports") \
                and not self.auth_service.has_permission(user, "process_refund"):
            raise NotFoundError("Sale not found.")
        return ReceiptView(sale=sale, refunds=self.refund_repo.list_for_sale(sale_id))
