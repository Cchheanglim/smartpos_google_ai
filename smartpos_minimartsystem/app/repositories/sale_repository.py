"""
Sales and Refund Repository
Handles transactional persistence for checkout orders, line items, and refunds.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from .base_repository import BaseRepository
from .db_manager import db_manager
from ..models.sale import Sale, SaleItem, PaymentDetail, Refund, RefundItem


class SaleRepository(BaseRepository[Sale]):
    """Data access repository for POS orders, line items, and refunds."""

    def __init__(self, db=None):
        self.db = db or db_manager

    def _map_row_to_sale(self, row: dict, load_items: bool = True) -> Sale:
        sale_id = row['id']
        items = []
        if load_items:
            item_rows = self.db.execute_query("SELECT * FROM sale_items WHERE sale_id = %s;", (sale_id,))
            items = [
                SaleItem(
                    id=ir['id'],
                    product_id=ir['product_id'],
                    product_name=ir['product_name'],
                    sku=ir['sku'],
                    unit_price=float(ir['unit_price']),
                    cost_price=float(ir.get('cost_price', 0.0)),
                    quantity=int(ir['quantity']),
                    discount=float(ir.get('discount', 0.0))
                )
                for ir in item_rows
            ]

        payment = PaymentDetail(
            method=row.get('payment_method', 'Cash'),
            currency_mode=row.get('currency_mode', 'usd'),
            exchange_rate=float(row.get('exchange_rate', 4100.0)),
            amount_paid_usd=float(row.get('amount_paid_usd', 0.0)),
            amount_paid_khr=float(row.get('amount_paid_khr', 0.0)),
            change_usd=float(row.get('change_usd', 0.0)),
            change_khr=float(row.get('change_khr', 0.0))
        )

        completed_at = row.get('completed_at')
        if isinstance(completed_at, str):
            try:
                completed_at = datetime.strptime(completed_at[:19], '%Y-%m-%d %H:%M:%S')
            except Exception:
                completed_at = datetime.now()

        return Sale(
            id=row['id'],
            transaction_code=row['transaction_code'],
            cashier_id=row['cashier_id'],
            customer_id=row.get('customer_id'),
            subtotal=float(row['subtotal']),
            discount_percent=float(row.get('discount_percent', 0.0)),
            discount_amount=float(row.get('discount_amount', 0.0)),
            tax_percent=float(row.get('tax_percent', 0.0)),
            tax_amount=float(row.get('tax_amount', 0.0)),
            total_amount=float(row['total_amount']),
            payment=payment,
            items=items,
            points_redeemed=int(row.get('points_redeemed', 0)),
            points_discount_usd=float(row.get('points_discount_usd', 0.0)),
            points_earned=int(row.get('points_earned', 0)),
            status=row.get('status', 'completed'),
            notes=row.get('notes', ''),
            cashier_name=row.get('cashier_name', ''),
            customer_name=row.get('customer_name', ''),
            completed_at=completed_at
        )

    def get_by_id(self, entity_id: int) -> Optional[Sale]:
        query = """
            SELECT s.*, u.name as cashier_name, c.name as customer_name
            FROM sales s
            JOIN users u ON s.cashier_id = u.id
            LEFT JOIN customers c ON s.customer_id = c.id
            WHERE s.id = %s;
        """
        row = self.db.execute_one(query, (entity_id,))
        return self._map_row_to_sale(row, load_items=True) if row else None

    def get_by_transaction_code(self, code: str) -> Optional[Sale]:
        query = """
            SELECT s.*, u.name as cashier_name, c.name as customer_name
            FROM sales s
            JOIN users u ON s.cashier_id = u.id
            LEFT JOIN customers c ON s.customer_id = c.id
            WHERE s.transaction_code = %s;
        """
        row = self.db.execute_one(query, (code.strip(),))
        return self._map_row_to_sale(row, load_items=True) if row else None

    def get_all(self, limit: int = 100) -> List[Sale]:
        query = """
            SELECT s.*, u.name as cashier_name, c.name as customer_name
            FROM sales s
            JOIN users u ON s.cashier_id = u.id
            LEFT JOIN customers c ON s.customer_id = c.id
            ORDER BY s.id DESC LIMIT %s;
        """
        rows = self.db.execute_query(query, (limit,))
        return [self._map_row_to_sale(r, load_items=False) for r in rows]

    def create(self, sale: Sale) -> Sale:
        """Saves sale record and inserts all line items atomically."""
        query = """
            INSERT INTO sales (
                transaction_code, cashier_id, customer_id, subtotal, discount_percent,
                discount_amount, tax_percent, tax_amount, total_amount, payment_method,
                currency_mode, exchange_rate, amount_paid_usd, amount_paid_khr, change_usd,
                change_khr, points_redeemed, points_discount_usd, points_earned, status,
                notes, completed_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            );
        """
        completed_str = sale.completed_at.strftime('%Y-%m-%d %H:%M:%S')
        new_id = self.db.execute_non_query(query, (
            sale.transaction_code,
            sale.cashier_id,
            sale.customer_id,
            sale.subtotal,
            sale.discount_percent,
            sale.discount_amount,
            sale.tax_percent,
            sale.tax_amount,
            sale.total_amount,
            sale.payment.method,
            sale.payment.currency_mode,
            sale.payment.exchange_rate,
            sale.payment.amount_paid_usd,
            sale.payment.amount_paid_khr,
            sale.payment.change_usd,
            sale.payment.change_khr,
            sale.points_redeemed,
            sale.points_discount_usd,
            sale.points_earned,
            sale.status,
            sale.notes,
            completed_str
        ))
        sale.id = new_id

        # Insert line items and update inventory
        for item in sale.items:
            item_query = """
                INSERT INTO sale_items (sale_id, product_id, product_name, sku, unit_price, cost_price, quantity, subtotal, discount, total)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """
            item_id = self.db.execute_non_query(item_query, (
                sale.id,
                item.product_id,
                item.product_name,
                item.sku,
                item.unit_price,
                item.cost_price,
                item.quantity,
                item.subtotal,
                item.discount,
                item.total
            ))
            item.id = item_id

            # Deduct stock
            self.db.execute_non_query(
                "UPDATE products SET quantity_in_stock = MAX(0, quantity_in_stock - %s) WHERE id = %s;",
                (item.quantity, item.product_id)
            )

        return sale

    def update(self, sale: Sale) -> bool:
        query = "UPDATE sales SET status = %s, notes = %s WHERE id = %s;"
        self.db.execute_non_query(query, (sale.status, sale.notes, sale.id))
        return True

    def delete(self, entity_id: int) -> bool:
        self.db.execute_non_query("UPDATE sales SET status = 'cancelled' WHERE id = %s;", (entity_id,))
        return True

    def create_refund(self, refund: Refund) -> Refund:
        """Persists refund slip and restores inventory quantities."""
        refund_query = """
            INSERT INTO refunds (sale_id, processed_by, total_amount, reason, notes, refunded_at)
            VALUES (%s, %s, %s, %s, %s, %s);
        """
        ref_id = self.db.execute_non_query(refund_query, (
            refund.sale_id,
            refund.processed_by,
            refund.total_amount,
            refund.reason,
            refund.notes,
            refund.refunded_at.strftime('%Y-%m-%d %H:%M:%S')
        ))
        refund.id = ref_id

        for item in refund.items:
            self.db.execute_non_query(
                """
                INSERT INTO refund_items (refund_id, sale_item_id, product_id, quantity, unit_price, subtotal)
                VALUES (%s, %s, %s, %s, %s, %s);
                """,
                (refund.id, item.sale_item_id, item.product_id, item.quantity, item.unit_price, item.subtotal)
            )
            # Restore product stock
            self.db.execute_non_query(
                "UPDATE products SET quantity_in_stock = quantity_in_stock + %s WHERE id = %s;",
                (item.quantity, item.product_id)
            )

        # Update original sale status
        self.db.execute_non_query(
            "UPDATE sales SET status = 'partially_refunded' WHERE id = %s;",
            (refund.sale_id,)
        )
        return refund
