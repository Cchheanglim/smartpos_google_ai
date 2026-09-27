"""Team task delegation models."""
from dataclasses import dataclass
from datetime import date, datetime
from enum import Enum
from typing import Any, Mapping


class TaskPriority(Enum):
    LOW = ("low", "Low", 1, "badge-muted")
    MEDIUM = ("medium", "Medium", 2, "badge-info")
    HIGH = ("high", "High", 3, "badge-warn")
    URGENT = ("urgent", "Urgent", 4, "badge-low")

    def __new__(cls, value: str, label: str, rank: int, css: str) -> "TaskPriority":
        obj = object.__new__(cls)
        obj._value_ = value
        obj.label, obj.rank, obj.css = label, rank, css
        return obj


class TaskStatus(Enum):
    PENDING = ("pending", "Pending")
    IN_PROGRESS = ("in_progress", "In Progress")
    COMPLETED = ("completed", "Completed")
    CANCELLED = ("cancelled", "Cancelled")

    def __new__(cls, value: str, label: str) -> "TaskStatus":
        obj = object.__new__(cls)
        obj._value_ = value
        obj.label = label
        return obj

    @property
    def is_closed(self) -> bool:
        return self in (TaskStatus.COMPLETED, TaskStatus.CANCELLED)

    def can_become(self, target: "TaskStatus") -> bool:
        """Pending ⇄ In progress → Completed; open tasks may be cancelled; completed may be reopened."""
        allowed = {
            TaskStatus.PENDING: {TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.CANCELLED},
            TaskStatus.IN_PROGRESS: {TaskStatus.PENDING, TaskStatus.COMPLETED, TaskStatus.CANCELLED},
            TaskStatus.COMPLETED: {TaskStatus.IN_PROGRESS},
            TaskStatus.CANCELLED: {TaskStatus.PENDING},
        }
        return target in allowed[self]


@dataclass
class Task:
    """An operational duty assigned by a manager to a staff member."""

    id: int | None
    title: str
    assigned_to: int
    assigned_by: int
    priority: TaskPriority = TaskPriority.MEDIUM
    status: TaskStatus = TaskStatus.PENDING
    description: str = ""
    due_date: date | None = None
    assigned_to_name: str = ""
    assigned_by_name: str = ""
    created_at: datetime | None = None
    completed_at: datetime | None = None

    def validate(self) -> None:
        if not self.title.strip():
            raise ValueError("Task title is required.")
        if len(self.title) > 150:
            raise ValueError("Task title must be 150 characters or fewer.")
        if len(self.description) > 500:
            raise ValueError("Description must be 500 characters or fewer.")

    @property
    def is_overdue(self) -> bool:
        return bool(self.due_date) and not self.status.is_closed and self.due_date < date.today()

    def move_to(self, target: TaskStatus) -> None:
        if target is self.status:
            return
        if not self.status.can_become(target):
            raise ValueError(f"A {self.status.label.lower()} task cannot move to {target.label.lower()}.")
        self.status = target
        self.completed_at = datetime.now() if target is TaskStatus.COMPLETED else None

    def __lt__(self, other: "Task") -> bool:
        """Natural board order: most urgent first, then earliest due date."""
        mine = (-self.priority.rank, self.due_date or date.max)
        theirs = (-other.priority.rank, other.due_date or date.max)
        return mine < theirs

    @classmethod
    def from_row(cls, row: Mapping[str, Any] | None) -> "Task | None":
        if row is None:
            return None
        due = row.get("due_date")
        if due is not None and not isinstance(due, date):
            due = date.fromisoformat(str(due)[:10])
        return cls(
            id=row["id"], title=row["title"], assigned_to=row["assigned_to"], assigned_by=row["assigned_by"],
            priority=TaskPriority(row.get("priority") or "medium"), status=TaskStatus(row.get("status") or "pending"),
            description=row.get("description") or "", due_date=due,
            assigned_to_name=row.get("assigned_to_name") or "", assigned_by_name=row.get("assigned_by_name") or "",
            created_at=row.get("created_at"), completed_at=row.get("completed_at"),
        )
