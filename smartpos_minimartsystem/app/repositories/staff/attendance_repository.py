"""Data access for shift sessions (attendance) and the drawer cash log."""
from decimal import Decimal
from typing import Any, Mapping

from app.models.staff.attendance import AttendanceSession, CashMovement
from app.repositories.base_repository import BaseRepository


class AttendanceRepository(BaseRepository[AttendanceSession]):
    """
    Closed sessions are immutable: ``close()`` only updates a row whose
    ``clock_out`` is still NULL, and there is no other UPDATE or DELETE.
    Cash movements are insert-only.
    """

    table_name = "attendance"
    default_order = "a.clock_in DESC"

    def _to_model(self, row: Mapping[str, Any] | None) -> AttendanceSession | None:
        return AttendanceSession.from_row(row)

    def _select_sql(self) -> str:
        return ("SELECT a.*, u.name AS user_name, cb.name AS closed_by_name, "
                "(SELECT COALESCE(SUM(m.amount), 0) FROM cash_movements m WHERE m.attendance_id = a.id) "
                "  AS drawer_balance, "
                "(SELECT COUNT(*) FROM sales s WHERE s.attendance_id = a.id) AS sale_count "
                "FROM attendance a JOIN users u ON u.id = a.user_id "
                "LEFT JOIN users cb ON cb.id = a.closed_by")

    def _alias(self) -> str:
        return "a."

    def find_open_for(self, user_id: int) -> AttendanceSession | None:
        return self._to_model(self._fetch_one(
            f"{self._select_sql()} WHERE a.user_id = %s AND a.clock_out IS NULL ORDER BY a.id DESC LIMIT 1",
            (user_id,)))

    def list_open(self) -> list[AttendanceSession]:
        return [self._to_model(r) for r in self._fetch_all(
            f"{self._select_sql()} WHERE a.clock_out IS NULL ORDER BY a.clock_in")]

    def search(self, user_id: int | None = None, status: str = "", limit: int = 100) -> list[AttendanceSession]:
        sql, params = f"{self._select_sql()} WHERE 1=1", []
        if user_id:
            sql += " AND a.user_id = %s"
            params.append(user_id)
        if status == "open":
            sql += " AND a.clock_out IS NULL"
        elif status == "shortage":
            sql += " AND a.cash_difference < 0"
        elif status == "overage":
            sql += " AND a.cash_difference > 0"
        elif status == "balanced":
            sql += " AND a.cash_difference = 0"
        sql += f" ORDER BY {self.default_order} LIMIT %s"
        params.append(limit)
        return [self._to_model(r) for r in self._fetch_all(sql, params)]

    def open_session(self, user_id: int, opening_float: Decimal, notes: str = "") -> int:
        return self._execute("INSERT INTO attendance (user_id, opening_float, notes) VALUES (%s, %s, %s)",
                             (user_id, opening_float, notes or None))

    def close(self, session: AttendanceSession, closed_by: int) -> int:
        """Write the drawer count once. Returns 0 if the shift was already closed."""
        return self._execute(
            "UPDATE attendance SET clock_out = NOW(), expected_cash = %s, counted_cash = %s, "
            "cash_difference = %s, notes = %s, closed_by = %s WHERE id = %s AND clock_out IS NULL",
            (session.expected_cash, session.counted_cash, session.cash_difference,
             session.notes or None, closed_by, session.id))

    # ---- cash log ----
    def add_movement(self, attendance_id: int, kind: str, amount: Decimal, reference: str = "",
                     created_by: int | None = None) -> int:
        return self._execute(
            "INSERT INTO cash_movements (attendance_id, kind, amount, reference, created_by) "
            "VALUES (%s, %s, %s, %s, %s)", (attendance_id, kind, amount, reference or None, created_by))

    def movements_for(self, attendance_id: int) -> list[CashMovement]:
        rows = self._fetch_all(
            "SELECT m.*, u.name AS created_by_name FROM cash_movements m LEFT JOIN users u ON u.id = m.created_by "
            "WHERE m.attendance_id = %s ORDER BY m.created_at, m.id", (attendance_id,))
        return [CashMovement.from_row(r) for r in rows]

    def drawer_balance(self, attendance_id: int) -> Decimal:
        row = self._fetch_one("SELECT COALESCE(SUM(amount), 0) AS total FROM cash_movements "
                              "WHERE attendance_id = %s", (attendance_id,))
        return Decimal(str(row["total"])) if row else Decimal("0")

    def total_cash_in_drawers(self) -> Decimal:
        """Cash currently held across all open registers."""
        row = self._fetch_one(
            "SELECT COALESCE(SUM(m.amount), 0) AS total FROM cash_movements m "
            "JOIN attendance a ON a.id = m.attendance_id WHERE a.clock_out IS NULL")
        return Decimal(str(row["total"])) if row else Decimal("0")
