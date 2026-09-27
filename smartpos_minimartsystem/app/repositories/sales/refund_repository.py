"""Data access for refunds and refund_items."""
from typing import Any, Mapping

from app.models.sales.refund import Refund, RefundItem
from app.repositories.base_repository import BaseRepository


class RefundRepository(BaseRepository[Refund]):
    table_name = "refunds"
    default_order = "r.created_at DESC"

    def _to_model(self, row: Mapping[str, Any] | None) -> Refund | None:
        return Refund.from_row(row)

    def _select_sql(self) -> str:
        return ("SELECT r.*, u.name AS processed_by_name, s.payment_method, "
                "(SELECT COALESCE(SUM(ri.quantity), 0) FROM refund_items ri WHERE ri.refund_id = r.id) AS item_count "
                "FROM refunds r JOIN users u ON u.id = r.processed_by JOIN sales s ON s.id = r.sale_id")

    def _alias(self) -> str:
        return "r."

    def list_for_sale(self, sale_id: int) -> list[Refund]:
        refunds = [self._to_model(r) for r in
                   self._fetch_all(f"{self._select_sql()} WHERE r.sale_id = %s ORDER BY r.created_at", (sale_id,))]
        for refund in refunds:
            rows = self._fetch_all(
                "SELECT ri.*, si.product_id, si.product_name FROM refund_items ri "
                "JOIN sale_items si ON si.id = ri.sale_item_id WHERE ri.refund_id = %s", (refund.id,))
            refund.items = [RefundItem.from_row(r) for r in rows]
        return refunds

    def search(self, start=None, end=None, processed_by: int | None = None, limit: int = 200) -> list[Refund]:
        """The refund audit log (newest first)."""
        sql, params = f"{self._select_sql()} WHERE 1=1", []
        if start:
            sql += " AND DATE(r.created_at) >= %s"
            params.append(start)
        if end:
            sql += " AND DATE(r.created_at) <= %s"
            params.append(end)
        if processed_by:
            sql += " AND r.processed_by = %s"
            params.append(processed_by)
        sql += " ORDER BY r.created_at DESC, r.id DESC LIMIT %s"
        params.append(limit)
        return [self._to_model(r) for r in self._fetch_all(sql, params)]

    def create(self, refund: Refund) -> int:
        return self._execute(
            "INSERT INTO refunds (sale_id, processed_by, attendance_id, reason, refund_amount) "
            "VALUES (%s, %s, %s, %s, %s)",
            (refund.sale_id, refund.processed_by, refund.attendance_id, refund.reason, refund.refund_amount))

    def add_item(self, refund_id: int, item: RefundItem) -> int:
        return self._execute(
            "INSERT INTO refund_items (refund_id, sale_item_id, quantity, amount) VALUES (%s, %s, %s, %s)",
            (refund_id, item.sale_item_id, item.quantity, item.amount))
