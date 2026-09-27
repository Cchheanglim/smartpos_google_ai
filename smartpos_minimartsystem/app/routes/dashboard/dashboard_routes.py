"""Home dashboard controller."""
from flask import Blueprint, render_template
from flask_login import current_user, login_required

from app.services.reports.dashboard_service import DashboardService

dashboard_bp = Blueprint("dashboard", __name__)
dashboard_service = DashboardService()


@dashboard_bp.route("/")
@login_required
def index():
    return render_template("dashboard.html", data=dashboard_service.overview(current_user))
