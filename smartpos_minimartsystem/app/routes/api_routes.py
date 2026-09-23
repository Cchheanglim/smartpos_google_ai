"""
RESTful JSON API Blueprint for AJAX / Fetch Frontends
"""

from flask import Blueprint, request, jsonify, current_app
from ..extensions import login_required, auth_manager
from ..services.product_service import ProductService
from ..services.customer_service import CustomerService
from ..services.checkout_service import CheckoutService

api_bp = Blueprint('api', __name__, url_prefix='/api')
product_service = ProductService()
customer_service = CustomerService()
checkout_service = CheckoutService()


@api_bp.route('/barcode-lookup')
@login_required
def barcode_lookup():
    code = request.args.get('code', '').strip()
    if not code:
        return jsonify({'success': False, 'error': 'No barcode provided'}), 400

    product = product_service.find_by_barcode_or_sku(code)
    if not product:
        return jsonify({'success': False, 'error': f"Product with code '{code}' not found"}), 404

    return jsonify({
        'success': True,
        'product': product.to_dict()
    })


@api_bp.route('/customer-lookup')
@login_required
def customer_lookup():
    phone = request.args.get('phone', '').strip()
    if not phone:
        return jsonify({'success': False, 'error': 'Phone number required'}), 400

    customer = customer_service.find_by_phone(phone)
    if not customer:
        return jsonify({'success': False, 'error': 'Customer not registered in loyalty database'}), 404

    return jsonify({
        'success': True,
        'customer': customer.to_dict()
    })


@api_bp.route('/calculate-cart', methods=['POST'])
@login_required
def calculate_cart():
    payload = request.get_json() or {}
    items = payload.get('items', [])
    discount_percent = float(payload.get('discount_percent', 0.0))
    customer_id = payload.get('customer_id')
    points_to_redeem = int(payload.get('points_to_redeem', 0))
    exchange_rate = float(payload.get('exchange_rate', current_app.config.get('KHR_EXCHANGE_RATE', 4100.0)))

    calculation = checkout_service.calculate_cart(
        items_payload=items,
        cart_discount_percent=discount_percent,
        tax_percent=current_app.config.get('DEFAULT_TAX_PERCENT', 10.0),
        customer_id=customer_id,
        points_to_redeem=points_to_redeem,
        exchange_rate=exchange_rate
    )

    return jsonify({'success': True, 'calculation': calculation})


@api_bp.route('/checkout', methods=['POST'])
@login_required
def checkout():
    current_user = auth_manager.get_current_user()
    if not current_user.has_permission('process_sale'):
        return jsonify({'success': False, 'error': 'Forbidden: Cashier checkout permission required'}), 403

    payload = request.get_json() or {}
    items = payload.get('items', [])
    payment_data = payload.get('payment', {})
    customer_id = payload.get('customer_id')
    discount_pct = float(payload.get('discount_percent', 0.0))
    points_to_redeem = int(payload.get('points_to_redeem', 0))
    notes = payload.get('notes', '')

    sale, error = checkout_service.process_checkout(
        cashier_id=current_user.id,
        items_payload=items,
        payment_payload=payment_data,
        customer_id=customer_id,
        discount_percent=discount_pct,
        tax_percent=current_app.config.get('DEFAULT_TAX_PERCENT', 10.0),
        points_to_redeem=points_to_redeem,
        notes=notes
    )

    if error:
        return jsonify({'success': False, 'error': error}), 400

    return jsonify({
        'success': True,
        'sale': sale.to_dict()
    })
