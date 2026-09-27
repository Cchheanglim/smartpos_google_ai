"""Supplier directory controller."""
from flask import Blueprint, flash, redirect, render_template, request, url_for

from app.forms.inventory_forms import SupplierInput
from app.services.inventory.supplier_service import SupplierService
from app.utils.decorators import permission_required

suppliers_bp = Blueprint("suppliers", __name__, url_prefix="/suppliers")
supplier_service = SupplierService()


@suppliers_bp.route("/", methods=["GET", "POST"])
@permission_required("manage_products")
def list_suppliers():
    if request.method == "POST":
        try:
            supplier = supplier_service.create(SupplierInput.from_form(request.form))
            flash(f"Supplier '{supplier.name}' added.", "success")
        except ValueError as exc:
            flash(str(exc), "error")
        return redirect(url_for("suppliers.list_suppliers"))
    return render_template("inventory/suppliers.html", suppliers=supplier_service.list_suppliers())


@suppliers_bp.route("/<int:supplier_id>/edit", methods=["GET", "POST"])
@permission_required("manage_products")
def edit_supplier(supplier_id: int):
    if request.method == "POST":
        try:
            supplier = supplier_service.update(supplier_id, SupplierInput.from_form(request.form))
            flash(f"Supplier '{supplier.name}' updated.", "success")
            return redirect(url_for("suppliers.list_suppliers"))
        except ValueError as exc:
            flash(str(exc), "error")
    return render_template("inventory/supplier_form.html", supplier=supplier_service.get(supplier_id))


@suppliers_bp.route("/<int:supplier_id>/delete", methods=["POST"])
@permission_required("manage_products")
def delete_supplier(supplier_id: int):
    try:
        supplier = supplier_service.delete(supplier_id)
        flash(f"Supplier '{supplier.name}' deleted.", "success")
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("suppliers.list_suppliers"))
