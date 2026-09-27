"""Loyalty customers (CRM) controller."""
from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import current_user

from app.forms.base import FormReader
from app.forms.sales_forms import CustomerInput
from app.services.sales.customer_service import CustomerService
from app.utils.decorators import permission_required

customers_bp = Blueprint("customers", __name__, url_prefix="/customers")
customer_service = CustomerService()


@customers_bp.route("/")
@permission_required("manage_loyalty_customers")
def list_customers():
    args = FormReader(request.args)
    return render_template("sales/customers.html",
                           page=customer_service.list_page(args.text("q"), args.text("tier")))


@customers_bp.route("/new", methods=["GET", "POST"])
@permission_required("manage_loyalty_customers")
def create_customer():
    if request.method == "POST":
        try:
            customer = customer_service.register(CustomerInput.from_form(request.form))
            flash(f"{customer.name} registered as a loyalty member.", "success")
            return_to = request.form.get("return_to", "")
            safe = return_to.startswith("/") and not return_to.startswith("//")
            return redirect(return_to if safe else url_for("customers.list_customers"))
        except ValueError as exc:
            flash(str(exc), "error")
    return render_template("sales/customer_form.html", page=customer_service.form_page(), form=request.form)


@customers_bp.route("/<int:customer_id>/edit", methods=["GET", "POST"])
@permission_required("manage_loyalty_customers")
def edit_customer(customer_id: int):
    if request.method == "POST":
        try:
            customer = customer_service.update(customer_id, CustomerInput.from_form(request.form), current_user)
            flash(f"{customer.name} updated.", "success")
            return redirect(url_for("customers.list_customers"))
        except ValueError as exc:
            flash(str(exc), "error")
    return render_template("sales/customer_form.html",
                           page=customer_service.form_page(customer_id), form=request.form)


@customers_bp.route("/<int:customer_id>/delete", methods=["POST"])
@permission_required("delete_customers")
def delete_customer(customer_id: int):
    try:
        customer = customer_service.delete(customer_id)
        flash(f"{customer.name} removed.", "success")
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("customers.list_customers"))
