"""Flask application factory."""
import os
from datetime import date

from flask import Flask, render_template
from flask_login import current_user

from app import extensions
from app.config import Config


def create_app(config_class: type = Config) -> Flask:
    """Build and configure a SmartPOS Flask application instance."""
    app = Flask(__name__)
    app.config.from_object(config_class)
    os.makedirs(app.config["PRODUCT_UPLOAD_FOLDER"], exist_ok=True)
    os.makedirs(app.config["AVATAR_UPLOAD_FOLDER"], exist_ok=True)

    extensions.init_app(app)
    _register_user_loader()
    _register_blueprints(app)
    _register_template_helpers(app)
    _register_error_handlers(app)
    return app


def _register_user_loader() -> None:
    from app.services.auth.auth_service import AuthService

    @extensions.login_manager.user_loader
    def load_user(user_id: str):
        return AuthService().load_user(user_id)


def _register_blueprints(app: Flask) -> None:
    # Routes are thin controllers: parse request -> one service call -> render.
    from app.routes.auth.auth_routes import auth_bp
    from app.routes.dashboard.dashboard_routes import dashboard_bp
    from app.routes.inventory.product_routes import products_bp
    from app.routes.inventory.category_routes import categories_bp
    from app.routes.inventory.supplier_routes import suppliers_bp
    from app.routes.sales.checkout_routes import checkout_bp
    from app.routes.sales.sales_routes import sales_bp
    from app.routes.sales.customer_routes import customers_bp
    from app.routes.staff.staff_routes import staff_bp
    from app.routes.staff.role_routes import roles_bp
    from app.routes.reports.report_routes import reports_bp
    from app.routes.profile.profile_routes import profile_bp
    from app.routes.attendance.attendance_routes import attendance_bp
    from app.routes.tasks.task_routes import tasks_bp
    from app.routes.purchases.purchase_order_routes import purchases_bp

    for bp in (auth_bp, dashboard_bp, products_bp, categories_bp, suppliers_bp,
               checkout_bp, sales_bp, customers_bp, staff_bp, roles_bp,
               reports_bp, profile_bp, attendance_bp, tasks_bp, purchases_bp):
        app.register_blueprint(bp)


def _register_template_helpers(app: Flask) -> None:
    from app.utils.formatting import money, khr, datetime_short, riel

    app.jinja_env.filters["money"] = money
    app.jinja_env.filters["khr"] = khr
    app.jinja_env.filters["riel"] = riel
    app.jinja_env.filters["dt"] = datetime_short

    @app.before_request
    def enforce_terminal_lock():
        from flask import redirect, request, session, url_for
        if not session.get("locked") or not current_user.is_authenticated:
            return None
        allowed = {"auth.lock", "auth.logout", "static"}
        if request.endpoint in allowed:
            return None
        return redirect(url_for("auth.lock", next=request.path))

    @app.context_processor
    def inject_globals():
        """Expose the current user's permission set to every template so
        the sidebar/buttons can hide what the user cannot do (the server
        still enforces every permission with @permission_required)."""
        from app.services.auth.auth_service import AuthService
        from app.services.settings.settings_service import SettingsService
        permissions = set()
        if current_user.is_authenticated:
            permissions = AuthService().permissions_for(current_user)
        rate = SettingsService().exchange_rate() if current_user.is_authenticated else None
        return {
            "permissions": permissions,
            "store_name": app.config["STORE_NAME"],
            "khr_rate": rate.khr_per_usd if rate else app.config["KHR_EXCHANGE_RATE"],
            "today_label": date.today().strftime("%a, %d %b %Y"),
        }


def _register_error_handlers(app: Flask) -> None:
    @app.errorhandler(403)
    def forbidden(_e):
        return render_template("errors/403.html"), 403

    @app.errorhandler(404)
    def not_found(_e):
        return render_template("errors/404.html"), 404

    @app.errorhandler(LookupError)
    def missing_record(_e):
        # Services raise NotFoundError (a LookupError) for unknown ids.
        return render_template("errors/404.html"), 404

    @app.errorhandler(500)
    def server_error(_e):
        return render_template("errors/500.html"), 500
