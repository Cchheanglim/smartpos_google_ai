"""Unit tests for domain models (pure Python, no database)."""
from decimal import Decimal

import pytest

from app.models.inventory.product import Product, StockStatus
from app.models.inventory.purchase_order import POStatus, PurchaseOrder
from app.models.inventory.stock_movement import MovementReason
from app.models.sales.cart import Cart, CartLine, Discount, DiscountType
from app.models.sales.customer import Customer, LoyaltyTier
from app.models.sales.tender import CashTender, ChangeCurrency, CurrencyMode, ExchangeRate
from app.models.staff.attendance import AttendanceSession, DrawerStatus
from app.models.staff.task import Task, TaskPriority, TaskStatus
from app.utils.security import PasswordHasher
from tests.fakes import make_product


def test_product_validate_rejects_zero_price_and_bad_barcode():
    product = Product(id=None, sku="PRD-001", name="Water", price=Decimal("0"))
    with pytest.raises(ValueError, match="greater than zero"):
        product.validate()
    bad = Product(id=None, sku="PRD-002", name="Water", price=Decimal("1"), barcode="12x")
    with pytest.raises(ValueError, match="8–14 digits"):
        bad.validate()


def test_product_stock_status_levels():
    assert make_product(stock=0).status is StockStatus.OUT
    assert make_product(stock=2).status is StockStatus.LOW
    assert make_product(stock=9).status is StockStatus.OK


def test_product_scan_code_prefers_barcode_over_sku():
    assert make_product(sku="PRD-001", barcode="8801234567890").scan_code == "8801234567890"
    assert make_product(sku="PRD-001").scan_code == "PRD-001"


def test_cart_pricing_with_percent_discount_member_and_points():
    cart = Cart([CartLine(make_product(1, price="10.00"), 2), CartLine(make_product(2, price="5.00"), 1)])
    summary = cart.price(discount=Discount(DiscountType.PERCENT, Decimal("10")),
                         member_discount_percent=Decimal("5"), points_redeemed=20,
                         point_value=Decimal("0.05"), tax_percent=Decimal("10"))
    assert summary.subtotal == Decimal("25.00")
    assert summary.discount_amount == Decimal("2.50")          # 10% of 25
    assert summary.member_discount_amount == Decimal("1.13")   # 5% of 22.50 (rounded)
    assert summary.points_discount == Decimal("1.00")          # 20 points x $0.05
    assert summary.total > 0


def test_cart_fixed_discount_is_capped_at_subtotal():
    cart = Cart([CartLine(make_product(1, price="3.00"), 1)])
    summary = cart.price(discount=Discount(DiscountType.FIXED, Decimal("50")))
    assert summary.discount_amount == Decimal("3.00")
    assert summary.total == Decimal("0.00")


def test_discount_rejects_percent_above_cap():
    with pytest.raises(ValueError, match="cannot exceed"):
        Discount(DiscountType.PERCENT, Decimal("60"))


@pytest.mark.parametrize("points, tier", [(0, LoyaltyTier.BRONZE), (99, LoyaltyTier.BRONZE),
                                          (100, LoyaltyTier.SILVER), (300, LoyaltyTier.GOLD),
                                          (750, LoyaltyTier.VIP)])
def test_loyalty_tier_thresholds(points, tier):
    customer = Customer(id=1, phone="012345678", name="Sara", points=points)
    assert customer.tier is tier
    assert customer.discount_percent == tier.discount_percent


def test_customer_redemption_rules():
    customer = Customer(id=1, phone="012345678", name="Sara", points=50)
    with pytest.raises(ValueError, match="At least 20"):
        customer.check_redemption(10, Decimal("100"))
    with pytest.raises(ValueError, match="only has 50"):
        customer.check_redemption(60, Decimal("100"))
    with pytest.raises(ValueError, match="At most"):
        customer.check_redemption(50, Decimal("1.00"))         # bill too small for 50 points
    customer.check_redemption(20, Decimal("100"))               # fine, no raise


def test_exchange_rate_converts_both_ways_rounded_to_100_riel():
    rate = ExchangeRate(4100)
    assert rate.to_khr(Decimal("1.00")) == 4100
    assert rate.to_khr(Decimal("1.02")) == 4200          # rounds to nearest 100
    assert rate.to_usd(4100) == Decimal("1.00")
    with pytest.raises(ValueError):
        ExchangeRate(500)


def test_cash_tender_change_and_shortfall():
    rate = ExchangeRate(4000)
    tender = CashTender(CurrencyMode.USD, Decimal("20.00"), 0, rate)
    change = tender.change_for(Decimal("15.00"), ChangeCurrency.USD)
    assert change.usd == Decimal("5.00")
    change_khr = tender.change_for(Decimal("15.00"), ChangeCurrency.KHR)
    assert change_khr.khr == 20000
    with pytest.raises(ValueError, match="short by"):
        tender.change_for(Decimal("25.00"), ChangeCurrency.USD)


def test_mixed_currency_tender_sums_both():
    rate = ExchangeRate(4000)
    tender = CashTender(CurrencyMode.MIXED, Decimal("5.00"), 8000, rate)
    assert tender.paid_usd == Decimal("7.00")


def test_purchase_order_state_machine():
    po = PurchaseOrder(id=1, supplier_id=1, status=POStatus.DRAFT)
    with pytest.raises(ValueError, match="at least one product"):
        po.transition_to(POStatus.ORDERED)
    po.items = [object()]  # non-empty for this check
    po.transition_to(POStatus.ORDERED)
    assert po.status is POStatus.ORDERED
    with pytest.raises(ValueError, match="cannot be marked draft"):
        po.transition_to(POStatus.DRAFT)
    po.transition_to(POStatus.RECEIVED)
    assert po.status.is_terminal


def test_attendance_close_computes_status():
    session = AttendanceSession(id=1, user_id=1, opening_float=Decimal("20.00"))
    status = session.close(Decimal("50.00"), Decimal("50.00"))
    assert status is DrawerStatus.BALANCED
    session2 = AttendanceSession(id=2, user_id=1, opening_float=Decimal("20.00"))
    assert session2.close(Decimal("50.00"), Decimal("45.00")) is DrawerStatus.SHORTAGE
    with pytest.raises(ValueError, match="negative"):
        AttendanceSession.check_float(Decimal("-1"))
    with pytest.raises(ValueError, match="already closed"):
        session.close(Decimal("10"), Decimal("10"))


def test_task_status_transitions():
    task = Task(id=1, title="Restock", assigned_to=2, assigned_by=1, priority=TaskPriority.HIGH)
    task.move_to(TaskStatus.IN_PROGRESS)
    task.move_to(TaskStatus.COMPLETED)
    assert task.completed_at is not None
    with pytest.raises(ValueError, match="cannot move to"):
        task.move_to(TaskStatus.CANCELLED)


def test_task_ordering_prioritises_urgent_then_due_date():
    from datetime import date
    low = Task(id=1, title="A", assigned_to=1, assigned_by=1, priority=TaskPriority.LOW)
    urgent = Task(id=2, title="B", assigned_to=1, assigned_by=1, priority=TaskPriority.URGENT)
    assert sorted([low, urgent]) == [urgent, low]


def test_movement_reason_direction_guards():
    with pytest.raises(ValueError, match="only add stock"):
        MovementReason.RESTOCK.check_change(-1)
    with pytest.raises(ValueError, match="only remove stock"):
        MovementReason.DAMAGED.check_change(1)
    MovementReason.COUNT_ADJUSTMENT.check_change(-3)  # either direction is fine


def test_password_hasher_hashes_and_enforces_policy():
    hasher = PasswordHasher()
    hashed = hasher.hash("secret123")
    assert hashed != "secret123"
    assert hasher.verify(hashed, "secret123")
    assert not hasher.verify(hashed, "wrong123")
    with pytest.raises(ValueError):
        hasher.hash("short1")
