"""
Product and Inventory Management Blueprint
"""

import os
from flask import Blueprint, render_template, request, redirect, url_for, flash, current_app
from werkzeug.utils import secure_filename
from ..extensions import login_required, permission_required, auth_manager
from ..services.product_service import ProductService
from ..forms.forms import ProductFormValidator

product_bp = Blueprint('products', __name__, url_prefix='/products')
product_service = ProductService()


def save_upload_image(file_storage):
    if not file_storage or not file_storage.filename:
        return None
    filename = secure_filename(file_storage.filename)
    if not filename:
        return None
    upload_dir = current_app.config['UPLOAD_FOLDER'] / 'products'
    os.makedirs(upload_dir, exist_ok=True)
    file_path = upload_dir / filename
    file_storage.save(str(file_path))
    return filename


@product_bp.route('/')
@login_required
def index():
    current_user = auth_manager.get_current_user()
    products = product_service.get_catalog()
    categories = product_service.get_categories()
    stock_logs = product_service.get_stock_adjustment_logs(20)

    return render_template(
        'products/index.html',
        user=current_user,
        products=products,
        categories=categories,
        stock_logs=stock_logs
    )


@product_bp.route('/add', methods=['POST'])
@login_required
@permission_required('manage_products')
def add_product():
    form_data = request.form.to_dict()
    val = ProductFormValidator.validate(form_data)
    if not val.is_valid:
        for err in val.errors.values():
            flash(err, 'error')
        return redirect(url_for('products.index'))

    # Handle image upload if provided
    if 'image' in request.files:
        saved_img = save_upload_image(request.files['image'])
        if saved_img:
            form_data['image_url'] = saved_img

    product, error = product_service.add_product(form_data)
    if error:
        flash(error, 'error')
    else:
        flash(f"Product '{product.name}' was successfully added to inventory.", 'success')

    return redirect(url_for('products.index'))


@product_bp.route('/<int:product_id>/edit', methods=['POST'])
@login_required
@permission_required('manage_products')
def edit_product(product_id):
    form_data = request.form.to_dict()
    val = ProductFormValidator.validate(form_data)
    if not val.is_valid:
        for err in val.errors.values():
            flash(err, 'error')
        return redirect(url_for('products.index'))

    if 'image' in request.files:
        saved_img = save_upload_image(request.files['image'])
        if saved_img:
            form_data['image_url'] = saved_img

    success, error = product_service.update_product(product_id, form_data)
    if error:
        flash(error, 'error')
    else:
        flash("Product updated successfully.", 'success')

    return redirect(url_for('products.index'))


@product_bp.route('/<int:product_id>/delete', methods=['POST'])
@login_required
@permission_required('delete_products')
def delete_product(product_id):
    product_service.product_repo.delete(product_id)
    flash("Product deactivated from inventory catalog.", 'info')
    return redirect(url_for('products.index'))


@product_bp.route('/<int:product_id>/adjust-stock', methods=['POST'])
@login_required
@permission_required('adjust_stock')
def adjust_stock(product_id):
    current_user = auth_manager.get_current_user()
    try:
        change = int(request.form.get('change_quantity', 0))
        reason = request.form.get('reason', 'Manual Adjustment')
        notes = request.form.get('notes', '')

        if change == 0:
            flash("Stock adjustment quantity cannot be zero.", 'warning')
            return redirect(url_for('products.index'))

        success, error = product_service.adjust_stock(product_id, change, reason, current_user.id, notes)
        if success:
            flash("Stock quantity updated and audit trail logged.", 'success')
        else:
            flash(error or "Could not adjust stock.", 'error')
    except ValueError:
        flash("Invalid quantity entered.", 'error')

    return redirect(url_for('products.index'))


@product_bp.route('/barcodes')
@login_required
@permission_required('print_barcodes')
def barcodes():
    current_user = auth_manager.get_current_user()
    products = product_service.get_catalog()
    return render_template('products/barcodes.html', user=current_user, products=products)
