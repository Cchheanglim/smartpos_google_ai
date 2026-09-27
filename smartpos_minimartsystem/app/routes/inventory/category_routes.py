"""Category directory controller."""
from flask import Blueprint, flash, redirect, render_template, request, url_for

from app.forms.inventory_forms import CategoryInput
from app.services.inventory.category_service import CategoryService
from app.utils.decorators import permission_required

categories_bp = Blueprint("categories", __name__, url_prefix="/categories")
category_service = CategoryService()


@categories_bp.route("/", methods=["GET", "POST"])
@permission_required("manage_categories")
def list_categories():
    if request.method == "POST":
        try:
            category = category_service.create(CategoryInput.from_form(request.form))
            flash(f"Category '{category.name}' added.", "success")
        except ValueError as exc:
            flash(str(exc), "error")
        return redirect(url_for("categories.list_categories"))
    return render_template("inventory/categories.html", page=category_service.list_page())


@categories_bp.route("/<int:category_id>/edit", methods=["GET", "POST"])
@permission_required("manage_categories")
def edit_category(category_id: int):
    if request.method == "POST":
        try:
            category = category_service.update(category_id, CategoryInput.from_form(request.form))
            flash(f"Category '{category.name}' updated.", "success")
            return redirect(url_for("categories.list_categories"))
        except ValueError as exc:
            flash(str(exc), "error")
    return render_template("inventory/category_form.html", page=category_service.form_page(category_id))


@categories_bp.route("/<int:category_id>/delete", methods=["POST"])
@permission_required("manage_categories")
def delete_category(category_id: int):
    try:
        category = category_service.delete(category_id)
        flash(f"Category '{category.name}' deleted.", "success")
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("categories.list_categories"))
