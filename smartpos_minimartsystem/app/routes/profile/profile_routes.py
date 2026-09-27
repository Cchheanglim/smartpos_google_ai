"""My Profile controller."""
from flask import Blueprint, flash, redirect, render_template, request, url_for
from flask_login import current_user, login_required

from app.forms.staff_forms import PasswordChangeInput, ProfileInput
from app.services.auth.profile_service import ProfileService

profile_bp = Blueprint("profile", __name__, url_prefix="/profile")
profile_service = ProfileService()


@profile_bp.route("/")
@login_required
def index():
    return render_template("profile/index.html", user=profile_service.get_profile(current_user.id))


@profile_bp.route("/", methods=["POST"])
@login_required
def update():
    try:
        profile_service.update_profile(current_user.id, ProfileInput.from_form(request.form),
                                       request.files.get("avatar"))
        flash("Profile updated.", "success")
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("profile.index"))


@profile_bp.route("/password", methods=["POST"])
@login_required
def change_password():
    try:
        profile_service.change_password(current_user.id, PasswordChangeInput.from_form(request.form))
        flash("Password changed.", "success")
    except ValueError as exc:
        flash(str(exc), "error")
    return redirect(url_for("profile.index"))
