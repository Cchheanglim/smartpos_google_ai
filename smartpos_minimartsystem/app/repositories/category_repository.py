"""
Category and Customer Repositories
"""

from typing import List, Optional
from .base_repository import BaseRepository
from .db_manager import db_manager
from ..models.category import Category, Supplier
from ..models.customer import Customer


class CategoryRepository(BaseRepository[Category]):
    """Data access repository for merchandise categories."""

    def __init__(self, db=None):
        self.db = db or db_manager

    def get_by_id(self, entity_id: int) -> Optional[Category]:
        row = self.db.execute_one("SELECT * FROM categories WHERE id = %s;", (entity_id,))
        if not row:
            return None
        return Category(row['id'], row['name'], row.get('description', ''), row.get('icon', 'fa-box'), bool(row.get('is_active', 1)))

    def get_all(self) -> List[Category]:
        rows = self.db.execute_query("SELECT * FROM categories WHERE is_active = 1 ORDER BY id ASC;")
        return [Category(r['id'], r['name'], r.get('description', ''), r.get('icon', 'fa-box'), bool(r.get('is_active', 1))) for r in rows]

    def create(self, category: Category) -> Category:
        new_id = self.db.execute_non_query(
            "INSERT INTO categories (name, description, icon, is_active) VALUES (%s, %s, %s, %s);",
            (category.name, category.description, category.icon, 1 if category.is_active else 0)
        )
        category.id = new_id
        return category

    def update(self, category: Category) -> bool:
        self.db.execute_non_query(
            "UPDATE categories SET name = %s, description = %s, icon = %s, is_active = %s WHERE id = %s;",
            (category.name, category.description, category.icon, 1 if category.is_active else 0, category.id)
        )
        return True

    def delete(self, entity_id: int) -> bool:
        self.db.execute_non_query("UPDATE categories SET is_active = 0 WHERE id = %s;", (entity_id,))
        return True


class CustomerRepository(BaseRepository[Customer]):
    """Data access repository for loyal customers and CRM points."""

    def __init__(self, db=None):
        self.db = db or db_manager

    def _map_row(self, row: dict) -> Customer:
        return Customer(
            id=row['id'],
            name=row['name'],
            phone=row['phone'],
            email=row.get('email', ''),
            tier=row.get('tier', 'Bronze'),
            points=int(row.get('points', 0)),
            discount_rate=float(row.get('discount_rate', 0.0)),
            total_spent=float(row.get('total_spent', 0.0)),
            notes=row.get('notes', ''),
            is_active=bool(row.get('is_active', 1))
        )

    def get_by_id(self, entity_id: int) -> Optional[Customer]:
        row = self.db.execute_one("SELECT * FROM customers WHERE id = %s;", (entity_id,))
        return self._map_row(row) if row else None

    def get_by_phone(self, phone: str) -> Optional[Customer]:
        row = self.db.execute_one("SELECT * FROM customers WHERE phone = %s AND is_active = 1;", (phone.strip(),))
        return self._map_row(row) if row else None

    def get_all(self) -> List[Customer]:
        rows = self.db.execute_query("SELECT * FROM customers WHERE is_active = 1 ORDER BY total_spent DESC;")
        return [self._map_row(r) for r in rows]

    def create(self, customer: Customer) -> Customer:
        new_id = self.db.execute_non_query(
            """
            INSERT INTO customers (name, phone, email, tier, points, discount_rate, total_spent, notes, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
            """,
            (
                customer.name,
                customer.phone,
                customer.email,
                customer.tier.label,
                customer.points,
                customer.discount_rate,
                customer.total_spent,
                customer.notes,
                1 if customer.is_active else 0
            )
        )
        customer.id = new_id
        return customer

    def update(self, customer: Customer) -> bool:
        self.db.execute_non_query(
            """
            UPDATE customers SET
                name = %s,
                phone = %s,
                email = %s,
                tier = %s,
                points = %s,
                discount_rate = %s,
                total_spent = %s,
                notes = %s,
                is_active = %s
            WHERE id = %s;
            """,
            (
                customer.name,
                customer.phone,
                customer.email,
                customer.tier.label,
                customer.points,
                customer.discount_rate,
                customer.total_spent,
                customer.notes,
                1 if customer.is_active else 0,
                customer.id
            )
        )
        return True

    def delete(self, entity_id: int) -> bool:
        self.db.execute_non_query("UPDATE customers SET is_active = 0 WHERE id = %s;", (entity_id,))
        return True
