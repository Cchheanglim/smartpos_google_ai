"""Supplier purchase orders: draft → ordered → received / cancelled."""
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Callable, ContextManager

from app.extensions import transaction
from app.forms.inventory_forms import POLineInput
from app.models.auth.user import User
from app.models.inventory.product import Product
from app.models.inventory.purchase_order import POStatus, PurchaseOrder, PurchaseOrderItem
from app.models.inventory.stock_movement import MovementReason
from app.models.inventory.supplier import Supplier
from app.repositories.inventory.product_repository import ProductRepository
from app.repositories.inventory.purchase_order_repository import PurchaseOrderRepository
from app.repositories.inventory.stock_movement_repository import StockMovementRepository
from app.repositories.inventory.supplier_repository import SupplierRepository
from app.repositories.staff.audit_repository import AuditRepository
from app.services.errors import NotFoundError
from app.services.notifications.telegram_service import TelegramService


@dataclass
class POListPage:
    orders: list[PurchaseOrder]
    counts: dict[str, int]
    suppliers: list[Supplier]
    status: str


@dataclass
class POFormPage:
    order: PurchaseOrder | None
    suppliers: list[Supplier]
    products: list[Product]


class PurchaseOrderService:
    def __init__(self, po_repo: PurchaseOrderRepository | None = None,
                 product_repo: ProductRepository | None = None,
                 supplier_repo: SupplierRepository | None = None,
                 stock_repo: StockMovementRepository | None = None,
                 audit_repo: AuditRepository | None = None,
                 telegram: TelegramService | None = None,
                 tx: Callable[[], ContextManager] = transaction) -> None:
        self.po_repo = po_repo or PurchaseOrderRepository()
        self.product_repo = product_repo or ProductRepository()
        self.supplier_repo = supplier_repo or SupplierRepository()
        self.stock_repo = stock_repo or StockMovementRepository()
        self.audit_repo = audit_repo or AuditRepository()
        self.telegram = telegram or TelegramService()
        self.tx = tx

    # ---------------- read ----------------
    def list_page(self, status: str = "", supplier_id: int | None = None) -> POListPage:
        if status and status not in {s.value for s in POStatus}:
            status = ""
        return POListPage(orders=self.po_repo.search(status, supplier_id), counts=self.po_repo.status_counts(),
                          suppliers=self.supplier_repo.list_all(), status=status)

    def form_page(self, po_id: int | None = None, supplier_id: int | None = None) -> POFormPage:
        order = self.get(po_id) if po_id else None
        if order and order.status is not POStatus.DRAFT:
            raise ValueError("Only draft purchase orders can be edited.")
        chosen = order.supplier_id if order else supplier_id
        products = self.product_repo.list_by_supplier(chosen) if chosen else []
        return POFormPage(order=order, suppliers=self.supplier_repo.list_all(), products=products)

    def get(self, po_id: int) -> PurchaseOrder:
        order = self.po_repo.find_with_items(po_id)
        if order is None:
            raise NotFoundError("Purchase order not found.")
        return order

    # ---------------- write ----------------
    def save_draft(self, user: User, supplier_id: int | None, expected_date: date | None, notes: str,
                   lines: list[POLineInput], po_id: int | None = None) -> PurchaseOrder:
        """Create or update a draft with its product lines."""
        if not supplier_id or self.supplier_repo.find_by_id(supplier_id) is None:
            raise ValueError("Choose a supplier.")
        if expected_date and expected_date < date.today():
            raise ValueError("Expected delivery date cannot be in the past.")
        items = self._build_items(lines)
        if po_id:
            order = self.get(po_id)
            if order.status is not POStatus.DRAFT:
                raise ValueError("Only draft purchase orders can be edited.")
            order.supplier_id, order.expected_date, order.notes = supplier_id, expected_date, notes.strip()[:255]
        else:
            order = PurchaseOrder(id=None, supplier_id=supplier_id, expected_date=expected_date,
                                  notes=notes.strip()[:255], created_by=user.id)
        order.items = items
        with self.tx():
            if order.id:
                self.po_repo.update_header(order)
            else:
                order.id = self.po_repo.create(order)
            self.po_repo.replace_items(order.id, items)
        return order

    def place_order(self, po_id: int, user: User) -> PurchaseOrder:
        return self._transition(po_id, POStatus.ORDERED, user)

    def cancel(self, po_id: int, user: User) -> PurchaseOrder:
        return self._transition(po_id, POStatus.CANCELLED, user)

    def receive(self, po_id: int, user: User) -> PurchaseOrder:
        """Mark delivered and add every line to stock (with ledger rows) in one transaction."""
        order = self.get(po_id)
        current = order.status
        order.transition_to(POStatus.RECEIVED)
        with self.tx():
            if self.po_repo.set_status(order.id, current, POStatus.RECEIVED, user.id) == 0:
                raise ValueError("This purchase order was already processed by someone else.")
            for item in order.items:
                self.product_repo.adjust_stock(item.product_id, item.quantity)
                self.stock_repo.create(item.product_id, item.quantity, MovementReason.PURCHASE_ORDER.value,
                                       f"{order.reference} from {order.supplier_name}", user.id)
            self.audit_repo.record(user.id, "po.received",
                                   f"{order.reference}: {order.unit_count} units, ${order.total_cost:.2f}")
        self.telegram.notify_purchase_order_received(order.reference, order.supplier_name, order.unit_count,
                                                      order.total_cost, user.name)
        return order

    def _transition(self, po_id: int, target: POStatus, user: User) -> PurchaseOrder:
        order = self.get(po_id)
        current = order.status
        order.transition_to(target)                 # raises ValueError on an illegal move
        with self.tx():
            if self.po_repo.set_status(order.id, current, target, user.id) == 0:
                raise ValueError("This purchase order was changed by someone else. Please reload.")
            self.audit_repo.record(user.id, f"po.{target.value}", order.reference)
        return order

    def _build_items(self, lines: list[POLineInput]) -> list[PurchaseOrderItem]:
        merged: dict[int, PurchaseOrderItem] = {}
        for line in lines:
            product = self.product_repo.find_by_id(line.product_id)
            if product is None:
                raise ValueError("One of the selected products no longer exists.")
            if line.product_id in merged:
                merged[line.product_id].quantity += line.quantity
                continue
            item = PurchaseOrderItem(id=None, po_id=None, product_id=product.id, quantity=line.quantity,
                                     unit_cost=line.unit_cost, product_name=product.name, product_sku=product.sku)
            merged[product.id] = item
        items = list(merged.values())
        for item in items:
            item.validate()
        if not items:
            raise ValueError("Add at least one product line.")
        return items
