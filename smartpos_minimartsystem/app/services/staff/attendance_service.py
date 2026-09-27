"""Shift clock-in/out and closed-loop cash-drawer reconciliation."""
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Callable, ContextManager

from app.extensions import transaction
from app.models.auth.user import User
from app.models.base import to_money
from app.models.staff.attendance import AttendanceSession, CashMovement, CashMovementKind, DrawerStatus
from app.repositories.auth.user_repository import UserRepository
from app.repositories.staff.attendance_repository import AttendanceRepository
from app.repositories.staff.audit_repository import AuditRepository
from app.services.errors import NotFoundError


@dataclass
class ShiftPage:
    session: AttendanceSession | None
    movements: list[CashMovement] = field(default_factory=list)
    history: list[AttendanceSession] = field(default_factory=list)


@dataclass
class DrawerAuditPage:
    sessions: list[AttendanceSession]
    open_sessions: list[AttendanceSession]
    staff: list[User]
    cash_in_drawers: Decimal
    shortage_total: Decimal
    overage_total: Decimal


class AttendanceService:
    """
    The drawer is a closed loop:
      opening float + cash sales − cash refunds ± manual cash in/out = expected cash.
    At clock-out the counted cash is compared with that expectation and the
    result (Balanced / Overage / Shortage) is frozen in the attendance row
    and written to the audit log.
    """

    def __init__(self, attendance_repo: AttendanceRepository | None = None,
                 audit_repo: AuditRepository | None = None,
                 user_repo: UserRepository | None = None,
                 tx: Callable[[], ContextManager] = transaction) -> None:
        self.attendance_repo = attendance_repo or AttendanceRepository()
        self.audit_repo = audit_repo or AuditRepository()
        self.user_repo = user_repo or UserRepository()
        self.tx = tx

    # ---------------- read ----------------
    def current_session(self, user_id: int) -> AttendanceSession | None:
        return self.attendance_repo.find_open_for(user_id)

    def my_shift_page(self, user: User) -> ShiftPage:
        session = self.current_session(user.id)
        movements = self.attendance_repo.movements_for(session.id) if session else []
        return ShiftPage(session=session, movements=movements,
                         history=self.attendance_repo.search(user_id=user.id, limit=15))

    def session_detail(self, attendance_id: int) -> ShiftPage:
        session = self.attendance_repo.find_by_id(attendance_id)
        if session is None:
            raise NotFoundError("Shift record not found.")
        return ShiftPage(session=session, movements=self.attendance_repo.movements_for(attendance_id))

    def audit_page(self, user_id: int | None = None, status: str = "") -> DrawerAuditPage:
        sessions = self.attendance_repo.search(user_id=user_id, status=status, limit=200)
        diffs = [s.cash_difference for s in sessions if s.cash_difference is not None]
        return DrawerAuditPage(
            sessions=sessions, open_sessions=self.attendance_repo.list_open(),
            staff=self.user_repo.search(),
            cash_in_drawers=self.attendance_repo.total_cash_in_drawers(),
            shortage_total=sum((d for d in diffs if d < 0), Decimal("0.00")),
            overage_total=sum((d for d in diffs if d > 0), Decimal("0.00")),
        )

    # ---------------- write ----------------
    def clock_in(self, user: User, opening_float: Decimal, notes: str = "") -> AttendanceSession:
        opening_float = to_money(opening_float)
        AttendanceSession.check_float(opening_float)
        if self.current_session(user.id):
            raise ValueError("You are already clocked in. Close your current shift first.")
        with self.tx():
            session_id = self.attendance_repo.open_session(user.id, opening_float, notes)
            if opening_float > 0:
                self.attendance_repo.add_movement(session_id, CashMovementKind.FLOAT.value, opening_float,
                                                  "Opening float", user.id)
            self.audit_repo.record(user.id, "shift.open", f"Clock-in with ${opening_float:.2f} float")
        return self.current_session(user.id)

    def adjust_drawer(self, user: User, direction: str, amount: Decimal, reason: str) -> Decimal:
        """Manual cash in / cash out (e.g. change top-up, safe drop). Returns the new balance."""
        session = self._require_open(user.id)
        amount = to_money(amount)
        if amount <= 0:
            raise ValueError("Amount must be greater than zero.")
        if not reason.strip():
            raise ValueError("Please give a reason for the drawer adjustment.")
        balance = self.attendance_repo.drawer_balance(session.id)
        if direction == "out":
            if amount > balance:
                raise ValueError(f"The drawer only holds ${balance:.2f}.")
            kind, signed = CashMovementKind.CASH_OUT, -amount
        elif direction == "in":
            kind, signed = CashMovementKind.CASH_IN, amount
        else:
            raise ValueError("Choose cash in or cash out.")
        with self.tx():
            self.attendance_repo.add_movement(session.id, kind.value, signed, reason.strip()[:80], user.id)
            self.audit_repo.record(user.id, f"drawer.{kind.value}", f"${amount:.2f} — {reason.strip()[:200]}")
        return balance + signed

    def clock_out(self, user: User, counted_cash: Decimal, notes: str = "") -> AttendanceSession:
        """Close the signed-in user's own shift."""
        return self._close(self._require_open(user.id), counted_cash, notes, closed_by=user)

    def force_close(self, attendance_id: int, counted_cash: Decimal, notes: str, manager: User) -> AttendanceSession:
        """A manager closes a shift someone forgot to close (drawer counted by the manager)."""
        session = self.attendance_repo.find_by_id(attendance_id)
        if session is None:
            raise NotFoundError("Shift record not found.")
        if not session.is_open:
            raise ValueError("This shift is already closed.")
        note = f"Closed by manager {manager.name}. {notes}".strip()
        return self._close(session, counted_cash, note, closed_by=manager)

    def _close(self, session: AttendanceSession, counted_cash: Decimal, notes: str,
               closed_by: User) -> AttendanceSession:
        expected = self.attendance_repo.drawer_balance(session.id)
        status = session.close(expected, counted_cash)
        session.notes = (notes or session.notes or "")[:255]
        with self.tx():
            if self.attendance_repo.close(session, closed_by.id) == 0:
                raise ValueError("This shift was closed a moment ago by someone else.")
            self.audit_repo.record(
                closed_by.id, "shift.close",
                f"{session.user_name or 'User'} shift #{session.id}: expected ${session.expected_cash:.2f}, "
                f"counted ${session.counted_cash:.2f}, {status.label} {session.cash_difference:+.2f}")
        return session

    def _require_open(self, user_id: int) -> AttendanceSession:
        session = self.current_session(user_id)
        if session is None:
            raise ValueError("You are not clocked in. Open a shift with your opening cash float first.")
        return session

    @staticmethod
    def describe(status: DrawerStatus, difference: Decimal) -> str:
        if status is DrawerStatus.BALANCED:
            return "Drawer balanced exactly."
        word = "over" if status is DrawerStatus.OVERAGE else "short"
        return f"Drawer is {word} by ${abs(difference):.2f}."
