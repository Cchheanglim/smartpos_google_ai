"""Manager-to-staff task delegation."""
from dataclasses import dataclass
from datetime import date

from app.models.auth.user import User
from app.models.staff.task import Task, TaskPriority, TaskStatus
from app.repositories.auth.user_repository import UserRepository
from app.repositories.staff.task_repository import TaskRepository
from app.services.auth.auth_service import AuthService
from app.services.errors import NotFoundError


@dataclass
class TaskBoard:
    columns: dict[TaskStatus, list[Task]]
    staff: list[User]
    can_manage: bool
    filters: dict
    counts: dict[str, int]


class TaskService:
    """Managers (``manage_tasks``) create and assign; assignees move their own tasks along."""

    BOARD_COLUMNS = (TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED)

    def __init__(self, task_repo: TaskRepository | None = None,
                 user_repo: UserRepository | None = None,
                 auth_service: AuthService | None = None) -> None:
        self.task_repo = task_repo or TaskRepository()
        self.user_repo = user_repo or UserRepository()
        self.auth_service = auth_service or AuthService()

    def _can_manage(self, user: User) -> bool:
        return self.auth_service.has_permission(user, "manage_tasks")

    def board(self, user: User, assigned_to: int | None = None, assigned_by: int | None = None,
              priority: str = "") -> TaskBoard:
        can_manage = self._can_manage(user)
        if not can_manage:                   # staff only ever see their own duties
            assigned_to, assigned_by = user.id, None
        tasks = sorted(self.task_repo.search(assigned_to=assigned_to, assigned_by=assigned_by, priority=priority))
        columns = {status: [t for t in tasks if t.status is status] for status in self.BOARD_COLUMNS}
        return TaskBoard(
            columns=columns, staff=self.user_repo.list_active() if can_manage else [], can_manage=can_manage,
            filters={"assigned_to": assigned_to, "assigned_by": assigned_by, "priority": priority},
            counts={"open": sum(1 for t in tasks if not t.status.is_closed),
                    "overdue": sum(1 for t in tasks if t.is_overdue),
                    "urgent": sum(1 for t in tasks if t.priority is TaskPriority.URGENT and not t.status.is_closed)},
        )

    def create(self, manager: User, title: str, assigned_to: int, priority: str,
               due_date: date | None, description: str = "") -> Task:
        assignee = self.user_repo.find_by_id(assigned_to)
        if assignee is None or not assignee.is_active:
            raise ValueError("Choose an active staff member to assign the task to.")
        try:
            prio = TaskPriority(priority)
        except ValueError:
            raise ValueError("Choose a valid priority.") from None
        if due_date and due_date < date.today():
            raise ValueError("The due date cannot be in the past.")
        task = Task(id=None, title=title.strip(), assigned_to=assignee.id, assigned_by=manager.id,
                    priority=prio, due_date=due_date, description=description.strip())
        task.validate()
        task.id = self.task_repo.create(task)
        return task

    def change_status(self, user: User, task_id: int, status: str) -> Task:
        task = self._get(task_id)
        if task.assigned_to != user.id and not self._can_manage(user):
            raise PermissionError("You can only update tasks assigned to you.")
        try:
            target = TaskStatus(status)
        except ValueError:
            raise ValueError("Unknown task status.") from None
        if target is TaskStatus.CANCELLED and not self._can_manage(user):
            raise PermissionError("Only a manager can cancel a task.")
        task.move_to(target)
        self.task_repo.update(task)
        return task

    def delete(self, user: User, task_id: int) -> Task:
        if not self._can_manage(user):
            raise PermissionError("Only a manager can delete tasks.")
        task = self._get(task_id)
        self.task_repo.delete(task_id)
        return task

    def open_count(self, user: User) -> int:
        return self.task_repo.count_open_for(user.id)

    def _get(self, task_id: int) -> Task:
        task = self.task_repo.find_by_id(task_id)
        if task is None:
            raise NotFoundError("Task not found.")
        return task
