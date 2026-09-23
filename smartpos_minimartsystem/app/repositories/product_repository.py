"""
Product and Inventory Repository
Handles SQL queries for catalog items, stock updates, barcode lookup, and shrinkage audit logs.
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
from .base_repository import BaseRepository
from .db_manager import db_manager
from ..models.product import Product, StockAdjustment


class ProductRepository(BaseRepository[Product]):
    """Data access repository for products catalog and stock."""

    def __init__(self, db=None):
        self.db = db or db_manager

    def _map_row_to_product(self, row: dict) -> Product:
        return Product(
            id=row['id'],
            name=row['name'],
            sku=row['sku'],
            barcode=row['barcode'],
            category_id=row['category_id'],
            price=float(row['price']),
            cost_price=float(row.get('cost_price', 0.0)),
            quantity_in_stock=int(row['quantity_in_stock']),
            low_stock_threshold=int(row.get('low_stock_threshold', 10)),
            supplier_id=row.get('supplier_id'),
            unit=row.get('unit', 'piece'),
            image_url=row.get('image_url'),
            is_active=bool(row.get('is_active', 1)),
            category_name=row.get('category_name', '')
        )

    def get_by_id(self, entity_id: int) -> Optional[Product]:
        query = """
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.id = %s;
        """
        row = self.db.execute_one(query, (entity_id,))
        return self._map_row_to_product(row) if row else None

    def get_by_barcode(self, barcode: str) -> Optional[Product]:
        query = """
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.barcode = %s AND p.is_active = 1;
        """
        row = self.db.execute_one(query, (barcode.strip(),))
        return self._map_row_to_product(row) if row else None

    def get_by_sku(self, sku: str) -> Optional[Product]:
        query = """
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE UPPER(p.sku) = UPPER(%s) AND p.is_active = 1;
        """
        row = self.db.execute_one(query, (sku.strip(),))
        return self._map_row_to_product(row) if row else None

    def get_all(self, only_active: bool = True) -> List[Product]:
        query = """
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
        """
        if only_active:
            query += " WHERE p.is_active = 1"
        query += " ORDER BY p.id ASC;"
        rows = self.db.execute_query(query)
        return [self._map_row_to_product(row) for row in rows]

    def get_low_stock(self) -> List[Product]:
        query = """
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = 1 AND p.quantity_in_stock <= p.low_stock_threshold
            ORDER BY p.quantity_in_stock ASC;
        """
        rows = self.db.execute_query(query)
        return [self._map_row_to_product(row) for row in rows]

    def create(self, product: Product) -> Product:
        query = """
            INSERT INTO products (name, sku, barcode, category_id, supplier_id, price, cost_price, quantity_in_stock, low_stock_threshold, unit, image_url, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """
        new_id = self.db.execute_non_query(query, (
            product.name,
            product.sku,
            product.barcode,
            product.category_id,
            product.supplier_id,
            product.price,
            product.cost_price,
            product.quantity_in_stock,
            product.low_stock_threshold,
            product.unit,
            product.image_url,
            1 if product.is_active else 0
        ))
        product.id = new_id
        return product

    def update(self, product: Product) -> bool:
        query = """
            UPDATE products SET
                name = %s,
                sku = %s,
                barcode = %s,
                category_id = %s,
                supplier_id = %s,
                price = %s,
                cost_price = %s,
                quantity_in_stock = %s,
                low_stock_threshold = %s,
                unit = %s,
                image_url = %s,
                is_active = %s
            WHERE id = %s;
        """
        self.db.execute_non_query(query, (
            product.name,
            product.sku,
            product.barcode,
            product.category_id,
            product.supplier_id,
            product.price,
            product.cost_price,
            product.quantity_in_stock,
            product.low_stock_threshold,
            product.unit,
            product.image_url,
            1 if product.is_active else 0,
            product.id
        ))
        return True

    def delete(self, entity_id: int) -> bool:
        query = "UPDATE products SET is_active = 0 WHERE id = %s;"
        self.db.execute_non_query(query, (entity_id,))
        return True

    def adjust_stock(self, product_id: int, change: int, reason: str, user_id: int, notes: str = '') -> Optional[StockAdjustment]:
        product = self.get_by_id(product_id)
        if not product:
            return None

        prev_qty = product.quantity_in_stock
        new_qty = max(0, prev_qty + change)

        self.db.execute_non_query(
            "UPDATE products SET quantity_in_stock = %s WHERE id = %s;",
            (new_qty, product_id)
        )

        adj_id = self.db.execute_non_query(
            """
            INSERT INTO stock_adjustments (product_id, user_id, change_quantity, previous_quantity, new_quantity, reason, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s);
            """,
            (product_id, user_id, change, prev_qty, new_qty, reason, notes)
        )

        return StockAdjustment(
            product_id=product_id,
            user_id=user_id,
            change_quantity=change,
            previous_quantity=prev_qty,
            new_quantity=new_qty,
            reason=reason,
            notes=notes,
            created_at=datetime.now()
        )

    def get_stock_adjustments(self, limit: int = 50) -> List[Dict[str, Any]]:
        query = """
            SELECT sa.*, p.name as product_name, p.sku, u.name as user_name
            FROM stock_adjustments sa
            JOIN products p ON sa.product_id = p.id
            JOIN users u ON sa.user_id = u.id
            ORDER BY sa.id DESC LIMIT %s;
        """
        return self.db.execute_query(query, (limit,))
