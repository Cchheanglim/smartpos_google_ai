"""Sales history, receipts and refunds controller."""
from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import current_user

from app.forms.sales_forms import RefundInput, SalesFilterInput
from app.services.sales.refund_service import RefundService
from app.services.sales.sales_service import SalesService
from app.utils.barcode import code39_svg
from app.utils.decorators import permission_required

sales_bp = Blueprint("sales", __name__, url_prefix="/sales")
sales_service = SalesService()
refund_service = RefundService()


@sales_bp.route("/")
@permission_required("process_sale", "view_reports", "process_refund")
def history():
    try:
        page = sales_service.history_page(SalesFilterInput.from_args(request.args), current_user)
    except ValueError as exc:
        flash(str(exc), "error")
        return redirect(url_for("sales.history"))
    return render_template("sales/history.html", page=page)


@sales_bp.route("/refunds")
@permission_required("process_refund", "view_reports")
def refund_log():
    filters = SalesFilterInput.from_args(request.args)
    return render_template("sales/refund_log.html", page=sales_service.refund_log(filters))


@sales_bp.route("/<int:sale_id>")
@permission_required("process_sale", "view_reports", "process_refund")
def receipt(sale_id: int):
    view = sales_service.receipt(sale_id, current_user)
    return render_template("sales/receipt.html", view=view, barcode_svg=code39_svg(view.sale.receipt_number, height=40))


@sales_bp.route("/<int:sale_id>/refund", methods=["GET", "POST"])
@permission_required("process_refund")
def refund(sale_id: int):
    if request.method == "POST":
        try:
            result = refund_service.process_refund(sale_id, RefundInput.from_form(request.form), current_user)
            flash(f"Refund of ${result.refund_amount:.2f} recorded and stock restored.", "success")
            return redirect(url_for("sales.receipt", sale_id=sale_id))
        except ValueError as exc:
            flash(str(exc), "error")
    return render_template("sales/refund.html", sale=refund_service.refund_page(sale_id))
