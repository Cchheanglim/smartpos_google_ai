"""Role and permission management controller."""
from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import current_user

from app.forms.base import FormReader
from app.forms.staff_forms import role_matrix_from_form
from app.services.auth.permission_service import PermissionService
from app.services.auth.role_service import RoleService
from app.services.errors import NotFoundError
from app.utils.decorators import permission_required

roles_bp = Blueprint("roles", __name__, url_prefix="/roles")
role_service = RoleService()
permission_service = PermissionService()


@roles_bp.route("/")
@permission_required("manage_roles")
def index():
    return render_template("staff/roles_list.html", roles=role_service.list_roles())


@roles_bp.route("/new", methods=["POST"])
@permission_required("manage_roles")
def create():
    form = FormReader(request.form)
    try:
        role = role_service.create_role(form.text("name"), form.text("description"), current_user)
        flash(f"Role '{role.display_name}' created.", "success")
        return redirect(url_for("roles.configure", role_id=role.id))
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("roles.index"))


@roles_bp.route("/<int:role_id>/delete", methods=["POST"])
@permission_required("manage_roles")
def delete(role_id: int):
    try:
        role = role_service.delete_role(role_id, current_user)
        flash(f"Role '{role.display_name}' deleted.", "info")
    except (ValueError, NotFoundError) as exc:
        flash(str(exc), "error")
    return redirect(url_for("roles.index"))


@roles_bp.route("/<int:role_id>/configure", methods=["GET", "POST"])
@permission_required("manage_roles")
def configure(role_id: int):
    if request.method == "POST":
        ids = [int(v) for v in request.form.getlist("perm") if v.isdigit()]
        try:
            role = role_service.update_role_permissions(role_id, ids, current_user)
            flash(f"'{role.display_name}' permissions saved.", "success")
            return redirect(url_for("roles.index"))
        except ValueError as exc:
            flash(str(exc), "error")
    try:
        page = role_service.role_permissions_page(role_id)
    except NotFoundError as exc:
        flash(str(exc), "error")
        return redirect(url_for("roles.index"))
    return render_template("staff/role_configure.html", **page)


@roles_bp.route("/matrix", methods=["GET", "POST"])
@permission_required("manage_roles")
def matrix():
    if request.method == "POST":
        try:
            role_service.update_matrix(role_matrix_from_form(request.form), current_user)
            flash("Role permissions saved.", "success")
        except ValueError as exc:
            flash(str(exc), "error")
        return redirect(url_for("roles.matrix"))
    return render_template("staff/roles_matrix.html", page=role_service.matrix_page())


@roles_bp.route("/permissions", methods=["GET", "POST"])
@permission_required("manage_roles")
def permissions():
    if request.method == "POST":
        form = FormReader(request.form)
        try:
            perm = permission_service.create_permission(form.text("code"), form.text("description"),
                                                         form.text("group_name"), current_user)
            flash(f"Permission '{perm.name}' registered.", "success")
        except ValueError as exc:
            flash(str(exc), "error")
        return redirect(url_for("roles.permissions"))
    return render_template("staff/permissions.html", **permission_service.registry_page())
