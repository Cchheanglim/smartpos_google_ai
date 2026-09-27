"""Data access for work-shift templates."""
from typing import Any, Mapping

from app.models.staff.shift import Shift
from app.repositories.base_repository import BaseRepository


class ShiftRepository(BaseRepository[Shift]):
    table_name = "shifts"
    default_order = "sh.start_time"

    def _to_model(self, row: Mapping[str, Any] | None) -> Shift | None:
        return Shift.from_row(row)

    def _select_sql(self) -> str:
        return ("SELECT sh.*, (SELECT COUNT(*) FROM users u WHERE u.shift_id = sh.id AND u.is_active = 1) "
                "AS staff_count FROM shifts sh")

    def _alias(self) -> str:
        return "sh."

    def find_by_name(self, name: str) -> Shift | None:
        return self._to_model(self._fetch_one(f"{self._select_sql()} WHERE sh.name = %s", (name,)))

    def create(self, shift: Shift) -> int:
        return self._execute("INSERT INTO shifts (name, start_time, end_time) VALUES (%s, %s, %s)",
                             (shift.name, shift.start_time.strftime("%H:%M:%S"),
                              shift.end_time.strftime("%H:%M:%S")))

    def update(self, shift: Shift) -> None:
        self._execute("UPDATE shifts SET name=%s, start_time=%s, end_time=%s WHERE id=%s",
                      (shift.name, shift.start_time.strftime("%H:%M:%S"),
                       shift.end_time.strftime("%H:%M:%S"), shift.id))
