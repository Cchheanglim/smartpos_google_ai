"""
POS checkout controller.

The cart and the discount/customer/points choices live in the session as
two plain dicts (``cart``, ``checkout_state``). Each handler hands them to
CheckoutService and stores back what it returns — the route never does any
pricing, stock or currency logic itself.
"""
from decimal import Decimal, InvalidOperation

from flask import Blueprint, current_app, flash, jsonify, redirect, render_template, request, session, url_for
from flask_login import current_user

from app.forms.base import FormReader
from app.forms.sales_forms import CartLineInput, CheckoutInput
from app.services.errors import NotFoundError
from app.services.sales.checkout_service import CheckoutService
from app.services.sales.held_order_service import HeldOrderService
from app.services.settings.settings_service import SettingsService
from app.utils.decorators import permission_required

checkout_bp = Blueprint("checkout", __name__, url_prefix="/checkout")
checkout_service = CheckoutService()
held_order_service = HeldOrderService()
settings_service = SettingsService()

CART_KEY = "cart"
STATE_KEY = "checkout_state"


def _cart() -> dict:
    return dict(session.get(CART_KEY, {}))


def _state() -> dict:
    return dict(session.get(STATE_KEY, {}))


def _back():
    return redirect(url_for("checkout.index", q=request.form.get("q") or None,
                            category_id=request.form.get("category_id") or None))


def _is_ajax() -> bool:
    return request.headers.get("X-Requested-With") == "XMLHttpRequest"


def _respond(ok: bool, message: str = "", **extra):
    """Optimistic-UI friendly: AJAX callers get JSON, normal forms get a redirect."""
    if _is_ajax():
        page = checkout_service.page(_cart(), _state(), current_user)
        return jsonify(ok=ok, message=message, cart_count=page.cart.item_count,
                       total=str(page.summary.total), **extra)
    if message:
        flash(message, "success" if ok else "error")
    return _back()


@checkout_bp.route("/")
@permission_required("process_sale")
def index():
    args = FormReader(request.args)
    page = checkout_service.page(_cart(), _state(), current_user, category_id=args.optional_int("category_id"))
    return render_template("sales/checkout.html", page=page, q=args.text("q"))


@checkout_bp.route("/panel")
@permission_required("process_sale")
def panel():
    """Order-panel fragment, re-fetched by JS after any cart change (no full page reload)."""
    page = checkout_service.page(_cart(), _state(), current_user)
    return render_template("sales/_order_panel.html", page=page)


@checkout_bp.route("/add", methods=["POST"])
@permission_required("process_sale")
def add_item():
    form = FormReader(request.form)
    try:
        if form.text("code"):
            cart, product = checkout_service.add_by_code(_cart(), form.text("code"))
            session[CART_KEY] = cart
            return _respond(True, f"Added {product.name}.")
        line = CartLineInput.from_form(request.form)
        session[CART_KEY] = checkout_service.add_item(_cart(), line.product_id, line.quantity)
    except ValueError as exc:
        return _respond(False, str(exc))
    return _respond(True)


@checkout_bp.route("/update", methods=["POST"])
@permission_required("process_sale")
def update_item():
    form = FormReader(request.form)
    try:
        session[CART_KEY] = checkout_service.set_quantity(
            _cart(), form.integer("product_id", "Product"), form.integer("quantity", "Quantity"))
    except ValueError as exc:
        return _respond(False, str(exc))
    return _respond(True)


@checkout_bp.route("/note", methods=["POST"])
@permission_required("process_sale")
def set_note():
    form = FormReader(request.form)
    try:
        session[CART_KEY] = checkout_service.set_note(
            _cart(), form.integer("product_id", "Product"), form.text("note"))
    except ValueError as exc:
        return _respond(False, str(exc))
    return _respond(True)


@checkout_bp.route("/clear", methods=["POST"])
@permission_required("process_sale")
def clear_cart():
    session.pop(CART_KEY, None)
    session.pop(STATE_KEY, None)
    flash("Cart cleared.", "info")
    return _back()


@checkout_bp.route("/discount", methods=["POST"])
@permission_required("process_sale")
def set_discount():
    form = FormReader(request.form)
    try:
        session[STATE_KEY] = checkout_service.set_discount(
            _state(), form.text("discount_type") or "percent", form.decimal("discount_value", "Discount"),
            current_user)
    except ValueError as exc:
        return _respond(False, str(exc))
    return _respond(True)


@checkout_bp.route("/customer", methods=["POST"])
@permission_required("process_sale")
def attach_customer():
    phone = FormReader(request.form).text("customer_phone")
    try:
        new_state, customer = checkout_service.attach_customer(_state(), phone)
        session[STATE_KEY] = new_state
        if customer:
            return _respond(True, f"{customer.name} ({customer.tier.label}) attached — "
                                  f"{customer.discount_percent}% member discount, {customer.points} pts.")
    except ValueError as exc:
        return _respond(False, str(exc))
    return _respond(True)


@checkout_bp.route("/points", methods=["POST"])
@permission_required("process_sale")
def redeem_points():
    form = FormReader(request.form)
    try:
        session[STATE_KEY] = checkout_service.set_points(_cart(), _state(), form.integer("points", "Points"))
    except ValueError as exc:
        return _respond(False, str(exc))
    return _respond(True)


@checkout_bp.route("/hold", methods=["POST"])
@permission_required("hold_orders")
def hold_order():
    label = FormReader(request.form).text("label")
    try:
        order = held_order_service.hold(current_user, _cart(), _state(), label)
        session.pop(CART_KEY, None)
        session.pop(STATE_KEY, None)
        flash(f"Order held as '{order.label}'.", "success")
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("checkout.index"))


@checkout_bp.route("/hold/<int:held_id>/resume", methods=["POST"])
@permission_required("hold_orders")
def resume_order(held_id: int):
    try:
        cart, state, order = held_order_service.resume(current_user, held_id)
        session[CART_KEY], session[STATE_KEY] = cart, state
        flash(f"Resumed '{order.label}'.", "success")
    except (ValueError, NotFoundError, PermissionError) as exc:
        flash(str(exc), "error")
    return redirect(url_for("checkout.index"))


@checkout_bp.route("/hold/<int:held_id>/delete", methods=["POST"])
@permission_required("hold_orders")
def delete_held_order(held_id: int):
    try:
        order = held_order_service.discard(current_user, held_id)
        flash(f"Discarded '{order.label}'.", "info")
    except (NotFoundError, PermissionError) as exc:
        flash(str(exc), "error")
    return redirect(url_for("checkout.index"))


@checkout_bp.route("/rate", methods=["POST"])
@permission_required("manage_currency")
def set_rate():
    try:
        rate = settings_service.update_exchange_rate(FormReader(request.form).integer("rate", "Rate"), current_user.id)
        flash(f"Exchange rate set to {rate}.", "success")
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("checkout.index"))


@checkout_bp.route("/complete", methods=["POST"])
@permission_required("process_sale")
def complete():
    try:
        sale = checkout_service.complete_sale(_cart(), CheckoutInput.from_form(request.form), current_user)
    except ValueError as exc:
        flash(str(exc), "error")
        return redirect(url_for("checkout.index"))
    session.pop(CART_KEY, None)
    session.pop(STATE_KEY, None)
    flash(f"Sale {sale.receipt_number} completed.", "success")
    return redirect(url_for("sales.receipt", sale_id=sale.id))
