"""
Reports and Task Management Blueprints
"""

import csv
import io
from flask import Blueprint, render_template, request, redirect, url_for, flash, Response
from ..extensions import login_required, permission_required, auth_manager
from ..services.customer_service import ReportService, TaskService, CustomerService
from ..repositories.sale_repository import SaleRepository
from ..repositories.user_repository import UserRepository

report_bp = Blueprint('reports', __name__, url_prefix='/reports')
task_bp = Blueprint('tasks', __name__, url_prefix='/tasks')

report_service = ReportService()
task_service = TaskService()
customer_service = CustomerService()
sale_repo = SaleRepository()
user_repo = UserRepository()


@report_bp.route('/')
@login_required
@permission_required('view_reports')
def index():
    current_user = auth_manager.get_current_user()
    summary = report_service.get_executive_summary()
    customers = customer_service.get_all_customers()

    return render_template(
        'reports/index.html',
        user=current_user,
        metrics=summary['metrics'],
        sales_trend=summary['sales_trend'],
        top_products=summary['top_products'],
        category_revenue=summary['category_revenue'],
        customers=customers
    )


@report_bp.route('/export-csv')
@login_required
@permission_required('export_reports')
def export_csv():
    sales = sale_repo.get_all(limit=500)
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        'Transaction Code', 'Cashier', 'Customer', 'Date',
        'Subtotal (USD)', 'Discount (USD)', 'Tax (USD)',
        'Total (USD)', 'Total (KHR)', 'Payment Method', 'Status'
    ])

    for s in sales:
        writer.writerow([
            s.transaction_code,
            s.cashier_name,
            s.customer_name or 'Walk-in Customer',
            s.completed_at.strftime('%Y-%m-%d %H:%M:%S') if s.completed_at else '',
            f"{s.subtotal:.2f}",
            f"{s.discount_amount:.2f}",
            f"{s.tax_amount:.2f}",
            f"{s.total_amount:.2f}",
            s.total_khr,
            s.payment.method,
            s.status
        ])

    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=smartpos_sales_report.csv"}
    )


@task_bp.route('/')
@login_required
def index():
    current_user = auth_manager.get_current_user()
    tasks = task_service.list_tasks()
    staff_members = user_repo.get_all()

    return render_template(
        'tasks/index.html',
        user=current_user,
        tasks=tasks,
        staff_members=staff_members
    )


@task_bp.route('/add', methods=['POST'])
@login_required
@permission_required('manage_tasks')
def add_task():
    current_user = auth_manager.get_current_user()
    data = request.form.to_dict()
    task, error = task_service.create_task(data, current_user.id)
    if error:
        flash(error, 'error')
    else:
        flash("Task assigned successfully.", 'success')
    return redirect(url_for('tasks.index'))


@task_bp.route('/<int:task_id>/status', methods=['POST'])
@login_required
def update_status(task_id):
    status = request.form.get('status', 'completed')
    task_service.update_task_status(task_id, status)
    flash("Task status updated.", 'info')
    return redirect(url_for('tasks.index'))
