"""
The single, reusable RBAC enforcement point for protected routes.

Access is always resolved as  user -> role -> permissions  (see
AuthService.has_permission). Hiding a button in a template is only a
convenience; this decorator is what actually protects the route.
"""
from functools import wraps
from typing import Callable

from flask import abort
from flask_login import current_user, login_required


def permission_required(*permission_names: str) -> Callable:
    """Allow the request if the user holds ANY of the given permissions."""

    def decorator(view_func: Callable) -> Callable:
        @wraps(view_func)
        @login_required
        def wrapper(*args, **kwargs):
            from app.services.auth.auth_service import AuthService
            service = AuthService()
            if not any(service.has_permission(current_user, p) for p in permission_names):
                abort(403)
            return view_func(*args, **kwargs)

        return wrapper

    return decorator
