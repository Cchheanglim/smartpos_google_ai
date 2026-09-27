"""Reports controller: summary page and CSV export."""
from flask import Blueprint, Response, flash, redirect, render_template, request, url_for
from flask_login import current_user

from app.forms.sales_forms import date_range_from_args
from app.services.reports.report_service import ReportService
from app.utils.decorators import permission_required

reports_bp = Blueprint("reports", __name__, url_prefix="/reports")
report_service = ReportService()


@reports_bp.route("/")
@permission_required("view_reports")
def index():
    try:
        from app.services.auth.auth_service import AuthService
        can_export = AuthService().has_permission(current_user, "export_reports")
        page = report_service.report_page(*date_range_from_args(request.args), can_export=can_export)
    except ValueError as exc:
        flash(str(exc), "error")
        return redirect(url_for("reports.index"))
    return render_template("reports/index.html", page=page)


@reports_bp.route("/export.csv")
@permission_required("export_reports")
def export_csv():
    try:
        filename, csv_text = report_service.export_sales_csv(*date_range_from_args(request.args))
    except ValueError as exc:
        flash(str(exc), "error")
        return redirect(url_for("reports.index"))
    return Response(csv_text, mimetype="text/csv",
                    headers={"Content-Disposition": f"attachment; filename={filename}"})


@reports_bp.route("/export.xlsx")
@permission_required("export_reports")
def export_xlsx():
    try:
        filename, data = report_service.export_sales_xlsx(*date_range_from_args(request.args))
    except ValueError as exc:
        flash(str(exc), "error")
        return redirect(url_for("reports.index"))
    return Response(data, mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f"attachment; filename={filename}"})
