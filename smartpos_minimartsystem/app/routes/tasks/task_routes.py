"""Team task delegation board."""
from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import current_user

from app.forms.base import FormReader
from app.forms.staff_forms import TaskInput
from app.services.errors import NotFoundError
from app.services.staff.task_service import TaskService
from flask_login import login_required

tasks_bp = Blueprint("tasks", __name__, url_prefix="/tasks")
task_service = TaskService()


@tasks_bp.route("/")
@login_required
def board():
    args = FormReader(request.args)
    page = task_service.board(current_user, args.optional_int("assigned_to"), args.optional_int("assigned_by"),
                              args.text("priority"))
    return render_template("tasks/board.html", page=page)


@tasks_bp.route("/new", methods=["POST"])
@login_required
def create():
    form = FormReader(request.form)
    try:
        data = TaskInput.from_form(request.form)
        task_service.create(current_user, data.title, data.assigned_to, data.priority, data.due_date,
                            data.description)
        flash("Task assigned.", "success")
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("tasks.board"))


@tasks_bp.route("/<int:task_id>/status", methods=["POST"])
@login_required
def update_status(task_id: int):
    status = FormReader(request.form).text("status")
    try:
        task_service.change_status(current_user, task_id, status)
    except (ValueError, PermissionError, NotFoundError) as exc:
        flash(str(exc), "error")
    return redirect(url_for("tasks.board"))


@tasks_bp.route("/<int:task_id>/delete", methods=["POST"])
@login_required
def delete(task_id: int):
    try:
        task_service.delete(current_user, task_id)
        flash("Task deleted.", "info")
    except (ValueError, PermissionError, NotFoundError) as exc:
        flash(str(exc), "error")
    return redirect(url_for("tasks.board"))
