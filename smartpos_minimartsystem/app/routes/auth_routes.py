"""
Authentication and Profile Blueprint
"""

from flask import Blueprint, render_template, request, redirect, url_for, flash
from ..extensions import auth_manager, login_required
from ..services.auth_service import AuthService

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')
auth_service = AuthService()


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if auth_manager.get_current_user():
        return redirect(url_for('dashboard.index'))

    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '').strip()

        user, error = auth_service.authenticate(email, password)
        if error:
            flash(error, 'error')
            return render_template('auth/login.html', email=email)

        auth_manager.login_user(user)
        flash(f"Welcome back, {user.name}!", 'success')
        next_page = request.args.get('next')
        return redirect(next_page or url_for('dashboard.index'))

    return render_template('auth/login.html')


@auth_bp.route('/logout', methods=['GET', 'POST'])
def logout():
    auth_manager.logout_user()
    flash('You have been logged out safely.', 'info')
    return redirect(url_for('auth.login'))


@auth_bp.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    current_user = auth_manager.get_current_user()

    if request.method == 'POST':
        old_password = request.form.get('old_password', '')
        new_password = request.form.get('new_password', '')
        confirm_password = request.form.get('confirm_password', '')

        if new_password != confirm_password:
            flash("New passwords do not match.", 'error')
        else:
            success, msg = auth_service.change_password(current_user.id, old_password, new_password)
            if success:
                flash(msg, 'success')
            else:
                flash(msg, 'error')

    return render_template('profile/index.html', user=current_user)
