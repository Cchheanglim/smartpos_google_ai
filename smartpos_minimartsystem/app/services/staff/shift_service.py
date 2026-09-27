"""Work-shift templates (Morning, Afternoon, Evening, Night)."""
from app.forms.staff_forms import ShiftInput
from app.models.staff.shift import Shift
from app.repositories.staff.shift_repository import ShiftRepository
from app.services.errors import NotFoundError


class ShiftService:
    def __init__(self, shift_repo: ShiftRepository | None = None) -> None:
        self.shift_repo = shift_repo or ShiftRepository()

    def list_shifts(self) -> list[Shift]:
        return self.shift_repo.list_all()

    def save(self, data: ShiftInput, shift_id: int | None = None) -> Shift:
        try:
            shift = Shift(id=shift_id, name=data.name, start_time=data.start_time, end_time=data.end_time)
        except (ValueError, TypeError):
            raise ValueError("Times must look like 06:00.") from None
        shift.validate()
        clash = self.shift_repo.find_by_name(shift.name)
        if clash and clash.id != shift_id:
            raise ValueError(f"A shift called '{shift.name}' already exists.")
        if shift_id:
            if self.shift_repo.find_by_id(shift_id) is None:
                raise NotFoundError("Shift not found.")
            self.shift_repo.update(shift)
        else:
            shift.id = self.shift_repo.create(shift)
        return shift

    def delete(self, shift_id: int) -> Shift:
        shift = self.shift_repo.find_by_id(shift_id)
        if shift is None:
            raise NotFoundError("Shift not found.")
        self.shift_repo.delete(shift_id)          # users.shift_id is SET NULL by the FK
        return shift
