"""
Dashboard Blueprint
"""

from flask import Blueprint, render_template
from ..extensions import login_required, auth_manager
from ..services.report_service import ReportService
from ..repositories.sale_repository import SaleRepository
from ..repositories.product_repository import ProductRepository

dashboard_bp = Blueprint('dashboard', __name__)
report_service = ReportService()
sale_repo = SaleRepository()
product_repo = ProductRepository()


@dashboard_bp.route('/')
@dashboard_bp.route('/dashboard')
@login_required
def index():
    current_user = auth_manager.get_current_user()
    summary = report_service.get_executive_summary()
    recent_sales = sale_repo.get_all(limit=6)
    low_stock_items = product_repo.get_low_stock()[:6]

    return render_template(
        'dashboard/index.html',
        user=current_user,
        metrics=summary['metrics'],
        sales_trend=summary['sales_trend'],
        top_products=summary['top_products'],
        recent_sales=recent_sales,
        low_stock_items=low_stock_items
    )
