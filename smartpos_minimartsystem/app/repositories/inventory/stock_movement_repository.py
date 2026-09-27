"""Data access for the stock_movements ledger."""
from typing import Any, Mapping

from app.models.inventory.stock_movement import StockMovement
from app.repositories.base_repository import BaseRepository


class StockMovementRepository(BaseRepository[StockMovement]):
    table_name = "stock_movements"

    def _to_model(self, row: Mapping[str, Any] | None) -> StockMovement | None:
        return StockMovement.from_row(row)

    def _select_sql(self) -> str:
        return ("SELECT m.*, p.name AS product_name, u.name AS created_by_name "
                "FROM stock_movements m JOIN products p ON p.id = m.product_id "
                "LEFT JOIN users u ON u.id = m.created_by")

    def _alias(self) -> str:
        return "m."

    def create(self, product_id: int, change: int, reason: str, note: str = "",
               created_by: int | None = None) -> int:
        return self._execute(
            "INSERT INTO stock_movements (product_id, change_amount, reason, note, created_by) "
            "VALUES (%s, %s, %s, %s, %s)", (product_id, change, reason, note, created_by))

    def list_for_product(self, product_id: int, limit: int = 30) -> list[StockMovement]:
        rows = self._fetch_all(f"{self._select_sql()} WHERE m.product_id = %s "
                               "ORDER BY m.created_at DESC, m.id DESC LIMIT %s", (product_id, limit))
        return [self._to_model(r) for r in rows]

    def list_filtered(self, reason: str = "", product_id: int | None = None,
                      limit: int = 100) -> list[StockMovement]:
        """Ledger view for waste auditing, optionally filtered by reason code."""
        sql, params = f"{self._select_sql()} WHERE 1=1", []
        if reason:
            sql += " AND m.reason = %s"
            params.append(reason)
        if product_id:
            sql += " AND m.product_id = %s"
            params.append(product_id)
        sql += " ORDER BY m.created_at DESC, m.id DESC LIMIT %s"
        params.append(limit)
        return [self._to_model(r) for r in self._fetch_all(sql, params)]

    def list_recent(self, limit: int = 15) -> list[StockMovement]:
        rows = self._fetch_all(f"{self._select_sql()} ORDER BY m.created_at DESC, m.id DESC LIMIT %s", (limit,))
        return [self._to_model(r) for r in rows]
