"""Data access for parked carts (held_orders)."""
from typing import Any, Mapping

from app.models.sales.held_order import HeldOrder
from app.repositories.base_repository import BaseRepository


class HeldOrderRepository(BaseRepository[HeldOrder]):
    table_name = "held_orders"

    def _to_model(self, row: Mapping[str, Any] | None) -> HeldOrder | None:
        return HeldOrder.from_row(row)

    def _select_sql(self) -> str:
        return "SELECT h.*, u.name AS cashier_name FROM held_orders h JOIN users u ON u.id = h.cashier_id"

    def _alias(self) -> str:
        return "h."

    def list_for(self, cashier_id: int | None = None) -> list[HeldOrder]:
        """Held tickets; ``None`` means every register (managers)."""
        if cashier_id is None:
            rows = self._fetch_all(f"{self._select_sql()} ORDER BY h.held_at DESC")
        else:
            rows = self._fetch_all(f"{self._select_sql()} WHERE h.cashier_id = %s ORDER BY h.held_at DESC",
                                   (cashier_id,))
        return [self._to_model(r) for r in rows]

    def create(self, order: HeldOrder) -> int:
        return self._execute(
            "INSERT INTO held_orders (cashier_id, label, customer_phone, cart_json, item_count) "
            "VALUES (%s, %s, %s, %s, %s)",
            (order.cashier_id, order.label, order.customer_phone or None, order.cart_json(), order.item_count))
