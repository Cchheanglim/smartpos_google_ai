"""Work shift template (Morning / Afternoon / Evening / Night)."""
from dataclasses import dataclass
from datetime import time, timedelta
from typing import Any, Mapping


def _as_time(value: Any) -> time:
    """MySQL TIME arrives as ``timedelta`` via PyMySQL; accept time/str too."""
    if isinstance(value, time):
        return value
    if isinstance(value, timedelta):
        seconds = int(value.total_seconds()) % 86400
        return time(seconds // 3600, (seconds % 3600) // 60)
    hours, minutes, *_ = str(value).split(":")
    return time(int(hours), int(minutes))


@dataclass
class Shift:
    id: int | None
    name: str
    start_time: time
    end_time: time
    staff_count: int = 0

    def __post_init__(self) -> None:
        self.start_time = _as_time(self.start_time)
        self.end_time = _as_time(self.end_time)

    def validate(self) -> None:
        if not self.name.strip():
            raise ValueError("Shift name is required.")
        if self.start_time == self.end_time:
            raise ValueError("A shift must start and end at different times.")

    @property
    def is_overnight(self) -> bool:
        return self.end_time < self.start_time

    @property
    def hours(self) -> float:
        start = self.start_time.hour * 60 + self.start_time.minute
        end = self.end_time.hour * 60 + self.end_time.minute
        return ((end - start) % 1440) / 60

    @property
    def label(self) -> str:
        fmt = lambda t: t.strftime("%I:%M %p").lstrip("0")
        return f"{fmt(self.start_time)} – {fmt(self.end_time)}"

    def __str__(self) -> str:
        return f"{self.name} ({self.label})"

    @classmethod
    def from_row(cls, row: Mapping[str, Any] | None) -> "Shift | None":
        if row is None:
            return None
        return cls(id=row["id"], name=row["name"], start_time=row["start_time"], end_time=row["end_time"],
                   staff_count=int(row.get("staff_count") or 0))
