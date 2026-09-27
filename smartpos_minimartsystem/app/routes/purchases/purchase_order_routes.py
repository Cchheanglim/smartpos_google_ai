"""Supplier purchase orders: create, place, receive, cancel."""
from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import current_user

from app.forms.base import FormReader
from app.forms.inventory_forms import PurchaseOrderInput
from app.services.errors import NotFoundError
from app.services.inventory.purchase_order_service import PurchaseOrderService
from app.utils.decorators import permission_required

purchases_bp = Blueprint("purchases", __name__, url_prefix="/purchase-orders")
po_service = PurchaseOrderService()


@purchases_bp.route("/")
@permission_required("manage_products", "adjust_stock")
def list_orders():
    args = FormReader(request.args)
    return render_template("purchases/list.html",
                           page=po_service.list_page(args.text("status"), args.optional_int("supplier_id")))


@purchases_bp.route("/product-rows")
@permission_required("manage_products", "adjust_stock")
def product_rows():
    """Fragment used by the new/edit PO form: refreshes just the product table
    when the supplier changes, without reloading the whole page."""
    supplier_id = FormReader(request.args).optional_int("supplier_id")
    page = po_service.form_page(supplier_id=supplier_id)
    return render_template("purchases/_product_rows.html", page=page)


@purchases_bp.route("/new", methods=["GET", "POST"])
@permission_required("manage_products", "adjust_stock")
def create_order():
    if request.method == "POST":
        try:
            data = PurchaseOrderInput.from_form(request.form)
            order = po_service.save_draft(current_user, data.supplier_id, data.expected_date, data.notes,
                                          data.lines)
            flash(f"{order.reference} saved as a draft.", "success")
            return redirect(url_for("purchases.view_order", po_id=order.id))
        except ValueError as exc:
            flash(str(exc), "error")
    supplier_id = FormReader(request.args).optional_int("supplier_id")
    return render_template("purchases/form.html", page=po_service.form_page(supplier_id=supplier_id), form={})


@purchases_bp.route("/<int:po_id>")
@permission_required("manage_products", "adjust_stock")
def view_order(po_id: int):
    try:
        order = po_service.get(po_id)
    except NotFoundError as exc:
        flash(str(exc), "error")
        return redirect(url_for("purchases.list_orders"))
    return render_template("purchases/detail.html", order=order)


@purchases_bp.route("/<int:po_id>/edit", methods=["GET", "POST"])
@permission_required("manage_products", "adjust_stock")
def edit_order(po_id: int):
    if request.method == "POST":
        try:
            data = PurchaseOrderInput.from_form(request.form)
            order = po_service.save_draft(current_user, data.supplier_id, data.expected_date, data.notes,
                                          data.lines, po_id=po_id)
            flash(f"{order.reference} updated.", "success")
            return redirect(url_for("purchases.view_order", po_id=order.id))
        except ValueError as exc:
            flash(str(exc), "error")
    try:
        page = po_service.form_page(po_id=po_id)
    except ValueError as exc:
        flash(str(exc), "error")
        return redirect(url_for("purchases.view_order", po_id=po_id))
    return render_template("purchases/form.html", page=page, form={})


@purchases_bp.route("/<int:po_id>/place", methods=["POST"])
@permission_required("manage_products", "adjust_stock")
def place_order(po_id: int):
    try:
        order = po_service.place_order(po_id, current_user)
        flash(f"{order.reference} placed with {order.supplier_name}.", "success")
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("purchases.view_order", po_id=po_id))


@purchases_bp.route("/<int:po_id>/receive", methods=["POST"])
@permission_required("manage_products", "adjust_stock")
def receive_order(po_id: int):
    try:
        order = po_service.receive(po_id, current_user)
        flash(f"{order.reference} received — {order.unit_count} units added to stock.", "success")
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("purchases.view_order", po_id=po_id))


@purchases_bp.route("/<int:po_id>/cancel", methods=["POST"])
@permission_required("manage_products", "adjust_stock")
def cancel_order(po_id: int):
    try:
        order = po_service.cancel(po_id, current_user)
        flash(f"{order.reference} cancelled.", "info")
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("purchases.view_order", po_id=po_id))
