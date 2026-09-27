"""Staff lifecycle, RBAC role matrix, shift clock-in/out, and task board rules."""
from decimal import Decimal

import pytest

from app.forms.staff_forms import StaffInput
from app.models.auth.role import Role
from app.services.auth.role_service import RoleService
from app.services.auth.staff_service import StaffService
from app.services.staff.attendance_service import AttendanceService
from app.services.staff.task_service import TaskService
from tests.fakes import (FakeAttendanceRepo, FakeAuditRepo, FakePermissionRepo, FakeRoleRepo,
                         FakeShiftRepo, FakeTaskRepo, FakeUserRepo, make_user, no_tx)

SUPER = Role(id=1, name="super_admin", display_name="Super Admin", is_system=True)
ADMIN = Role(id=2, name="admin", display_name="Admin")
CASHIER = Role(id=4, name="cashier", display_name="Cashier")


def build_staff_service(*users):
    return StaffService(user_repo=FakeUserRepo(*users), role_repo=FakeRoleRepo(SUPER, ADMIN, CASHIER),
                        tx=no_tx, shift_repo=FakeShiftRepo(), attendance_repo=FakeAttendanceRepo(),
                        audit_repo=FakeAuditRepo())


def staff_input(**overrides):
    values = dict(name="New Person", email="new@test.local", phone="", role_id=4, active=True,
                  password="password123", shift_id=None)
    values.update(overrides)
    return StaffInput(**values)


def test_last_super_admin_cannot_be_deactivated_or_demoted():
    boss = make_user(1, "super_admin")
    other = make_user(2, "super_admin")
    service = build_staff_service(boss, make_user(3, "cashier"))
    with pytest.raises(ValueError, match="own account"):
        service.deactivate(1, acting_user=boss)
    with pytest.raises(ValueError, match="At least one active Super Admin"):
        service.update_staff(1, staff_input(role_id=4), acting_user=other)


def test_only_super_admin_can_grant_super_admin_role():
    admin_actor = make_user(1, "admin")
    service = build_staff_service(admin_actor, make_user(2, "cashier"))
    with pytest.raises(ValueError, match="Only a Super Admin"):
        service.create_staff(staff_input(role_id=1), acting_user=admin_actor)


def test_create_staff_rejects_duplicate_email_and_weak_password():
    existing = make_user(1, "cashier")
    existing.email = "dup@test.local"
    service = build_staff_service(existing)
    with pytest.raises(ValueError, match="already exists"):
        service.create_staff(staff_input(email="dup@test.local"))
    with pytest.raises(ValueError, match="at least 8"):
        service.create_staff(staff_input(password="abc1"))


def test_deactivate_blocked_while_shift_open():
    service = build_staff_service(make_user(1, "super_admin"), make_user(2, "cashier"))
    service.attendance_repo.open_by_user[2] = object()
    with pytest.raises(ValueError, match="open shift"):
        service.deactivate(2, acting_user=make_user(1, "super_admin"))


def test_delete_blocked_when_staff_has_history():
    service = build_staff_service(make_user(1, "super_admin"), make_user(2, "cashier"))
    service.user_repo.has_history = lambda uid: True
    with pytest.raises(ValueError, match="Deactivate the account"):
        service.delete_staff(2, acting_user=make_user(1, "super_admin"))


def test_super_admin_role_keeps_protected_permissions():
    perms = FakePermissionRepo({1: "manage_users", 4: "manage_roles", 13: "process_sale"})
    roles = FakeRoleRepo(SUPER, CASHIER)
    service = RoleService(role_repo=roles, permission_repo=perms, tx=no_tx, audit_repo=FakeAuditRepo())
    with pytest.raises(ValueError, match="manage_roles"):
        service.update_matrix({1: [1], 4: [13]})
    service.update_matrix({1: [1, 4], 4: [13, 999]})     # unknown permission ids are ignored
    assert roles.replaced == {1: [1, 4], 4: [13]}


def build_attendance_service():
    repo = FakeAttendanceRepo()
    return AttendanceService(attendance_repo=repo, audit_repo=FakeAuditRepo(),
                             user_repo=FakeUserRepo(), tx=no_tx), repo


def test_clock_in_then_clock_out_balanced():
    service, repo = build_attendance_service()
    cashier = make_user(4, "cashier")
    session = service.clock_in(cashier, Decimal("20.00"))
    assert session.opening_float == Decimal("20.00")
    with pytest.raises(ValueError, match="already clocked in"):
        service.clock_in(cashier, Decimal("10.00"))
    closed = service.clock_out(cashier, Decimal("20.00"))
    assert closed.status.label == "Balanced"


def test_clock_in_rejects_oversized_float():
    service, repo = build_attendance_service()
    with pytest.raises(ValueError, match="cannot exceed"):
        service.clock_in(make_user(4, "cashier"), Decimal("99999"))


def test_adjust_drawer_cash_in_and_out():
    service, repo = build_attendance_service()
    cashier = make_user(4, "cashier")
    service.clock_in(cashier, Decimal("20.00"))
    balance = service.adjust_drawer(cashier, "in", Decimal("10.00"), "change top-up")
    assert balance == Decimal("30.00")
    with pytest.raises(ValueError, match="only holds"):
        service.adjust_drawer(cashier, "out", Decimal("999"), "too much")


def build_task_service():
    return TaskService(task_repo=FakeTaskRepo(), user_repo=FakeUserRepo(make_user(2, "cashier")),
                       auth_service=type("A", (), {"has_permission": staticmethod(lambda u, p: u.role_name != "cashier")})())


def test_task_create_and_status_permissions():
    service = build_task_service()
    manager = make_user(1, "admin")
    task = service.create(manager, "Restock", 2, "high", None)
    assert task.priority.value == "high"
    worker = make_user(2, "cashier")
    updated = service.change_status(worker, task.id, "in_progress")
    assert updated.status.value == "in_progress"
    with pytest.raises(PermissionError):
        service.change_status(worker, task.id, "cancelled")   # only a manager may cancel


def test_create_role_slugifies_name_and_rejects_duplicates():
    roles = FakeRoleRepo(SUPER, ADMIN, CASHIER)
    service = RoleService(role_repo=roles, permission_repo=FakePermissionRepo(), tx=no_tx, audit_repo=FakeAuditRepo())
    role = service.create_role("Store Auditor", "Reviews compliance", make_user(1, "super_admin"))
    assert role.name == "store_auditor"
    with pytest.raises(ValueError, match="already exists"):
        service.create_role("Store Auditor", "", make_user(1))


def test_delete_role_blocked_for_system_role_or_role_with_staff():
    custom = Role(id=9, name="auditor", display_name="Auditor", is_system=False, user_count=2)
    roles = FakeRoleRepo(SUPER, custom)
    service = RoleService(role_repo=roles, permission_repo=FakePermissionRepo(), tx=no_tx, audit_repo=FakeAuditRepo())
    with pytest.raises(ValueError, match="built-in role"):
        service.delete_role(1)
    with pytest.raises(ValueError, match="still has 2 staff"):
        service.delete_role(9)


def test_create_permission_validates_code_and_rejects_duplicates():
    from app.services.auth.permission_service import PermissionService
    perms = FakePermissionRepo({1: "process_sale"})
    service = PermissionService(permission_repo=perms, tx=no_tx, audit_repo=FakeAuditRepo())
    with pytest.raises(ValueError, match="required"):
        service.create_permission("", "", "General")
    with pytest.raises(ValueError, match="area.action"):
        service.create_permission("noseparator", "", "General")
    perm = service.create_permission("Report.Export ", "Export reports", "Reports", make_user(1))
    assert perm.name == "report.export" and perm.display_name == "Report Export"
