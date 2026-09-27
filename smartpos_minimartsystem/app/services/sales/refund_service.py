"""Refund business rules: partial/whole refunds with stock restoration."""
from decimal import Decimal
from typing import Callable, ContextManager

from app.extensions import transaction
from app.forms.sales_forms import RefundInput
from app.models.auth.user import User
from app.models.base import CENT
from app.models.inventory.stock_movement import MovementReason
from app.models.sales.customer import Customer
from app.models.sales.refund import Refund, RefundItem
from app.models.sales.sale import Sale
from app.repositories.inventory.product_repository import ProductRepository
from app.repositories.inventory.stock_movement_repository import StockMovementRepository
from app.repositories.sales.customer_repository import CustomerRepository
from app.repositories.sales.refund_repository import RefundRepository
from app.repositories.sales.sale_repository import SaleRepository
from app.models.staff.attendance import CashMovementKind
from app.repositories.staff.attendance_repository import AttendanceRepository
from app.repositories.staff.audit_repository import AuditRepository
from app.services.errors import NotFoundError
from app.services.notifications.telegram_service import TelegramService


class RefundService:
    def __init__(self, sale_repo: SaleRepository | None = None,
                 refund_repo: RefundRepository | None = None,
                 product_repo: ProductRepository | None = None,
                 stock_repo: StockMovementRepository | None = None,
                 customer_repo: CustomerRepository | None = None,
                 attendance_repo: AttendanceRepository | None = None,
                 audit_repo: AuditRepository | None = None,
                 telegram: TelegramService | None = None,
                 tx: Callable[[], ContextManager] = transaction) -> None:
        self.sale_repo = sale_repo or SaleRepository()
        self.refund_repo = refund_repo or RefundRepository()
        self.product_repo = product_repo or ProductRepository()
        self.stock_repo = stock_repo or StockMovementRepository()
        self.customer_repo = customer_repo or CustomerRepository()
        self.attendance_repo = attendance_repo or AttendanceRepository()
        self.audit_repo = audit_repo or AuditRepository()
        self.telegram = telegram or TelegramService()
        self.tx = tx

    def refund_page(self, sale_id: int) -> Sale:
        sale = self.sale_repo.find_with_items(sale_id)
        if sale is None:
            raise NotFoundError("Sale not found.")
        return sale

    @staticmethod
    def refund_amount(sale: Sale, unit_price: Decimal, quantity: int) -> Decimal:
        """Refund what the customer actually paid for these units: the line
        value scaled by (total paid / subtotal), so discounts and tax are
        refunded proportionally."""
        if sale.subtotal == 0:
            return Decimal("0.00")
        ratio = sale.total_amount / sale.subtotal
        return (unit_price * quantity * ratio).quantize(CENT)

    def process_refund(self, sale_id: int, data: RefundInput, user: User) -> Refund:
        sale = self.refund_page(sale_id)
        if not data.quantities:
            raise ValueError("Enter a quantity for at least one item to refund.")
        items_by_id = {item.id: item for item in sale.items}
        refund_items: list[RefundItem] = []
        for item_id, qty in data.quantities.items():
            item = items_by_id.get(item_id)
            if item is None:
                raise ValueError("One of the items does not belong to this sale.")
            if qty > item.refundable_quantity:
                raise ValueError(f"Only {item.refundable_quantity} × {item.product_name} can still be refunded.")
            refund_items.append(RefundItem(
                id=None, refund_id=None, sale_item_id=item.id, product_id=item.product_id,
                product_name=item.product_name, quantity=qty,
                amount=self.refund_amount(sale, item.unit_price, qty)))

        total = sum((ri.amount for ri in refund_items), Decimal("0.00"))
        # Rounding guard: never refund more than is still left on the sale.
        total = min(total, sale.net_amount)
        # Cash refunds are paid out of the refunding user's own open drawer. For a
        # split-tender sale, only the cash SHARE of the refund comes out of the
        # drawer — the card/QR share was never physical cash in the first place.
        shift = None
        cash_portion = total
        if sale.is_split:
            non_cash = (sale.split_card_amount or Decimal("0")) + (sale.split_qr_amount or Decimal("0"))
            cash_share = ((sale.total_amount - non_cash) / sale.total_amount) if sale.total_amount else Decimal("0")
            cash_portion = (total * cash_share).quantize(CENT)
        if sale.payment_method.has_cash_component and cash_portion > 0:
            shift = self.attendance_repo.find_open_for(user.id)
            if shift is None:
                raise ValueError("Cash refunds are paid from your drawer — clock in first.")
            if self.attendance_repo.drawer_balance(shift.id) < cash_portion:
                raise ValueError(f"Your drawer does not hold enough cash to refund ${cash_portion:.2f}.")
        refund = Refund(id=None, sale_id=sale.id, processed_by=user.id, refund_amount=total,
                        reason=data.reason, processed_by_name=user.name, items=refund_items,
                        attendance_id=shift.id if shift else None)
        with self.tx():
            refund.id = self.refund_repo.create(refund)
            for ri in refund_items:
                self.refund_repo.add_item(refund.id, ri)
                if self.sale_repo.add_refunded_quantity(ri.sale_item_id, ri.quantity) == 0:
                    raise ValueError("This sale was refunded by someone else just now. Please reload.")
                self.product_repo.adjust_stock(ri.product_id, ri.quantity)
                self.stock_repo.create(ri.product_id, ri.quantity, MovementReason.REFUND.value,
                                       f"Refund on {sale.receipt_number}", user.id)
            if sale.customer_id:
                self.customer_repo.reverse_purchase(sale.customer_id, total, Customer.points_for(total))
            if shift is not None:
                self.attendance_repo.add_movement(shift.id, CashMovementKind.REFUND.value, -cash_portion,
                                                  f"Refund {sale.receipt_number}", user.id)
            self.audit_repo.record(user.id, "sale.refund",
                                   f"{sale.receipt_number}: ${total:.2f} — {data.reason}")
        self.telegram.notify_refund(sale.receipt_number, total, data.reason, user.name)
        return refund
