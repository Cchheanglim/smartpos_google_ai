"""
SmartPOS Mini-Mart Flask Application Factory
"""

import os
from flask import Flask, render_template, request
from .config import config_by_name
from .extensions import auth_manager
from .repositories.user_repository import UserRepository


def create_app(config_name: str = 'development') -> Flask:
    """Creates and configures an instance of the Flask application."""
    app = Flask(__name__, static_folder='static', template_folder='templates')
    
    # Load configuration
    config_class = config_by_name.get(config_name, config_by_name['default'])
    app.config.from_object(config_class)

    # Initialize Auth Manager
    auth_manager.init_app(app)

    user_repo = UserRepository()

    @auth_manager.user_loader
    def load_user(user_id: int):
        return user_repo.get_by_id(user_id)

    # Register Blueprints
    from .routes.auth_routes import auth_bp
    from .routes.dashboard_routes import dashboard_bp
    from .routes.pos_routes import pos_bp
    from .routes.product_routes import product_bp
    from .routes.sales_routes import sales_bp
    from .routes.staff_routes import staff_bp
    from .routes.report_routes import report_bp, task_bp
    from .routes.api_routes import api_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(pos_bp)
    app.register_blueprint(product_bp)
    app.register_blueprint(sales_bp)
    app.register_blueprint(staff_bp)
    app.register_blueprint(report_bp)
    app.register_blueprint(task_bp)
    app.register_blueprint(api_bp)

    # Template Context Processors & Filters
    @app.context_processor
    def inject_globals():
        return {
            'current_user': auth_manager.get_current_user(),
            'khr_rate': app.config.get('KHR_EXCHANGE_RATE', 4100.0),
            'current_path': request.path
        }

    @app.template_filter('currency_usd')
    def currency_usd_filter(val):
        try:
            return f"${float(val):.2f}"
        except (ValueError, TypeError):
            return "$0.00"

    @app.template_filter('currency_khr')
    def currency_khr_filter(val, rate=None):
        try:
            exchange_rate = rate or app.config.get('KHR_EXCHANGE_RATE', 4100.0)
            khr = int(round((float(val) * exchange_rate) / 100.0) * 100)
            return f"{khr:,} ៛"
        except (ValueError, TypeError):
            return "0 ៛"

    # Error Handlers
    @app.errorhandler(403)
    def forbidden_error(error):
        return render_template('errors/403.html'), 403

    @app.errorhandler(404)
    def not_found_error(error):
        return render_template('errors/404.html'), 404

    @app.errorhandler(500)
    def internal_error(error):
        return render_template('errors/500.html'), 500

    return app
