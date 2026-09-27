"""Permission registry: the catalog of capability tokens roles are built from."""
from itertools import groupby
from typing import Callable, ContextManager

from app.extensions import transaction
from app.models.auth.permission import Permission
from app.models.auth.user import User
from app.repositories.auth.permission_repository import PermissionRepository
from app.repositories.staff.audit_repository import AuditRepository


class PermissionService:
    def __init__(self, permission_repo: PermissionRepository | None = None,
                 tx: Callable[[], ContextManager] = transaction,
                 audit_repo: AuditRepository | None = None) -> None:
        self.permission_repo = permission_repo or PermissionRepository()
        self.tx = tx
        self.audit_repo = audit_repo or AuditRepository()

    def registry_page(self) -> dict:
        permissions = self.permission_repo.list_all()
        groups = [(name, list(items)) for name, items in groupby(permissions, key=lambda p: p.group_name)]
        return {"permissions": permissions, "groups": groups, "count": len(permissions)}

    def create_permission(self, code: str, description: str, group_name: str,
                          acting_user: User | None = None) -> Permission:
        """Register a brand-new permission token (e.g. 'report.export') that can then
        be granted to roles or individual staff. Codes follow ``area.action``."""
        code = code.strip().lower().replace(" ", "_")
        if not code:
            raise ValueError("Permission code is required.")
        if "." not in code and "_" not in code:
            raise ValueError("Use a code like 'area.action', e.g. 'inventory.export'.")
        if len(code) > 60:
            raise ValueError("Permission code must be 60 characters or fewer.")
        if self.permission_repo.find_by_name(code):
            raise ValueError(f"Permission '{code}' already exists.")
        display_name = code.replace(".", " ").replace("_", " ").title()
        permission = Permission(id=None, name=code, display_name=display_name,
                                description=description.strip()[:255], group_name=(group_name.strip() or "Custom")[:40])
        with self.tx():
            permission.id = self.permission_repo.create(permission)
            if acting_user is not None:
                self.audit_repo.record(acting_user.id, "permission.create", code)
        return permission
