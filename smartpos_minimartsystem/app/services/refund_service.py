"""
Refund and Staff Services
"""

from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime
from ..models.sale import Refund, RefundItem, Sale
from ..models.user import User
from ..models.attendance import AttendanceRecord
from ..repositories.sale_repository import SaleRepository
from ..repositories.user_repository import UserRepository
from ..repositories.role_repository import RoleRepository
from ..repositories.attendance_repository import AttendanceRepository
from ..extensions import PasswordHasher


class RefundService:
    """Handles returns, customer refunds, and restocks inventory."""

    def __init__(self, sale_repo: Optional[SaleRepository] = None):
        self.sale_repo = sale_repo or SaleRepository()

    def process_refund(
        self,
        sale_id: int,
        processed_by: int,
        refund_items_data: List[Dict[str, Any]],
        reason: str,
        notes: str = ''
    ) -> Tuple[Optional[Refund], Optional[str]]:
        """Restores inventory and issues refund."""
        sale = self.sale_repo.get_by_id(sale_id)
        if not sale:
            return None, "Original sale transaction not found."

        if not refund_items_data:
            return None, "No items selected for refund."

        items = []
        total_refund = 0.0

        for item_data in refund_items_data:
            sale_item_id = int(item_data['sale_item_id'])
            product_id = int(item_data['product_id'])
            quantity = int(item_data['quantity'])
            unit_price = float(item_data['unit_price'])
            subtotal = round(quantity * unit_price, 2)
            total_refund += subtotal

            items.append(RefundItem(
                sale_item_id=sale_item_id,
                product_id=product_id,
                quantity=quantity,
                unit_price=unit_price,
                subtotal=subtotal
            ))

        refund = Refund(
            id=None,
            sale_id=sale_id,
            processed_by=processed_by,
            total_amount=round(total_refund, 2),
            reason=reason,
            notes=notes,
            items=items
        )

        saved_refund = self.sale_repo.create_refund(refund)

        # Notify via Telegram
        try:
            from .telegram_service import telegram_service
            cashier_user = UserRepository().get_by_id(processed_by)
            cashier_name = cashier_user.name if cashier_user else "Cashier"
            telegram_service.notify_refund(
                transaction_code=sale.transaction_code,
                refund_amount=saved_refund.total_amount,
                cashier_name=cashier_name,
                reason=reason
            )
        except Exception:
            pass

        return saved_refund, None


class StaffService:
    """Handles staff profiles, shift allocation, attendance clocking, and RBAC matrix."""

    def __init__(
        self,
        user_repo: Optional[UserRepository] = None,
        role_repo: Optional[RoleRepository] = None,
        attendance_repo: Optional[AttendanceRepository] = None
    ):
        self.user_repo = user_repo or UserRepository()
        self.role_repo = role_repo or RoleRepository()
        self.attendance_repo = attendance_repo or AttendanceRepository()

    def get_staff_members(self) -> List[User]:
        return self.user_repo.get_all()

    def create_staff(self, data: Dict[str, Any]) -> Tuple[Optional[User], Optional[str]]:
        email = data.get('email', '').strip().lower()
        if self.user_repo.get_by_email(email):
            return None, f"An employee with email '{email}' already exists."

        pwd = data.get('password', 'password123')
        user = User(
            id=None,
            name=data['name'],
            email=email,
            phone=data.get('phone', ''),
            password_hash=PasswordHasher.hash_password(pwd),
            role_id=int(data.get('role_id', 4)),
            shift_name=data.get('shift_name', 'Morning'),
            shift_start=data.get('shift_start', '06:00:00'),
            shift_end=data.get('shift_end', '14:00:00'),
            is_active=True,
            profile_picture=data.get('profile_picture', 'f86e67858910489ba513eae41ad5b941.png')
        )
        saved = self.user_repo.create(user)
        return saved, None

    def deactivate_staff(self, user_id: int) -> bool:
        return self.user_repo.delete(user_id)

    def reactivate_staff(self, user_id: int) -> bool:
        return self.user_repo.reactivate(user_id)

    def reset_password(self, user_id: int, new_password: str) -> bool:
        hashed = PasswordHasher.hash_password(new_password)
        return self.user_repo.reset_password(user_id, hashed)

    def clock_in(self, user_id: int, starting_cash: float = 0.0, notes: str = '') -> Tuple[Optional[AttendanceRecord], Optional[str]]:
        active = self.attendance_repo.get_active_session(user_id)
        if active:
            return None, "You already have an active shift clock-in session."

        record = AttendanceRecord(
            id=None,
            user_id=user_id,
            clock_in=datetime.now(),
            starting_cash=starting_cash,
            notes=notes
        )
        saved = self.attendance_repo.create(record)
        return saved, None

    def clock_out(self, user_id: int, counted_cash: float, notes: str = '') -> Tuple[Optional[AttendanceRecord], Optional[str]]:
        active = self.attendance_repo.get_active_session(user_id)
        if not active:
            return None, "No active shift attendance record found."

        active.clock_out_now(counted_cash)
        if notes:
            active.notes = f"{active.notes} | {notes}" if active.notes else notes
        self.attendance_repo.update(active)

        # Dispatch shift reconciliation alert to Telegram
        try:
            from .telegram_service import telegram_service
            staff_user = self.user_repo.get_by_id(user_id)
            staff_name = staff_user.name if staff_user else "Staff"
            telegram_service.notify_shift_reconciliation(
                staff_name=staff_name,
                starting_cash=active.starting_cash,
                counted_cash=counted_cash,
                expected_cash=active.starting_cash,  # baseline float
                discrepancy=active.cash_discrepancy or 0.0,
                notes=active.notes
            )
        except Exception:
            pass

        return active, None

    def update_role_permissions(self, role_name: str, permission_names: List[str]) -> bool:
        return self.role_repo.update_role_permissions(role_name, permission_names)
