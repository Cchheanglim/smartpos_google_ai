"""
Point of Sale Register Blueprint
"""

from flask import Blueprint, render_template, current_app
from ..extensions import login_required, permission_required, auth_manager
from ..services.product_service import ProductService
from ..services.customer_service import CustomerService

pos_bp = Blueprint('pos', __name__, url_prefix='/pos')
product_service = ProductService()
customer_service = CustomerService()


@pos_bp.route('/')
@login_required
@permission_required('process_sale')
def index():
    current_user = auth_manager.get_current_user()
    products = product_service.get_catalog()
    categories = product_service.get_categories()
    customers = customer_service.get_all_customers()
    exchange_rate = current_app.config.get('KHR_EXCHANGE_RATE', 4100.0)
    tax_percent = current_app.config.get('DEFAULT_TAX_PERCENT', 10.0)

    return render_template(
        'pos/checkout.html',
        user=current_user,
        products=products,
        categories=categories,
        customers=customers,
        exchange_rate=exchange_rate,
        tax_percent=tax_percent
    )
