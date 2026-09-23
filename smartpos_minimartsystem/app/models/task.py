"""
Task Domain Model
"""

from typing import Dict, Any, Optional
from datetime import datetime, date
from .base import BaseModel


class Task(BaseModel):
    """Operational duty or assignment delegated to store staff."""
    
    def __init__(
        self,
        id: Optional[int],
        title: str,
        description: str,
        assigned_to: int,
        assigned_by: int,
        priority: str = 'medium',
        status: str = 'pending',
        due_date: Optional[str] = None,
        created_at: Optional[datetime] = None,
        completed_at: Optional[datetime] = None,
        assignee_name: str = '',
        assigner_name: str = ''
    ):
        super().__init__(id, created_at)
        self.title = title.strip()
        self.description = description.strip() if description else ''
        self.assigned_to = assigned_to
        self.assigned_by = assigned_by
        self.priority = priority.lower()
        self.status = status.lower()
        self.due_date = due_date
        self.completed_at = completed_at
        self.assignee_name = assignee_name
        self.assigner_name = assigner_name

    def mark_completed(self) -> None:
        """Transitions task status to completed and sets completion timestamp."""
        self.status = 'completed'
        self.completed_at = datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'assigned_to': self.assigned_to,
            'assigned_by': self.assigned_by,
            'assignee_name': self.assignee_name,
            'assigner_name': self.assigner_name,
            'priority': self.priority,
            'status': self.status,
            'due_date': self.due_date,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else '',
            'completed_at': self.completed_at.strftime('%Y-%m-%d %H:%M:%S') if self.completed_at else None
        }
