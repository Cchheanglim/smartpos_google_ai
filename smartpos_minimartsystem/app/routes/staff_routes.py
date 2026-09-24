"""
Staff Management, Shifts, and RBAC Blueprint
"""

from flask import Blueprint, render_template, request, redirect, url_for, flash
from ..extensions import login_required, permission_required, auth_manager
from ..services.refund_service import StaffService
from ..repositories.role_repository import RoleRepository
from ..repositories.attendance_repository import AttendanceRepository
from ..forms.forms import StaffFormValidator

staff_bp = Blueprint('staff', __name__, url_prefix='/staff')
staff_service = StaffService()
role_repo = RoleRepository()
attendance_repo = AttendanceRepository()


@staff_bp.route('/')
@login_required
@permission_required('manage_users')
def index():
    current_user = auth_manager.get_current_user()
    staff_members = staff_service.get_staff_members()
    roles = role_repo.get_all_roles()
    attendance_records = attendance_repo.get_all(limit=25)
    active_shift = attendance_repo.get_active_session(current_user.id)

    return render_template(
        'staff/index.html',
        user=current_user,
        staff_members=staff_members,
        roles=roles,
        attendance_records=attendance_records,
        active_shift=active_shift
    )


@staff_bp.route('/add', methods=['POST'])
@login_required
@permission_required('manage_users')
def add_staff():
    form_data = request.form.to_dict()
    val = StaffFormValidator.validate(form_data, is_new=True)
    if not val.is_valid:
        for err in val.errors.values():
            flash(err, 'error')
        return redirect(url_for('staff.index'))

    user, error = staff_service.create_staff(form_data)
    if error:
        flash(error, 'error')
    else:
        flash(f"Staff member {user.name} was successfully registered.", 'success')

    return redirect(url_for('staff.index'))


@staff_bp.route('/<int:user_id>/role', methods=['POST'])
@login_required
@permission_required('manage_roles')
def update_role(user_id):
    role_id = int(request.form.get('role_id', 4))
    staff_service.user_repo.update_role(user_id, role_id)
    flash("Staff role successfully updated.", 'success')
    return redirect(url_for('staff.index'))


@staff_bp.route('/clock-in', methods=['POST'])
@login_required
def clock_in():
    current_user = auth_manager.get_current_user()
    starting_cash = float(request.form.get('starting_cash', 0.0))
    notes = request.form.get('notes', '')

    record, error = staff_service.clock_in(current_user.id, starting_cash, notes)
    if error:
        flash(error, 'warning')
    else:
        flash(f"Shift clocked in with starting float of ${starting_cash:.2f}.", 'success')

    return redirect(request.referrer or url_for('dashboard.index'))


@staff_bp.route('/clock-out', methods=['POST'])
@login_required
def clock_out():
    current_user = auth_manager.get_current_user()
    counted_cash = float(request.form.get('counted_cash', 0.0))
    notes = request.form.get('notes', '')

    record, error = staff_service.clock_out(current_user.id, counted_cash, notes)
    if error:
        flash(error, 'warning')
    else:
        flash(f"Shift ended. Counted drawer cash: ${counted_cash:.2f}. Discrepancy: ${record.cash_discrepancy:.2f}", 'info')

    return redirect(request.referrer or url_for('dashboard.index'))


@staff_bp.route('/roles-matrix', methods=['GET', 'POST'])
@login_required
@permission_required('manage_roles')
def roles_matrix():
    current_user = auth_manager.get_current_user()
    roles = role_repo.get_all_roles()
    system_permissions = role_repo.get_system_permissions()

    if request.method == 'POST':
        # Process permission updates for each role
        for role in roles:
            if role.name in ('super_admin',):
                continue  # super admin remains all-powerful
            field_name = f"perm_{role.name}"
            selected_perms = request.form.getlist(field_name)
            staff_service.update_role_permissions(role.name, selected_perms)

        flash("Role & Permission matrix updated successfully.", 'success')
        return redirect(url_for('staff.roles_matrix'))

    return render_template(
        'staff/roles_matrix.html',
        user=current_user,
        roles=roles,
        permissions=system_permissions
    )


@staff_bp.route('/<int:user_id>/deactivate', methods=['POST'])
@login_required
@permission_required('manage_users')
def deactivate_staff(user_id):
    current_user = auth_manager.get_current_user()
    if user_id == current_user.id:
        flash("You cannot deactivate your own active session.", 'error')
        return redirect(url_for('staff.index'))

    staff_service.deactivate_staff(user_id)
    flash("Staff account deactivated. Terminal login has been disabled.", 'info')
    return redirect(url_for('staff.index'))


@staff_bp.route('/<int:user_id>/reactivate', methods=['POST'])
@login_required
@permission_required('manage_users')
def reactivate_staff(user_id):
    staff_service.reactivate_staff(user_id)
    flash("Staff account reactivated successfully. Terminal access restored.", 'success')
    return redirect(url_for('staff.index'))


@staff_bp.route('/<int:user_id>/reset-password', methods=['POST'])
@login_required
@permission_required('manage_users')
def reset_password(user_id):
    new_password = request.form.get('new_password', '').strip()
    if not new_password or len(new_password) < 6:
        flash("Password must be at least 6 characters long.", 'error')
        return redirect(url_for('staff.index'))

    staff_service.reset_password(user_id, new_password)
    flash("Staff password successfully reset.", 'success')
    return redirect(url_for('staff.index'))

