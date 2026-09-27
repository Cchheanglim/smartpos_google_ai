"""Staff management controller (staff directory, lifecycle, overrides, shifts)."""
from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import current_user

from app.forms.base import FormReader
from app.forms.staff_forms import ShiftInput, StaffInput, user_overrides_from_form
from app.services.auth.staff_service import StaffService
from app.services.errors import NotFoundError
from app.services.notifications.telegram_service import TelegramService
from app.services.staff.shift_service import ShiftService
from app.utils.decorators import permission_required

staff_bp = Blueprint("staff", __name__, url_prefix="/staff")
staff_service = StaffService()
shift_service = ShiftService()
telegram_service = TelegramService()


@staff_bp.route("/")
@permission_required("manage_users")
def list_staff():
    args = FormReader(request.args)
    page = staff_service.directory(args.text("q"), args.optional_int("role_id"), args.text("status") or "active")
    return render_template("staff/list.html", page=page, telegram_configured=telegram_service.is_configured())


@staff_bp.route("/telegram-test", methods=["POST"])
@permission_required("manage_users")
def telegram_test():
    if telegram_service.send_test_alert(current_user.name):
        flash("Test alert sent — check your Telegram chat.", "success")
    elif not telegram_service.is_configured():
        flash("Telegram isn't configured yet — set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env "
             "and restart the app.", "error")
    else:
        flash("Telegram rejected the message — double check the bot token and chat ID, and that the "
             "bot has been added to that chat.", "error")
    return redirect(url_for("staff.list_staff"))


@staff_bp.route("/new", methods=["GET", "POST"])
@permission_required("manage_users")
def create_staff():
    if request.method == "POST":
        try:
            user = staff_service.create_staff(StaffInput.from_form(request.form), current_user)
            flash(f"Staff account for {user.name} created.", "success")
            return redirect(url_for("staff.list_staff"))
        except ValueError as exc:
            flash(str(exc), "error")
    return render_template("staff/form.html", page=staff_service.form_page(), form=request.form)


@staff_bp.route("/<int:user_id>/edit", methods=["GET", "POST"])
@permission_required("manage_users")
def edit_staff(user_id: int):
    if request.method == "POST":
        try:
            user = staff_service.update_staff(user_id, StaffInput.from_form(request.form), current_user)
            flash(f"{user.name} updated.", "success")
            return redirect(url_for("staff.list_staff"))
        except ValueError as exc:
            flash(str(exc), "error")
    return render_template("staff/form.html", page=staff_service.form_page(user_id), form=request.form)


@staff_bp.route("/<int:user_id>/reset-password", methods=["POST"])
@permission_required("admin_reset_password")
def reset_password(user_id: int):
    try:
        user = staff_service.reset_password(user_id, request.form.get("new_password", ""), current_user)
        flash(f"Password for {user.name} has been reset.", "success")
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("staff.edit_staff", user_id=user_id))


@staff_bp.route("/<int:user_id>/deactivate", methods=["POST"])
@permission_required("delete_staff")
def deactivate_staff(user_id: int):
    reason = request.form.get("reason", "")
    try:
        user = staff_service.deactivate(user_id, current_user, reason)
        flash(f"{user.name} has been deactivated.", "success")
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("staff.list_staff"))


@staff_bp.route("/<int:user_id>/reactivate", methods=["GET", "POST"])
@permission_required("manage_users")
def reactivate_staff(user_id: int):
    if request.method == "POST":
        form = FormReader(request.form)
        try:
            user = staff_service.reactivate(user_id, current_user, request.form.get("new_password", ""),
                                            form.optional_int("role_id"))
            flash(f"{user.name} reactivated.", "success")
            return redirect(url_for("staff.list_staff"))
        except ValueError as exc:
            flash(str(exc), "error")
    return render_template("staff/reactivate.html", page=staff_service.form_page(user_id))


@staff_bp.route("/<int:user_id>/delete", methods=["POST"])
@permission_required("delete_staff")
def delete_staff(user_id: int):
    try:
        user = staff_service.delete_staff(user_id, current_user)
        flash(f"{user.name} deleted.", "info")
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("staff.list_staff"))


@staff_bp.route("/<int:user_id>/avatar/remove", methods=["POST"])
@permission_required("manage_users")
def remove_avatar(user_id: int):
    try:
        staff_service.remove_avatar(user_id, current_user)
        flash("Profile picture removed.", "success")
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("staff.edit_staff", user_id=user_id))


@staff_bp.route("/<int:user_id>/overrides", methods=["POST"])
@permission_required("manage_roles")
def set_overrides(user_id: int):
    try:
        staff_service.set_overrides(user_id, user_overrides_from_form(request.form), current_user)
        flash("Individual permissions updated.", "success")
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("staff.edit_staff", user_id=user_id))


# ---------------- shift templates ----------------
@staff_bp.route("/shifts", methods=["GET", "POST"])
@permission_required("manage_shifts")
def shifts():
    if request.method == "POST":
        try:
            shift_service.save(ShiftInput.from_form(request.form))
            flash("Shift saved.", "success")
        except ValueError as exc:
            flash(str(exc), "error")
        return redirect(url_for("staff.shifts"))
    return render_template("staff/shifts.html", shifts=shift_service.list_shifts())


@staff_bp.route("/shifts/<int:shift_id>/delete", methods=["POST"])
@permission_required("manage_shifts")
def delete_shift(shift_id: int):
    try:
        shift_service.delete(shift_id)
        flash("Shift removed.", "info")
    except NotFoundError as exc:
        flash(str(exc), "error")
    return redirect(url_for("staff.shifts"))
