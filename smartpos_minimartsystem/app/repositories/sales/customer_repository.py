"""Data access for loyalty customers."""
from decimal import Decimal
from typing import Any, Mapping

from app.models.sales.customer import Customer
from app.repositories.base_repository import BaseRepository


class CustomerRepository(BaseRepository[Customer]):
    table_name = "customers"
    default_order = "name"

    def _to_model(self, row: Mapping[str, Any] | None) -> Customer | None:
        return Customer.from_row(row)

    def find_by_phone(self, phone: str) -> Customer | None:
        return self._to_model(self._fetch_one("SELECT * FROM customers WHERE phone = %s", (phone,)))

    def search(self, term: str = "", min_points: int | None = None) -> list[Customer]:
        sql, params = "SELECT * FROM customers WHERE 1=1", []
        if term:
            sql += " AND (name LIKE %s OR phone LIKE %s)"
            params += [f"%{term}%", f"%{term}%"]
        if min_points is not None:
            sql += " AND points >= %s"
            params.append(min_points)
        sql += " ORDER BY points DESC, name"
        return [self._to_model(r) for r in self._fetch_all(sql, params)]

    def create(self, c: Customer) -> int:
        return self._execute("INSERT INTO customers (phone, name, points, notes) VALUES (%s, %s, %s, %s)",
                             (c.phone, c.name, c.points, c.notes))

    def update(self, c: Customer) -> None:
        self._execute("UPDATE customers SET phone=%s, name=%s, points=%s, notes=%s WHERE id=%s",
                      (c.phone, c.name, c.points, c.notes, c.id))

    def add_purchase(self, customer_id: int, amount: Decimal, points_earned: int, points_spent: int = 0) -> int:
        """Award points and spend; the guard refuses to spend more points than the member has."""
        return self._execute(
            "UPDATE customers SET points = points - %s + %s, total_spent = total_spent + %s "
            "WHERE id = %s AND points >= %s",
            (points_spent, points_earned, amount, customer_id, points_spent))

    def reverse_purchase(self, customer_id: int, amount: Decimal, points: int) -> None:
        self._execute(
            "UPDATE customers SET points = GREATEST(points - %s, 0), "
            "total_spent = GREATEST(total_spent - %s, 0) WHERE id = %s",
            (points, amount, customer_id))

    def has_sales(self, customer_id: int) -> bool:
        return self._fetch_one("SELECT 1 AS x FROM sales WHERE customer_id = %s LIMIT 1",
                               (customer_id,)) is not None
