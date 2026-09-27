"""Purchase-order workflow: draft -> ordered -> received, with stock updates."""
from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.forms.inventory_forms import POLineInput
from app.models.inventory.purchase_order import POStatus
from app.services.inventory.purchase_order_service import PurchaseOrderService
from tests.fakes import (FakeAuditRepo, FakeCategoryRepo, FakeProductRepo, FakePurchaseOrderRepo,
                         FakeStockRepo, FakeSupplierRepo, make_product, make_user, no_tx)


def build_service():
    products = FakeProductRepo(make_product(1, stock=10), make_product(2, stock=5))
    service = PurchaseOrderService(po_repo=FakePurchaseOrderRepo(), product_repo=products,
                                   supplier_repo=FakeSupplierRepo(1), stock_repo=FakeStockRepo(),
                                   audit_repo=FakeAuditRepo(), tx=no_tx)
    return service, products


def test_save_draft_merges_duplicate_lines_and_validates_supplier():
    service, products = build_service()
    with pytest.raises(ValueError, match="Choose a supplier"):
        service.save_draft(make_user(), None, None, "", [POLineInput(1, 5, Decimal("1.00"))])
    order = service.save_draft(make_user(), 1, None, "restock",
                               [POLineInput(1, 5, Decimal("1.00")), POLineInput(1, 3, Decimal("1.00"))])
    assert order.status is POStatus.DRAFT
    assert len(order.items) == 1 and order.items[0].quantity == 8


def test_place_and_receive_updates_stock_and_ledger():
    service, products = build_service()
    order = service.save_draft(make_user(), 1, None, "", [POLineInput(1, 10, Decimal("2.00"))])
    with pytest.raises(ValueError, match="one product"):
        empty = service.save_draft(make_user(), 1, None, "", [])
        service.place_order(empty.id, make_user())
    placed = service.place_order(order.id, make_user())
    assert placed.status is POStatus.ORDERED
    received = service.receive(order.id, make_user())
    assert received.status is POStatus.RECEIVED
    assert products.find_by_id(1).quantity_in_stock == 20
    assert service.stock_repo.rows[-1][:2] == (1, 10)


def test_cannot_receive_a_draft_or_cancelled_order():
    service, products = build_service()
    order = service.save_draft(make_user(), 1, None, "", [POLineInput(1, 5, Decimal("1.00"))])
    with pytest.raises(ValueError, match="cannot be marked received"):
        service.receive(order.id, make_user())
    service.place_order(order.id, make_user())
    service.cancel(order.id, make_user())
    with pytest.raises(ValueError, match="cannot be marked received"):
        service.receive(order.id, make_user())


def test_expected_date_cannot_be_in_the_past():
    service, products = build_service()
    with pytest.raises(ValueError, match="past"):
        service.save_draft(make_user(), 1, date.today() - timedelta(days=1), "",
                           [POLineInput(1, 1, Decimal("1"))])


def _po_form(product_ids, quantities, costs, supplier_id="1"):
    """Build a Werkzeug MultiDict the way Flask's real request.form arrives,
    so FormReader.list_of() (which relies on .getlist()) behaves as it would live."""
    from werkzeug.datastructures import MultiDict
    md = MultiDict({"supplier_id": supplier_id, "expected_date": "", "notes": ""})
    for pid in product_ids:
        md.add("line_product", pid)
    for q in quantities:
        md.add("line_qty", q)
    for c in costs:
        md.add("line_cost", c)
    return md


def test_purchase_order_form_skips_zero_quantity_lines():
    """A product row left at its default quantity of 0 means 'not ordering
    this one' — it must not be treated as an invalid line."""
    from app.forms.inventory_forms import PurchaseOrderInput
    data = PurchaseOrderInput.from_form(_po_form(["1", "2", "3"], ["1", "0", "0"], ["2.00", "1.00", "1.50"]))
    assert len(data.lines) == 1
    assert data.lines[0].product_id == 1 and data.lines[0].quantity == 1


def test_purchase_order_form_with_only_one_item_ordered():
    """Regression test: ordering just a single product used to fail because
    every other product row (left at quantity 0) was wrongly validated too."""
    service, products = build_service()
    from app.forms.inventory_forms import PurchaseOrderInput
    data = PurchaseOrderInput.from_form(_po_form(["1", "2"], ["1", "0"], ["2.00", "1.00"]))
    order = service.save_draft(make_user(), data.supplier_id, data.expected_date, data.notes, data.lines)
    assert len(order.items) == 1
    assert order.items[0].product_id == 1 and order.items[0].quantity == 1
