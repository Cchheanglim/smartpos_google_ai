"""
Products controller — thin: parse request -> ONE service call -> render/redirect.
No SQL and no business rules live here.
"""
from flask import Blueprint, current_app, flash, redirect, render_template, request, url_for
from flask_login import current_user

from app.forms.inventory_forms import ProductInput, StockAdjustmentInput, product_filter_from_args
from app.services.inventory.product_service import ProductService
from app.utils.barcode import code39_svg
from app.utils.decorators import permission_required

products_bp = Blueprint("products", __name__, url_prefix="/products")
product_service = ProductService()


@products_bp.route("/")
@permission_required("manage_products", "adjust_stock", "view_cost_prices")
def list_products():
    try:
        product_filter = product_filter_from_args(request.args, current_app.config["PRODUCTS_PER_PAGE"])
    except ValueError as exc:
        flash(str(exc), "error")
        return redirect(url_for("products.list_products"))
    page = product_service.list_page(product_filter)
    return render_template("inventory/products_list.html", page=page)


@products_bp.route("/new", methods=["GET", "POST"])
@permission_required("manage_products")
def create_product():
    if request.method == "POST":
        try:
            product = product_service.create_product(
                ProductInput.from_form(request.form), request.files.get("image"), current_user.id, current_user.name)
        except ValueError as exc:
            flash(str(exc), "error")
            return render_template("inventory/products_form.html",
                                   page=product_service.form_page(), form=request.form), 400
        flash(f"Product '{product.name}' created.", "success")
        return redirect(url_for("products.view_product", product_id=product.id))
    return render_template("inventory/products_form.html", page=product_service.form_page(), form={})


@products_bp.route("/<int:product_id>")
@permission_required("manage_products", "adjust_stock", "view_cost_prices")
def view_product(product_id: int):
    return render_template("inventory/products_detail.html", page=product_service.detail_page(product_id))


@products_bp.route("/<int:product_id>/edit", methods=["GET", "POST"])
@permission_required("manage_products")
def edit_product(product_id: int):
    if request.method == "POST":
        try:
            product = product_service.update_product(
                product_id, ProductInput.from_form(request.form), request.files.get("image"))
        except ValueError as exc:
            flash(str(exc), "error")
            return render_template("inventory/products_form.html",
                                   page=product_service.form_page(product_id), form=request.form), 400
        flash(f"Product '{product.name}' updated.", "success")
        return redirect(url_for("products.view_product", product_id=product.id))
    return render_template("inventory/products_form.html",
                           page=product_service.form_page(product_id), form={})


@products_bp.route("/<int:product_id>/delete", methods=["POST"])
@permission_required("delete_products")
def delete_product(product_id: int):
    try:
        product = product_service.delete_product(product_id)
        flash(f"Product '{product.name}' deleted.", "success")
    except ValueError as exc:
        flash(str(exc), "error")
        return redirect(url_for("products.view_product", product_id=product_id))
    return redirect(url_for("products.list_products"))


@products_bp.route("/<int:product_id>/adjust", methods=["POST"])
@permission_required("adjust_stock")
def adjust_stock(product_id: int):
    try:
        product = product_service.adjust_stock(
            product_id, StockAdjustmentInput.from_form(request.form), current_user.id, current_user.name)
        flash(f"Stock updated — {product.name} now has {product.quantity_in_stock} units.", "success")
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("products.view_product", product_id=product_id))


@products_bp.route("/movements")
@permission_required("adjust_stock", "manage_products")
def movements():
    """Waste-auditing ledger view, filterable by reason code."""
    reason = request.args.get("reason", "")
    return render_template("inventory/movements.html", **product_service.movements_page(reason))


@products_bp.route("/barcodes")
@permission_required("print_barcodes", "manage_products")
def barcodes():
    """Printable 38x25mm shelf-label sheet."""
    ids = [int(i) for i in request.args.getlist("id") if i.isdigit()]
    products = product_service.barcode_sheet(ids)
    svgs = {p.id: code39_svg(p.scan_code, height=40) for p in products}
    return render_template("inventory/barcodes.html", products=products, barcodes=svgs)
