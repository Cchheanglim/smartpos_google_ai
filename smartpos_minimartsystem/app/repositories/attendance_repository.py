"""
Attendance and Task Repositories
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from .base_repository import BaseRepository
from .db_manager import db_manager
from ..models.attendance import AttendanceRecord, Shift
from ..models.task import Task


class AttendanceRepository(BaseRepository[AttendanceRecord]):
    """Data access repository for staff punch clock and drawer floats."""

    def __init__(self, db=None):
        self.db = db or db_manager

    def _map_row(self, row: dict) -> AttendanceRecord:
        clock_in = row.get('clock_in')
        if isinstance(clock_in, str):
            try:
                clock_in = datetime.strptime(clock_in[:19], '%Y-%m-%d %H:%M:%S')
            except Exception:
                clock_in = datetime.now()

        clock_out = row.get('clock_out')
        if isinstance(clock_out, str):
            try:
                clock_out = datetime.strptime(clock_out[:19], '%Y-%m-%d %H:%M:%S')
            except Exception:
                clock_out = None

        return AttendanceRecord(
            id=row['id'],
            user_id=row['user_id'],
            clock_in=clock_in,
            clock_out=clock_out,
            status=row.get('status', 'present'),
            starting_cash=float(row.get('starting_cash', 0.0)),
            counted_cash=float(row['counted_cash']) if row.get('counted_cash') is not None else None,
            cash_discrepancy=float(row.get('cash_discrepancy', 0.0)),
            notes=row.get('notes', ''),
            user_name=row.get('user_name', '')
        )

    def get_by_id(self, entity_id: int) -> Optional[AttendanceRecord]:
        query = """
            SELECT a.*, u.name as user_name
            FROM attendance a
            JOIN users u ON a.user_id = u.id
            WHERE a.id = %s;
        """
        row = self.db.execute_one(query, (entity_id,))
        return self._map_row(row) if row else None

    def get_active_session(self, user_id: int) -> Optional[AttendanceRecord]:
        """Returns the currently open shift attendance session for a user."""
        query = """
            SELECT a.*, u.name as user_name
            FROM attendance a
            JOIN users u ON a.user_id = u.id
            WHERE a.user_id = %s AND a.clock_out IS NULL
            ORDER BY a.id DESC LIMIT 1;
        """
        row = self.db.execute_one(query, (user_id,))
        return self._map_row(row) if row else None

    def get_all(self, limit: int = 50) -> List[AttendanceRecord]:
        query = """
            SELECT a.*, u.name as user_name
            FROM attendance a
            JOIN users u ON a.user_id = u.id
            ORDER BY a.id DESC LIMIT %s;
        """
        rows = self.db.execute_query(query, (limit,))
        return [self._map_row(r) for r in rows]

    def create(self, entity: AttendanceRecord) -> AttendanceRecord:
        query = """
            INSERT INTO attendance (user_id, clock_in, status, starting_cash, notes)
            VALUES (%s, %s, %s, %s, %s);
        """
        clock_in_str = entity.clock_in.strftime('%Y-%m-%d %H:%M:%S')
        new_id = self.db.execute_non_query(query, (
            entity.user_id,
            clock_in_str,
            entity.status,
            entity.starting_cash,
            entity.notes
        ))
        entity.id = new_id
        return entity

    def update(self, entity: AttendanceRecord) -> bool:
        query = """
            UPDATE attendance SET
                clock_out = %s,
                status = %s,
                counted_cash = %s,
                cash_discrepancy = %s,
                notes = %s
            WHERE id = %s;
        """
        clock_out_str = entity.clock_out.strftime('%Y-%m-%d %H:%M:%S') if entity.clock_out else None
        self.db.execute_non_query(query, (
            clock_out_str,
            entity.status,
            entity.counted_cash,
            entity.cash_discrepancy,
            entity.notes,
            entity.id
        ))
        return True

    def delete(self, entity_id: int) -> bool:
        self.db.execute_non_query("DELETE FROM attendance WHERE id = %s;", (entity_id,))
        return True


class TaskRepository(BaseRepository[Task]):
    """Data access repository for staff duties and task delegation."""

    def __init__(self, db=None):
        self.db = db or db_manager

    def _map_row(self, row: dict) -> Task:
        return Task(
            id=row['id'],
            title=row['title'],
            description=row.get('description', ''),
            assigned_to=row['assigned_to'],
            assigned_by=row['assigned_by'],
            priority=row.get('priority', 'medium'),
            status=row.get('status', 'pending'),
            due_date=str(row.get('due_date', '')),
            assignee_name=row.get('assignee_name', ''),
            assigner_name=row.get('assigner_name', '')
        )

    def get_by_id(self, entity_id: int) -> Optional[Task]:
        query = """
            SELECT t.*, u1.name as assignee_name, u2.name as assigner_name
            FROM tasks t
            JOIN users u1 ON t.assigned_to = u1.id
            JOIN users u2 ON t.assigned_by = u2.id
            WHERE t.id = %s;
        """
        row = self.db.execute_one(query, (entity_id,))
        return self._map_row(row) if row else None

    def get_all(self) -> List[Task]:
        query = """
            SELECT t.*, u1.name as assignee_name, u2.name as assigner_name
            FROM tasks t
            JOIN users u1 ON t.assigned_to = u1.id
            JOIN users u2 ON t.assigned_by = u2.id
            ORDER BY 
                CASE t.priority 
                    WHEN 'urgent' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'medium' THEN 3 
                    ELSE 4 
                END ASC,
                t.id DESC;
        """
        rows = self.db.execute_query(query)
        return [self._map_row(r) for r in rows]

    def create(self, entity: Task) -> Task:
        query = """
            INSERT INTO tasks (title, description, assigned_to, assigned_by, priority, status, due_date)
            VALUES (%s, %s, %s, %s, %s, %s, %s);
        """
        new_id = self.db.execute_non_query(query, (
            entity.title,
            entity.description,
            entity.assigned_to,
            entity.assigned_by,
            entity.priority,
            entity.status,
            entity.due_date
        ))
        entity.id = new_id
        return entity

    def update(self, entity: Task) -> bool:
        query = """
            UPDATE tasks SET
                title = %s,
                description = %s,
                assigned_to = %s,
                priority = %s,
                status = %s,
                due_date = %s,
                completed_at = %s
            WHERE id = %s;
        """
        comp_str = entity.completed_at.strftime('%Y-%m-%d %H:%M:%S') if entity.completed_at else None
        self.db.execute_non_query(query, (
            entity.title,
            entity.description,
            entity.assigned_to,
            entity.priority,
            entity.status,
            entity.due_date,
            comp_str,
            entity.id
        ))
        return True

    def delete(self, entity_id: int) -> bool:
        self.db.execute_non_query("DELETE FROM tasks WHERE id = %s;", (entity_id,))
        return True
