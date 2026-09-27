"""
Checkout (point of sale) workflow.

The route keeps two plain dicts in the Flask session:

* the cart  — ``{"<product_id>": {"qty": 2, "note": "no ice"}}``
* the state — ``{"customer_phone": ..., "discount_type": ..., "discount_value": ..., "points": ...}``

Every method here receives those dicts and returns NEW dicts, so this
service never touches the session and can be unit-tested without Flask.
"""
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any, Callable, ContextManager

from app.extensions import transaction
from app.forms.sales_forms import CheckoutInput
from app.models.auth.user import User
from app.models.base import to_money
from app.models.inventory.category import Category
from app.models.inventory.product import Product
from app.models.inventory.stock_movement import MovementReason
from app.models.sales.cart import Cart, CartLine, Discount, DiscountType, PricingSummary
from app.models.sales.customer import Customer
from app.models.sales.held_order import HeldOrder
from app.models.sales.sale import PaymentMethod, Sale, SaleItem
from app.models.sales.tender import (BANKS, CARD_BRANDS, KHR_NOTES, USD_NOTES, CashTender, ChangeCurrency,
                                     CurrencyMode, ExchangeRate)
from app.models.staff.attendance import AttendanceSession, CashMovementKind
from app.repositories.inventory.category_repository import CategoryRepository
from app.repositories.inventory.product_repository import ProductRepository
from app.repositories.inventory.stock_movement_repository import StockMovementRepository
from app.repositories.sales.customer_repository import CustomerRepository
from app.repositories.sales.held_order_repository import HeldOrderRepository
from app.repositories.sales.sale_repository import SaleRepository
from app.repositories.staff.attendance_repository import AttendanceRepository
from app.services.auth.auth_service import AuthService
from app.services.notifications.telegram_service import TelegramService
from app.services.settings.settings_service import SettingsService

CartData = dict[str, dict[str, Any]]
StateData = dict[str, Any]


def _entry(value: Any) -> dict[str, Any]:
    """Normalise one cart entry (older sessions stored a bare quantity)."""
    if isinstance(value, dict):
        return {"qty": int(value.get("qty", 0)), "note": str(value.get("note", ""))[:120]}
    return {"qty": int(value), "note": ""}


@dataclass
class CheckoutPage:
    products: list[Product]
    categories: list[Category]
    cart: Cart
    summary: PricingSummary
    customer: Customer | None
    state: StateData
    rate: ExchangeRate
    session: AttendanceSession | None
    held_orders: list[HeldOrder]
    can_discount: bool
    can_hold: bool
    can_set_rate: bool
    max_redeemable: int
    payment_methods: list[PaymentMethod] = field(default_factory=lambda: list(PaymentMethod))
    usd_notes: tuple[int, ...] = USD_NOTES
    khr_notes: tuple[int, ...] = KHR_NOTES
    banks: list = field(default_factory=lambda: BANKS)
    card_brands: list = field(default_factory=lambda: CARD_BRANDS)
    pricing_error: str = ""

    @property
    def total_khr(self) -> int:
        return self.rate.to_khr(self.summary.total)


class CheckoutService:
    MAX_LINE_QTY = 999

    def __init__(self, product_repo: ProductRepository | None = None,
                 category_repo: CategoryRepository | None = None,
                 customer_repo: CustomerRepository | None = None,
                 sale_repo: SaleRepository | None = None,
                 stock_repo: StockMovementRepository | None = None,
                 attendance_repo: AttendanceRepository | None = None,
                 held_repo: HeldOrderRepository | None = None,
                 auth_service: AuthService | None = None,
                 settings_service: SettingsService | None = None,
                 telegram: TelegramService | None = None,
                 tx: Callable[[], ContextManager] = transaction) -> None:
        self.product_repo = product_repo or ProductRepository()
        self.category_repo = category_repo or CategoryRepository()
        self.customer_repo = customer_repo or CustomerRepository()
        self.sale_repo = sale_repo or SaleRepository()
        self.stock_repo = stock_repo or StockMovementRepository()
        self.attendance_repo = attendance_repo or AttendanceRepository()
        self.held_repo = held_repo or HeldOrderRepository()
        self.auth_service = auth_service or AuthService()
        self.settings = settings_service or SettingsService()
        self.telegram = telegram or TelegramService()
        self.tx = tx

    # ---------------- page ----------------
    def page(self, cart_data: CartData, state: StateData, cashier: User,
             category_id: int | None = None) -> CheckoutPage:
        cart = self.build_cart(cart_data)
        customer = self.lookup_customer(state.get("customer_phone", "")) if state.get("customer_phone") else None
        error = ""
        try:
            summary = self.price(cart, state, customer)
        except ValueError as exc:          # e.g. stale points after a refund elsewhere
            error, summary = str(exc), self.price(cart, {}, customer)
        perms = self.auth_service.permissions_for(cashier)
        return CheckoutPage(
            products=self.product_repo.list_for_pos("", category_id),
            categories=self.category_repo.list_all(),
            cart=cart, summary=summary, customer=customer, state=dict(state),
            rate=self.settings.exchange_rate(),
            session=self.attendance_repo.find_open_for(cashier.id),
            held_orders=self.held_repo.list_for(None if "view_reports" in perms else cashier.id),
            can_discount="apply_discounts" in perms, can_hold="hold_orders" in perms,
            can_set_rate="manage_currency" in perms,
            max_redeemable=customer.max_redeemable(summary.before_points) if customer else 0,
            pricing_error=error,
        )

    def price(self, cart: Cart, state: StateData, customer: Customer | None) -> PricingSummary:
        """Price ``cart`` with the discount/points held in ``state``."""
        discount = self.discount_from(state.get("discount_type", "percent"), state.get("discount_value", "0"))
        member_pct = Decimal(customer.discount_percent) if customer else Decimal(0)
        points = int(state.get("points") or 0) if customer else 0
        preview = cart.price(discount, member_pct, 0, Customer.POINT_VALUE, self.settings.tax_percent())
        if customer and points:
            customer.check_redemption(points, preview.before_points)
        return cart.price(discount, member_pct, points, Customer.POINT_VALUE, self.settings.tax_percent())

    @staticmethod
    def discount_from(kind: str, value: Any) -> Discount:
        try:
            amount = Decimal(str(value or "0"))
        except InvalidOperation:
            raise ValueError("Discount must be a number.") from None
        return Discount(DiscountType.FIXED if kind == "fixed" else DiscountType.PERCENT, amount)

    def lookup_customer(self, phone: str) -> Customer | None:
        return self.customer_repo.find_by_phone(Customer.normalize_phone(phone))

    # ---------------- cart operations ----------------
    def build_cart(self, cart_data: CartData) -> Cart:
        entries = {int(pid): _entry(v) for pid, v in cart_data.items() if str(pid).isdigit()}
        products = {p.id: p for p in self.product_repo.find_many(list(entries))}
        return Cart([CartLine(products[pid], e["qty"], e["note"])
                     for pid, e in entries.items() if pid in products and e["qty"] > 0])

    def add_item(self, cart_data: CartData, product_id: int, quantity: int = 1) -> CartData:
        current = _entry(cart_data.get(str(product_id), 0))["qty"]
        return self.set_quantity(cart_data, product_id, current + quantity)

    def add_by_code(self, cart_data: CartData, code: str) -> tuple[CartData, Product]:
        """Barcode scanner / keyboard entry: add one unit by EAN barcode or SKU."""
        code = code.strip().upper()
        product = self.product_repo.find_by_scan_code(code)
        if product is None:
            raise ValueError(f"No product matches barcode or SKU '{code}'.")
        return self.add_item(cart_data, product.id), product

    def set_quantity(self, cart_data: CartData, product_id: int, quantity: int) -> CartData:
        new_cart = {k: _entry(v) for k, v in cart_data.items()}
        key = str(product_id)
        if quantity <= 0:
            new_cart.pop(key, None)
            return new_cart
        product = self.product_repo.find_by_id(product_id)
        if product is None:
            raise ValueError("That product no longer exists.")
        if quantity > self.MAX_LINE_QTY:
            raise ValueError(f"Maximum {self.MAX_LINE_QTY} units per line.")
        if not product.can_fulfil(quantity):
            raise ValueError(f"Only {product.quantity_in_stock} × {product.name} in stock.")
        new_cart[key] = {"qty": quantity, "note": new_cart.get(key, {}).get("note", "")}
        return new_cart

    @staticmethod
    def set_note(cart_data: CartData, product_id: int, note: str) -> CartData:
        new_cart = {k: _entry(v) for k, v in cart_data.items()}
        if str(product_id) not in new_cart:
            raise ValueError("That item is not in the cart.")
        new_cart[str(product_id)]["note"] = note.strip()[:120]
        return new_cart

    # ---------------- options ----------------
    def set_discount(self, state: StateData, kind: str, value: Decimal, cashier: User) -> StateData:
        if value and not self.auth_service.has_permission(cashier, "apply_discounts"):
            raise ValueError("You do not have permission to apply a manual discount.")
        discount = self.discount_from(kind, value)            # validates range
        return {**state, "discount_type": discount.kind.value, "discount_value": str(discount.value)}

    def attach_customer(self, state: StateData, phone: str) -> tuple[StateData, Customer | None]:
        new_state = {**state, "points": 0}
        if not phone.strip():
            new_state.pop("customer_phone", None)
            return new_state, None
        customer = self.lookup_customer(phone)
        if customer is None:
            raise ValueError("No loyalty member found with that phone number.")
        new_state["customer_phone"] = customer.phone
        return new_state, customer

    def set_points(self, cart_data: CartData, state: StateData, points: int) -> StateData:
        customer = self.lookup_customer(state.get("customer_phone", "")) if state.get("customer_phone") else None
        if customer is None:
            raise ValueError("Attach a loyalty member before redeeming points.")
        new_state = {**state, "points": max(points, 0)}
        self.price(self.build_cart(cart_data), new_state, customer)      # validates
        return new_state

    # ---------------- complete sale ----------------
    def complete_sale(self, cart_data: CartData, data: CheckoutInput, cashier: User) -> Sale:
        """Validate and record a sale atomically: sale + items + stock + loyalty + drawer cash."""
        cart = self.build_cart(cart_data)
        if not cart:
            raise ValueError("The cart is empty.")
        for line in cart:
            if line.exceeds_stock:
                raise ValueError(f"Only {line.product.quantity_in_stock} × {line.product.name} left in stock.")
        shift = self.attendance_repo.find_open_for(cashier.id)
        if shift is None:
            raise ValueError("Open your shift (clock in with your cash float) before taking payments.")
        if data.discount_value and not self.auth_service.has_permission(cashier, "apply_discounts"):
            raise ValueError("You do not have permission to apply a manual discount.")
        try:
            method = PaymentMethod(data.payment_method)
        except ValueError:
            raise ValueError("Please choose a valid payment method.") from None

        customer = None
        if data.customer_phone:
            customer = self.lookup_customer(data.customer_phone)
            if customer is None:
                raise ValueError("No loyalty member with that phone. Register them first or clear the field.")
        points = data.points_to_redeem if customer else 0
        summary = self.price(cart, {"discount_type": data.discount_type, "discount_value": data.discount_value,
                                    "points": points}, customer)
        rate = self.settings.exchange_rate()

        sale = Sale(
            id=None, cashier_id=cashier.id, subtotal=summary.subtotal, total_amount=summary.total,
            payment_method=method, discount_type=summary.discount.kind.value,
            discount_value=summary.discount.value, discount_amount=summary.discount_amount,
            member_discount_amount=summary.member_discount_amount, points_redeemed=summary.points_redeemed,
            points_discount=summary.points_discount, tax_percent=summary.tax_percent,
            tax_amount=summary.tax_amount, exchange_rate=rate.khr_per_usd,
            customer_id=customer.id if customer else None, attendance_id=shift.id,
            points_earned=Customer.points_for(summary.total) if customer else 0, cashier_name=cashier.name,
            qr_bank=data.qr_bank or None, card_brand=data.card_brand or None,
        )
        if method is PaymentMethod.KHQR and not sale.qr_bank:
            raise ValueError("Choose which bank the customer is paying with.")
        if method is PaymentMethod.CARD and not sale.card_brand:
            raise ValueError("Choose the card type.")

        cash_due = summary.total
        if method is PaymentMethod.SPLIT:
            qr_amount, card_amount = to_money(data.split_qr_amount), to_money(data.split_card_amount)
            if qr_amount < 0 or card_amount < 0:
                raise ValueError("Split amounts cannot be negative.")
            if qr_amount and not sale.qr_bank:
                raise ValueError("Choose which bank the QR portion was paid with.")
            if card_amount and not sale.card_brand:
                raise ValueError("Choose the card type for the card portion.")
            if qr_amount + card_amount > summary.total:
                raise ValueError("The card and QR portions add up to more than the total.")
            cash_due = to_money(summary.total - qr_amount - card_amount)
            sale.split_qr_amount, sale.split_card_amount = qr_amount, card_amount
            if cash_due == 0 and not (data.cash_usd or data.cash_khr):
                sale.currency_mode = CurrencyMode.USD

        if method.has_cash_component and cash_due > 0:
            try:
                mode = CurrencyMode(data.currency_mode)
            except ValueError:
                raise ValueError("Choose USD, Riel or mixed cash.") from None
            usd = data.cash_usd if (data.cash_usd or data.cash_khr) else cash_due
            tender = CashTender(mode, usd, data.cash_khr, rate)
            change = tender.change_for(cash_due, ChangeCurrency(data.change_currency))
            sale.currency_mode, sale.cash_usd, sale.cash_khr = mode, tender.usd, tender.khr
            sale.change_currency, sale.change_usd, sale.change_khr = change.currency, change.usd, change.khr
        elif method is PaymentMethod.SPLIT:
            sale.cash_usd, sale.cash_khr = Decimal("0.00"), 0

        low_stock_hits: list[tuple] = []
        with self.tx():
            sale.id = self.sale_repo.create(sale)
            for line in cart:
                item = SaleItem(id=None, sale_id=sale.id, product_id=line.product.id,
                                product_name=line.product.name, quantity=line.quantity,
                                unit_price=line.product.price, unit_cost=line.product.cost, note=line.note)
                item.id = self.sale_repo.add_item(sale.id, item)
                sale.items.append(item)
                # Guarded UPDATE: fails (0 rows) if another till sold the stock first.
                if self.product_repo.adjust_stock(line.product.id, -line.quantity) == 0:
                    raise ValueError(f"{line.product.name} just sold out. Please update the cart.")
                self.stock_repo.create(line.product.id, -line.quantity, MovementReason.SALE.value,
                                       f"Sale {sale.receipt_number}", cashier.id)
                remaining = line.product.quantity_in_stock - line.quantity
                if remaining <= line.product.low_stock_threshold:
                    low_stock_hits.append((line.product, remaining))
            if customer and self.customer_repo.add_purchase(customer.id, summary.total, sale.points_earned,
                                                            summary.points_redeemed) == 0:
                raise ValueError("The member's points balance changed. Please re-apply the points.")
            if method.has_cash_component and cash_due > 0:
                self.attendance_repo.add_movement(shift.id, CashMovementKind.SALE.value, cash_due,
                                                  sale.receipt_number, cashier.id)
        if customer:
            sale.customer_name, sale.customer_phone = customer.name, customer.phone
        self.telegram.notify_sale(sale.receipt_number, sale.total_amount, sale.items, cashier.name)
        for product, remaining in low_stock_hits:
            self.telegram.notify_low_stock(product.name, remaining, product.low_stock_threshold,
                                           product.supplier_name or "")
        return sale
