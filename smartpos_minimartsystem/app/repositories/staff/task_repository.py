"""Data access for the task board."""
from typing import Any, Mapping

from app.models.staff.task import Task
from app.repositories.base_repository import BaseRepository


class TaskRepository(BaseRepository[Task]):
    table_name = "tasks"

    def _to_model(self, row: Mapping[str, Any] | None) -> Task | None:
        return Task.from_row(row)

    def _select_sql(self) -> str:
        return ("SELECT t.*, ut.name AS assigned_to_name, ub.name AS assigned_by_name FROM tasks t "
                "JOIN users ut ON ut.id = t.assigned_to JOIN users ub ON ub.id = t.assigned_by")

    def _alias(self) -> str:
        return "t."

    def search(self, assigned_to: int | None = None, assigned_by: int | None = None,
               status: str = "", priority: str = "") -> list[Task]:
        sql, params = f"{self._select_sql()} WHERE 1=1", []
        for column, value in (("t.assigned_to", assigned_to), ("t.assigned_by", assigned_by),
                              ("t.status", status), ("t.priority", priority)):
            if value:
                sql += f" AND {column} = %s"
                params.append(value)
        sql += " ORDER BY t.created_at DESC LIMIT 300"
        return [self._to_model(r) for r in self._fetch_all(sql, params)]

    def count_open_for(self, user_id: int) -> int:
        row = self._fetch_one("SELECT COUNT(*) AS n FROM tasks WHERE assigned_to = %s "
                              "AND status IN ('pending','in_progress')", (user_id,))
        return int(row["n"]) if row else 0

    def create(self, task: Task) -> int:
        return self._execute(
            "INSERT INTO tasks (title, description, assigned_to, assigned_by, priority, status, due_date) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (task.title, task.description or None, task.assigned_to, task.assigned_by,
             task.priority.value, task.status.value, task.due_date))

    def update(self, task: Task) -> None:
        self._execute(
            "UPDATE tasks SET title=%s, description=%s, assigned_to=%s, priority=%s, status=%s, due_date=%s, "
            "completed_at=%s WHERE id=%s",
            (task.title, task.description or None, task.assigned_to, task.priority.value, task.status.value,
             task.due_date, task.completed_at, task.id))
