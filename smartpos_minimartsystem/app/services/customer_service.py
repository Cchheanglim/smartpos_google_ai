"""
Customer CRM, Reporting Analytics, and Task Services
"""

from typing import List, Optional, Tuple, Dict, Any
from ..models.customer import Customer
from ..models.task import Task
from ..repositories.category_repository import CustomerRepository
from ..repositories.report_repository import ReportRepository
from ..repositories.sale_repository import SaleRepository
from ..repositories.attendance_repository import TaskRepository
from .report_service import ReportService


class CustomerService:
    """Manages CRM customer registration, tier evaluations, and loyalty lookups."""

    def __init__(self, customer_repo: Optional[CustomerRepository] = None):
        self.customer_repo = customer_repo or CustomerRepository()

    def get_all_customers(self) -> List[Customer]:
        return self.customer_repo.get_all()

    def get_by_id(self, customer_id: int) -> Optional[Customer]:
        return self.customer_repo.get_by_id(customer_id)

    def find_by_phone(self, phone: str) -> Optional[Customer]:
        return self.customer_repo.get_by_phone(phone)

    def register_customer(self, data: Dict[str, Any]) -> Tuple[Optional[Customer], Optional[str]]:
        phone = data.get('phone', '').strip()
        if not phone:
            return None, "Customer phone number is required."

        if self.customer_repo.get_by_phone(phone):
            return None, f"A customer with phone number '{phone}' is already registered."

        try:
            customer = Customer(
                id=None,
                name=data['name'],
                phone=phone,
                email=data.get('email', ''),
                tier=data.get('tier', 'Bronze'),
                points=int(data.get('points', 0)),
                notes=data.get('notes', '')
            )
            saved = self.customer_repo.create(customer)
            return saved, None
        except Exception as ex:
            return None, str(ex)

    def adjust_points(self, customer_id: int, points_delta: int) -> Tuple[bool, Optional[str]]:
        customer = self.customer_repo.get_by_id(customer_id)
        if not customer:
            return False, "Customer not found."
        customer.points = max(0, customer.points + points_delta)
        self.customer_repo.update(customer)
        return True, None


class TaskService:
    """Manages operational duties assigned to staff members."""

    def __init__(self, task_repo: Optional[TaskRepository] = None):
        self.task_repo = task_repo or TaskRepository()

    def list_tasks(self) -> List[Task]:
        return self.task_repo.get_all()

    def create_task(self, data: Dict[str, Any], assigned_by: int) -> Tuple[Optional[Task], Optional[str]]:
        try:
            task = Task(
                id=None,
                title=data['title'],
                description=data.get('description', ''),
                assigned_to=int(data['assigned_to']),
                assigned_by=assigned_by,
                priority=data.get('priority', 'medium'),
                status='pending',
                due_date=data.get('due_date')
            )
            saved = self.task_repo.create(task)
            return saved, None
        except Exception as ex:
            return None, str(ex)

    def update_task_status(self, task_id: int, new_status: str) -> bool:
        task = self.task_repo.get_by_id(task_id)
        if not task:
            return False
        task.status = new_status.lower()
        if new_status.lower() == 'completed':
            task.mark_completed()
        self.task_repo.update(task)
        return True
