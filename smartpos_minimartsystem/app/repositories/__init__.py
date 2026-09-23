"""
Repositories Package Export
"""

from .base_repository import BaseRepository
from .db_manager import DatabaseManager, db_manager
from .user_repository import UserRepository
from .role_repository import RoleRepository
from .product_repository import ProductRepository
from .category_repository import CategoryRepository, CustomerRepository
from .sale_repository import SaleRepository
from .attendance_repository import AttendanceRepository, TaskRepository
from .report_repository import ReportRepository

__all__ = [
    'BaseRepository',
    'DatabaseManager',
    'db_manager',
    'UserRepository',
    'RoleRepository',
    'ProductRepository',
    'CategoryRepository',
    'CustomerRepository',
    'SaleRepository',
    'AttendanceRepository',
    'TaskRepository',
    'ReportRepository'
]
