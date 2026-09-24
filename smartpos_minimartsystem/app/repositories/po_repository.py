"""
Purchase Order (PO) and Supplier Repository
Handles procurement state machine: Draft -> Ordered -> Received / Cancelled.
When marked Received, automatically increments product stock and logs audit trail.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from .db_manager import db_manager


class PORepository:
    def __init__(self, db=None):
        self.db = db or db_manager

    def get_suppliers(self) -> List[Dict[str, Any]]:
        return self.db.execute_query("SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name ASC;")

    def get_all(self, limit: int = 50) -> List[Dict[str, Any]]:
        query = """
            SELECT po.*, 
                   (SELECT count(*) FROM purchase_order_items poi WHERE poi.po_id = po.id) as item_count,
                   (SELECT COALESCE(SUM(quantity), 0) FROM purchase_order_items poi WHERE poi.po_id = po.id) as total_units
            FROM purchase_orders po
            ORDER BY po.id DESC
            LIMIT %s;
        """
        rows = self.db.execute_query(query, (limit,))
        for r in rows:
            r['items'] = self.get_items_for_po(r['id'])
        return rows

    def get_by_id(self, po_id: int) -> Optional[Dict[str, Any]]:
        query = "SELECT * FROM purchase_orders WHERE id = %s;"
        po = self.db.execute_one(query, (po_id,))
        if po:
            po['items'] = self.get_items_for_po(po_id)
        return po

    def get_items_for_po(self, po_id: int) -> List[Dict[str, Any]]:
        query = "SELECT * FROM purchase_order_items WHERE po_id = %s ORDER BY id ASC;"
        return self.db.execute_query(query, (po_id,))

    def create(self, po_data: Dict[str, Any], items: List[Dict[str, Any]]) -> Dict[str, Any]:
        # Generate PO code
        ts = datetime.now().strftime('%Y%m%d%H%M')
        po_number = f"PO-{ts}"

        query = """
            INSERT INTO purchase_orders (po_number, supplier_id, supplier_name, status, expected_delivery, total_amount, notes, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
        """
        total_amount = sum(float(i.get('subtotal', 0.0)) for i in items)
        po_id = self.db.execute_non_query(query, (
            po_number,
            po_data.get('supplier_id'),
            po_data.get('supplier_name', 'Supplier'),
            po_data.get('status', 'draft'),
            po_data.get('expected_delivery'),
            total_amount,
            po_data.get('notes', ''),
            po_data.get('created_by', 1)
        ))

        # Insert items
        for it in items:
            it_query = """
                INSERT INTO purchase_order_items (po_id, product_id, product_name, quantity, unit_cost, subtotal)
                VALUES (%s, %s, %s, %s, %s, %s);
            """
            self.db.execute_non_query(it_query, (
                po_id,
                it['product_id'],
                it['product_name'],
                it['quantity'],
                it['unit_cost'],
                it['subtotal']
            ))

        return self.get_by_id(po_id)

    def update_status(self, po_id: int, new_status: str, user_id: int = 1) -> bool:
        po = self.get_by_id(po_id)
        if not po:
            return False

        current_status = po.get('status')
        if current_status == new_status:
            return True

        # State transition handling
        if new_status == 'received' and current_status != 'received':
            # Automatically restock inventory!
            items = po.get('items', [])
            total_units = 0
            for item in items:
                p_id = item['product_id']
                qty = item['quantity']
                total_units += qty

                # Fetch previous quantity
                prod_row = self.db.execute_one("SELECT name, quantity_in_stock FROM products WHERE id = %s;", (p_id,))
                prev_qty = prod_row['quantity_in_stock'] if prod_row else 0
                new_qty = prev_qty + qty

                # Update product stock
                self.db.execute_non_query(
                    "UPDATE products SET quantity_in_stock = quantity_in_stock + %s WHERE id = %s;",
                    (qty, p_id)
                )

                # Record stock adjustment log
                self.db.execute_non_query("""
                    INSERT INTO stock_adjustments (product_id, user_id, change_quantity, previous_quantity, new_quantity, reason, notes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s);
                """, (
                    p_id,
                    user_id,
                    qty,
                    prev_qty,
                    new_qty,
                    'Supplier Delivery Restock',
                    f"Automated receiving from PO #{po['po_number']}"
                ))

            # Set received timestamp
            self.db.execute_non_query(
                "UPDATE purchase_orders SET status = 'received', received_at = %s WHERE id = %s;",
                (datetime.now().strftime('%Y-%m-%d %H:%M:%S'), po_id)
            )

            # Trigger Telegram alert
            try:
                from ..services.telegram_service import telegram_service
                telegram_service.notify_purchase_order(
                    po_code=po['po_number'],
                    supplier_name=po['supplier_name'],
                    status='RECEIVED & RESTOCKED',
                    total_items=total_units,
                    total_cost=float(po['total_amount'])
                )
            except Exception:
                pass

            return True

        else:
            self.db.execute_non_query(
                "UPDATE purchase_orders SET status = %s WHERE id = %s;",
                (new_status, po_id)
            )
            return True
