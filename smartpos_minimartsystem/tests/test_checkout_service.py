"""CheckoutService — cart ops, dual-currency payment, points, drawer cash."""
from decimal import Decimal

import pytest

from app.forms.sales_forms import CheckoutInput
from app.models.sales.customer import Customer
from app.models.staff.attendance import CashMovementKind
from app.services.sales.checkout_service import CheckoutService
from tests.fakes import (FakeAttendanceRepo, FakeAuthService, FakeCategoryRepo, FakeCustomerRepo,
                         FakeHeldOrderRepo, FakeProductRepo, FakeSaleRepo, FakeStockRepo, make_product,
                         make_user, no_tx)

GOLD_MEMBER = Customer(id=9, phone="012345678", name="Sara", points=320)   # Gold = 5%


def build_service(*perms, products=None, attendance=None):
    products = FakeProductRepo(*(products or [make_product(1, price="4.00", stock=5),
                                              make_product(2, price="1.00", stock=1)]))
    attendance = attendance or FakeAttendanceRepo()
    service = CheckoutService(product_repo=products, category_repo=FakeCategoryRepo(),
                              customer_repo=FakeCustomerRepo(GOLD_MEMBER), sale_repo=FakeSaleRepo(),
                              stock_repo=FakeStockRepo(), attendance_repo=attendance,
                              held_repo=FakeHeldOrderRepo(), auth_service=FakeAuthService(*perms), tx=no_tx)
    return service, products, attendance


def checkout_input(**overrides):
    values = dict(customer_phone="", discount_type="percent", discount_value=Decimal(0),
                  points_to_redeem=0, payment_method="cash", currency_mode="usd",
                  cash_usd=Decimal(0), cash_khr=0, change_currency="usd")
    values.update(overrides)
    return CheckoutInput(**values)


def test_cart_add_by_id_and_by_scan_code():
    service, *_ = build_service()
    cart = service.add_item({}, 1, 2)
    cart, product = service.add_by_code(cart, "PRD-002")
    assert cart == {"1": {"qty": 2, "note": ""}, "2": {"qty": 1, "note": ""}}
    assert product.id == 2
    with pytest.raises(ValueError, match="No product"):
        service.add_by_code(cart, "NOPE")


def test_set_quantity_respects_stock_and_note_is_kept():
    service, *_ = build_service()
    cart = service.add_item({}, 1, 2)
    cart = service.set_note(cart, 1, "no ice")
    cart = service.set_quantity(cart, 1, 3)
    assert cart["1"]["note"] == "no ice" and cart["1"]["qty"] == 3
    with pytest.raises(ValueError, match="Only 1"):
        service.set_quantity(cart, 2, 5)


def test_manual_discount_requires_permission():
    service, *_ = build_service()
    with pytest.raises(ValueError, match="permission"):
        service.set_discount({}, "percent", Decimal(10), make_user(4, "cashier"))
    allowed, *_ = build_service("apply_discounts")
    state = allowed.set_discount({}, "percent", Decimal(10), make_user(1))
    assert state["discount_value"] == "10"


def test_complete_sale_requires_open_shift():
    service, products, attendance = build_service()
    with pytest.raises(ValueError, match="Open your shift"):
        service.complete_sale({"1": {"qty": 1, "note": ""}}, checkout_input(), make_user(4, "cashier"))


def test_complete_sale_usd_cash_updates_stock_and_loyalty_and_drawer():
    service, products, attendance = build_service(products=[make_product(1, price="4.00", stock=5),
                                                             make_product(2, price="1.00", stock=1)])
    cashier = make_user(4, "cashier")
    attendance.open_session(cashier.id, Decimal("20.00"))
    sale = service.complete_sale({"1": {"qty": 2, "note": "no ice"}, "2": {"qty": 1, "note": ""}},
                                 checkout_input(customer_phone="012 345 678", cash_usd=Decimal("10")),
                                 cashier)
    # subtotal 9.00, Gold member 5% = 0.45 -> total 8.55, change 1.45
    assert sale.subtotal == Decimal("9.00")
    assert sale.member_discount_amount == Decimal("0.45")
    assert sale.total_amount == Decimal("8.55") and sale.change_usd == Decimal("1.45")
    assert products.find_by_id(1).quantity_in_stock == 3
    assert products.find_by_id(2).quantity_in_stock == 0
    session = attendance.find_by_id(1) or list(attendance.open_by_user.values())[0]
    assert (CashMovementKind.SALE.value, Decimal("8.55"), sale.receipt_number, cashier.id) in attendance.movements[session.id]


def test_complete_sale_khr_cash_computes_riel_change():
    service, products, attendance = build_service(products=[make_product(1, price="4.00", stock=5)])
    cashier = make_user(4, "cashier")
    attendance.open_session(cashier.id, Decimal("0"))
    sale = service.complete_sale({"1": {"qty": 1, "note": ""}},
                                 checkout_input(currency_mode="khr", cash_khr=20000, change_currency="khr"),
                                 cashier)
    assert sale.total_amount == Decimal("4.00")
    assert sale.cash_khr == 20000
    assert sale.change_khr == 3600     # paid 20000 KHR (~$4.878) - $4.00 total = ~$0.878 change = 3,600 KHR


def test_points_redemption_validated_against_bill():
    service, products, attendance = build_service(products=[make_product(1, price="1.00", stock=5)])
    with pytest.raises(ValueError, match="At least 20"):
        service.set_points({"1": {"qty": 1, "note": ""}}, {"customer_phone": "012345678"}, 5)


def test_split_payment_card_and_qr_amounts_reduce_cash_due():
    from app.forms.sales_forms import CheckoutInput
    service, products, attendance = build_service(products=[make_product(1, price="9.00", stock=5)])
    cashier = make_user(4, "cashier")
    attendance.open_session(cashier.id, Decimal("0"))
    data = CheckoutInput(customer_phone="", discount_type="percent", discount_value=Decimal(0),
                         points_to_redeem=0, payment_method="split", currency_mode="usd",
                         cash_usd=Decimal("0"), cash_khr=0, change_currency="usd",
                         qr_bank="aba", card_brand="visa",
                         split_card_amount=Decimal("3.00"), split_qr_amount=Decimal("2.00"))
    sale = service.complete_sale({"1": {"qty": 1, "note": ""}}, data, cashier)
    assert sale.split_card_amount == Decimal("3.00")
    assert sale.split_qr_amount == Decimal("2.00")
    assert sale.cash_usd == Decimal("4.00")          # 9.00 - 3.00 - 2.00, auto-filled since cash_usd was 0
    assert sale.change_usd == Decimal("0.00")
    # Only the $4 cash share should have been logged in the drawer, not the full $9.
    assert attendance.movements[1][-1][1] == Decimal("4.00")


def test_split_payment_rejects_card_and_qr_exceeding_total():
    from app.forms.sales_forms import CheckoutInput
    service, *_ = build_service(products=[make_product(1, price="5.00", stock=5)])
    cashier = make_user(4, "cashier")
    service.attendance_repo.open_session(cashier.id, Decimal("0"))
    data = CheckoutInput(customer_phone="", discount_type="percent", discount_value=Decimal(0),
                         points_to_redeem=0, payment_method="split", currency_mode="usd",
                         cash_usd=Decimal("0"), cash_khr=0, change_currency="usd",
                         qr_bank="aba", card_brand="visa",
                         split_card_amount=Decimal("999"), split_qr_amount=Decimal("0"))
    with pytest.raises(ValueError, match="more than the total"):
        service.complete_sale({"1": {"qty": 1, "note": ""}}, data, cashier)
