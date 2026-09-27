"""Shift clock-in/out and cash-drawer reconciliation."""
from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import current_user

from app.forms.base import FormReader
from app.forms.staff_forms import DrawerCountInput
from app.services.errors import NotFoundError
from app.services.staff.attendance_service import AttendanceService
from app.utils.decorators import permission_required

attendance_bp = Blueprint("attendance", __name__, url_prefix="/shift")
attendance_service = AttendanceService()


@attendance_bp.route("/")
@permission_required("process_sale", "adjust_drawer_cash")
def my_shift():
    return render_template("attendance/my_shift.html", page=attendance_service.my_shift_page(current_user))


@attendance_bp.route("/clock-in", methods=["POST"])
@permission_required("process_sale", "adjust_drawer_cash")
def clock_in():
    data = DrawerCountInput.from_form(request.form)
    try:
        attendance_service.clock_in(current_user, data.usd, data.notes)
        flash(f"Clocked in with ${data.usd:.2f} float.", "success")
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("attendance.my_shift"))


@attendance_bp.route("/clock-out", methods=["POST"])
@permission_required("process_sale", "adjust_drawer_cash")
def clock_out():
    data = DrawerCountInput.from_form(request.form)
    try:
        session = attendance_service.clock_out(current_user, data.usd, data.notes)
        flash(attendance_service.describe(session.status, session.cash_difference), "success")
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("attendance.my_shift"))


@attendance_bp.route("/cash", methods=["POST"])
@permission_required("adjust_drawer_cash")
def adjust_cash():
    form = FormReader(request.form)
    try:
        attendance_service.adjust_drawer(current_user, form.text("direction"),
                                         form.decimal("amount", "Amount"), form.text("reason"))
        flash("Drawer updated.", "success")
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("attendance.my_shift"))


@attendance_bp.route("/audit")
@permission_required("manage_cashier_accounts")
def audit():
    args = FormReader(request.args)
    return render_template("attendance/audit.html",
                           page=attendance_service.audit_page(args.optional_int("user_id"), args.text("status")))


@attendance_bp.route("/audit/<int:attendance_id>")
@permission_required("manage_cashier_accounts")
def detail(attendance_id: int):
    try:
        page = attendance_service.session_detail(attendance_id)
    except NotFoundError as exc:
        flash(str(exc), "error")
        return redirect(url_for("attendance.audit"))
    return render_template("attendance/detail.html", page=page)


@attendance_bp.route("/audit/<int:attendance_id>/force-close", methods=["POST"])
@permission_required("manage_cashier_accounts")
def force_close(attendance_id: int):
    data = DrawerCountInput.from_form(request.form)
    try:
        attendance_service.force_close(attendance_id, data.usd, data.notes, current_user)
        flash("Shift force-closed.", "success")
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("attendance.audit"))
