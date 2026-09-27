"""Data access for purchase_orders and purchase_order_items."""
from typing import Any, Mapping

from app.models.inventory.purchase_order import POStatus, PurchaseOrder, PurchaseOrderItem
from app.repositories.base_repository import BaseRepository


class PurchaseOrderRepository(BaseRepository[PurchaseOrder]):
    table_name = "purchase_orders"
    default_order = "po.created_at DESC, po.id DESC"

    def _to_model(self, row: Mapping[str, Any] | None) -> PurchaseOrder | None:
        return PurchaseOrder.from_row(row)

    def _select_sql(self) -> str:
        return ("SELECT po.*, s.name AS supplier_name, cu.name AS created_by_name, ru.name AS received_by_name, "
                "(SELECT COALESCE(SUM(i.quantity * i.unit_cost), 0) FROM purchase_order_items i "
                " WHERE i.po_id = po.id) AS total_cost "
                "FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id "
                "LEFT JOIN users cu ON cu.id = po.created_by LEFT JOIN users ru ON ru.id = po.received_by")

    def _alias(self) -> str:
        return "po."

    def search(self, status: str = "", supplier_id: int | None = None) -> list[PurchaseOrder]:
        sql, params = f"{self._select_sql()} WHERE 1=1", []
        if status:
            sql += " AND po.status = %s"
            params.append(status)
        if supplier_id:
            sql += " AND po.supplier_id = %s"
            params.append(supplier_id)
        sql += f" ORDER BY {self.default_order} LIMIT 200"
        return [self._to_model(r) for r in self._fetch_all(sql, params)]

    def find_with_items(self, po_id: int) -> PurchaseOrder | None:
        po = self.find_by_id(po_id)
        if po is not None:
            po.items = self.items_for(po_id)
        return po

    def items_for(self, po_id: int) -> list[PurchaseOrderItem]:
        rows = self._fetch_all(
            "SELECT i.*, p.name AS product_name, p.sku AS product_sku FROM purchase_order_items i "
            "JOIN products p ON p.id = i.product_id WHERE i.po_id = %s ORDER BY p.name", (po_id,))
        return [PurchaseOrderItem.from_row(r) for r in rows]

    def status_counts(self) -> dict[str, int]:
        rows = self._fetch_all("SELECT status, COUNT(*) AS n FROM purchase_orders GROUP BY status")
        return {r["status"]: int(r["n"]) for r in rows}

    # ---- writes ----
    def create(self, po: PurchaseOrder) -> int:
        return self._execute(
            "INSERT INTO purchase_orders (supplier_id, status, expected_date, notes, created_by) "
            "VALUES (%s, %s, %s, %s, %s)",
            (po.supplier_id, po.status.value, po.expected_date, po.notes or None, po.created_by))

    def update_header(self, po: PurchaseOrder) -> None:
        self._execute("UPDATE purchase_orders SET supplier_id=%s, expected_date=%s, notes=%s WHERE id=%s",
                      (po.supplier_id, po.expected_date, po.notes or None, po.id))

    def replace_items(self, po_id: int, items: list[PurchaseOrderItem]) -> None:
        self._execute("DELETE FROM purchase_order_items WHERE po_id = %s", (po_id,))
        for item in items:
            self._execute("INSERT INTO purchase_order_items (po_id, product_id, quantity, unit_cost) "
                          "VALUES (%s, %s, %s, %s)", (po_id, item.product_id, item.quantity, item.unit_cost))

    def set_status(self, po_id: int, current: POStatus, target: POStatus, user_id: int) -> int:
        """Guarded status change: only succeeds if the row is still in ``current``
        (prevents two people receiving the same order twice)."""
        stamp = {POStatus.ORDERED: "ordered_at = NOW()",
                 POStatus.RECEIVED: "received_at = NOW(), received_by = %s",
                 POStatus.CANCELLED: "cancelled_at = NOW()"}[target]
        params: list[Any] = [target.value]
        if target is POStatus.RECEIVED:
            params.append(user_id)
        params += [po_id, current.value]
        return self._execute(f"UPDATE purchase_orders SET status = %s, {stamp} WHERE id = %s AND status = %s",
                             params)
