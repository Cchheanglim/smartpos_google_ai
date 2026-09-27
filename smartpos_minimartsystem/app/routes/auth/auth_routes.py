"""Login / logout controller."""
from flask import Blueprint, flash, redirect, render_template, request, session, url_for
from flask_login import current_user, login_required, login_user, logout_user

from app.forms.base import FormReader
from app.forms.staff_forms import LoginInput
from app.services.auth.auth_service import AuthService

auth_bp = Blueprint("auth", __name__)
auth_service = AuthService()


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard.index"))
    if request.method == "POST":
        try:
            data = LoginInput.from_form(request.form)
            user = auth_service.authenticate(data.email, data.password)
        except ValueError as exc:
            flash(str(exc), "error")
            return render_template("auth/login.html", email=request.form.get("email", "")), 401
        session.clear()                      # prevent session fixation
        login_user(user, remember=data.remember)
        flash(f"Welcome back, {user.name}!", "success")
        next_url = request.args.get("next", "")
        return redirect(next_url if next_url.startswith("/") and not next_url.startswith("//")
                        else url_for("dashboard.index"))
    return render_template("auth/login.html", email="")


@auth_bp.route("/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    session.clear()
    flash("You have been logged out.", "info")
    return redirect(url_for("auth.login"))


@auth_bp.route("/switch-user", methods=["GET", "POST"])
@login_required
def switch_user():
    """Fast user switching: a colleague signs in on this terminal without the
    current person fully logging out (their own session is simply replaced)."""
    switchable = auth_service.switchable_users(current_user)
    if request.method == "POST":
        f = FormReader(request.form)
        target_id = f.optional_int("user_id")
        target = next((u for u in switchable if u.id == target_id), None)
        if target is None:
            flash("Choose who is taking over the terminal.", "error")
        elif not auth_service.verify_password(target, f.text("password")):
            flash("Incorrect password.", "error")
        else:
            session.clear()
            login_user(target)
            flash(f"Switched to {target.name}.", "success")
            return redirect(url_for("dashboard.index"))
    return render_template("auth/switch_user.html", switchable=switchable)


@auth_bp.route("/lock", methods=["GET", "POST"])
@login_required
def lock():
    """Emergency terminal lock: the shift stays open, but every page requires
    the password again before the register can be used."""
    if request.method == "POST":
        if auth_service.verify_password(current_user, FormReader(request.form).text("password")):
            session.pop("locked", None)
            flash("Terminal unlocked.", "success")
            return redirect(request.args.get("next") or url_for("dashboard.index"))
        flash("Incorrect password.", "error")
    elif request.args.get("engage"):
        session["locked"] = True
    return render_template("auth/lock.html", user=current_user)
