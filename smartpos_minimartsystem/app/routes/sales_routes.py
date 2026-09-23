"""
Sales History and Refunds Blueprint
"""

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from ..extensions import login_required, permission_required, auth_manager
from ..repositories.sale_repository import SaleRepository
from ..services.refund_service import RefundService

sales_bp = Blueprint('sales', __name__, url_prefix='/sales')
sale_repo = SaleRepository()
refund_service = RefundService(sale_repo)


@sales_bp.route('/')
@login_required
def history():
    current_user = auth_manager.get_current_user()
    sales = sale_repo.get_all(limit=100)
    return render_template('sales/history.html', user=current_user, sales=sales)


@sales_bp.route('/<int:sale_id>/receipt')
@login_required
def view_receipt(sale_id):
    current_user = auth_manager.get_current_user()
    sale = sale_repo.get_by_id(sale_id)
    if not sale:
        flash("Transaction receipt not found.", 'error')
        return redirect(url_for('sales.history'))
    return render_template('sales/receipt_modal.html', user=current_user, sale=sale)


@sales_bp.route('/<int:sale_id>/refund', methods=['POST'])
@login_required
@permission_required('process_refund')
def refund_sale(sale_id):
    current_user = auth_manager.get_current_user()
    sale = sale_repo.get_by_id(sale_id)
    if not sale:
        flash("Sale not found.", 'error')
        return redirect(url_for('sales.history'))

    reason = request.form.get('reason', 'Customer Return')
    notes = request.form.get('notes', '')

    # Prepare refund items from all items in this sale
    items_data = []
    for item in sale.items:
        items_data.append({
            'sale_item_id': item.id,
            'product_id': item.product_id,
            'quantity': item.quantity,
            'unit_price': item.unit_price
        })

    refund, error = refund_service.process_refund(sale_id, current_user.id, items_data, reason, notes)
    if error:
        flash(error, 'error')
    else:
        flash(f"Sale {sale.transaction_code} has been successfully refunded and inventory restored.", 'success')

    return redirect(url_for('sales.history'))
