"""Data access for the suppliers table."""
from typing import Any, Mapping

from app.models.inventory.supplier import Supplier
from app.repositories.base_repository import BaseRepository


class SupplierRepository(BaseRepository[Supplier]):
    table_name = "suppliers"
    default_order = "s.name"

    def _to_model(self, row: Mapping[str, Any] | None) -> Supplier | None:
        return Supplier.from_row(row)

    def _select_sql(self) -> str:
        return ("SELECT s.*, (SELECT COUNT(*) FROM products p WHERE p.supplier_id = s.id) AS product_count "
                "FROM suppliers s")

    def _alias(self) -> str:
        return "s."

    def find_by_name(self, name: str) -> Supplier | None:
        return self._to_model(self._fetch_one(f"{self._select_sql()} WHERE s.name = %s", (name,)))

    def create(self, s: Supplier) -> int:
        return self._execute(
            "INSERT INTO suppliers (name, contact_name, phone, email, address) VALUES (%s, %s, %s, %s, %s)",
            (s.name, s.contact_name, s.phone, s.email, s.address))

    def update(self, s: Supplier) -> None:
        self._execute(
            "UPDATE suppliers SET name=%s, contact_name=%s, phone=%s, email=%s, address=%s WHERE id=%s",
            (s.name, s.contact_name, s.phone, s.email, s.address, s.id))
