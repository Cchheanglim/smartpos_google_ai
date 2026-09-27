"""Data access for the products table (Inventory vertical slice)."""
from dataclasses import dataclass
from typing import Any, Mapping

from app.models.inventory.product import Product
from app.repositories.base_repository import BaseRepository


@dataclass(frozen=True)
class ProductFilter:
    """Search / filter criteria coming from the product list page."""

    search: str = ""
    category_id: int | None = None
    supplier_id: int | None = None
    stock: str = ""          # "", "low", "out"
    sort: str = "name"       # key into ProductRepository.SORTS
    page: int = 1
    per_page: int = 20


class ProductRepository(BaseRepository[Product]):
    table_name = "products"
    default_order = "p.name"

    # Whitelisted ORDER BY clauses — the user picks a KEY, never raw SQL.
    SORTS = {
        "name": "p.name ASC",
        "price_asc": "p.price ASC",
        "price_desc": "p.price DESC",
        "stock_asc": "p.quantity_in_stock ASC",
        "newest": "p.created_at DESC, p.id DESC",
        "sku": "p.sku ASC",
    }

    def _to_model(self, row: Mapping[str, Any] | None) -> Product | None:
        return Product.from_row(row)

    def _select_sql(self) -> str:
        return ("SELECT p.*, c.name AS category_name, c.icon AS category_icon, s.name AS supplier_name "
                "FROM products p "
                "LEFT JOIN categories c ON c.id = p.category_id "
                "LEFT JOIN suppliers s ON s.id = p.supplier_id")

    def _alias(self) -> str:
        return "p."

    # ---- queries ----
    def _where(self, f: ProductFilter) -> tuple[str, list[Any]]:
        clauses, params = ["1=1"], []
        if f.search:
            clauses.append("(p.name LIKE %s OR p.sku LIKE %s OR p.barcode LIKE %s)")
            like = f"%{f.search}%"
            params += [like, like, like]
        if f.category_id:
            clauses.append("p.category_id = %s")
            params.append(f.category_id)
        if f.supplier_id:
            clauses.append("p.supplier_id = %s")
            params.append(f.supplier_id)
        if f.stock == "low":
            clauses.append("p.quantity_in_stock > 0 AND p.quantity_in_stock <= p.low_stock_threshold")
        elif f.stock == "out":
            clauses.append("p.quantity_in_stock <= 0")
        return " AND ".join(clauses), params

    def search(self, f: ProductFilter) -> list[Product]:
        where, params = self._where(f)
        order = self.SORTS.get(f.sort, self.SORTS["name"])
        offset = max(f.page - 1, 0) * f.per_page
        sql = f"{self._select_sql()} WHERE {where} ORDER BY {order} LIMIT %s OFFSET %s"
        return [self._to_model(r) for r in self._fetch_all(sql, params + [f.per_page, offset])]

    def count_matching(self, f: ProductFilter) -> int:
        where, params = self._where(f)
        row = self._fetch_one(f"SELECT COUNT(*) AS n FROM products p WHERE {where}", params)
        return int(row["n"]) if row else 0

    def find_by_sku(self, sku: str) -> Product | None:
        return self._to_model(self._fetch_one(f"{self._select_sql()} WHERE p.sku = %s", (sku,)))

    def find_by_barcode(self, barcode: str) -> Product | None:
        return self._to_model(self._fetch_one(f"{self._select_sql()} WHERE p.barcode = %s", (barcode,)))

    def find_by_scan_code(self, code: str) -> Product | None:
        """What a scanner or keyboard wedge sends: an EAN barcode or a SKU."""
        return self._to_model(self._fetch_one(
            f"{self._select_sql()} WHERE p.barcode = %s OR p.sku = %s LIMIT 1", (code, code)))

    def list_by_supplier(self, supplier_id: int) -> list[Product]:
        return [self._to_model(r) for r in self._fetch_all(
            f"{self._select_sql()} WHERE p.supplier_id = %s ORDER BY p.name", (supplier_id,))]

    def list_for_export(self) -> list[Product]:
        return [self._to_model(r) for r in self._fetch_all(f"{self._select_sql()} ORDER BY c.name, p.name")]

    def find_many(self, ids: list[int]) -> list[Product]:
        if not ids:
            return []
        placeholders = ", ".join(["%s"] * len(ids))
        rows = self._fetch_all(f"{self._select_sql()} WHERE p.id IN ({placeholders})", list(ids))
        return [self._to_model(r) for r in rows]

    def list_for_pos(self, search: str = "", category_id: int | None = None) -> list[Product]:
        """Products shown on the checkout grid (in-stock first)."""
        f = ProductFilter(search=search, category_id=category_id)
        where, params = self._where(f)
        sql = (f"{self._select_sql()} WHERE {where} "
               "ORDER BY (p.quantity_in_stock > 0) DESC, p.name LIMIT 300")
        return [self._to_model(r) for r in self._fetch_all(sql, params)]

    def list_low_stock(self, limit: int = 10) -> list[Product]:
        sql = (f"{self._select_sql()} WHERE p.quantity_in_stock <= p.low_stock_threshold "
               "ORDER BY p.quantity_in_stock ASC, p.name LIMIT %s")
        return [self._to_model(r) for r in self._fetch_all(sql, (limit,))]

    def inventory_totals(self) -> dict:
        return self._fetch_one(
            "SELECT COUNT(*) AS products, COALESCE(SUM(quantity_in_stock),0) AS units, "
            "COALESCE(SUM(quantity_in_stock * cost),0) AS cost_value, "
            "COALESCE(SUM(quantity_in_stock * price),0) AS retail_value, "
            "COALESCE(SUM(quantity_in_stock > 0 AND quantity_in_stock <= low_stock_threshold),0) AS low_stock, "
            "COALESCE(SUM(quantity_in_stock <= 0),0) AS out_of_stock "
            "FROM products") or {}

    def max_sku_number(self) -> int:
        row = self._fetch_one(
            "SELECT MAX(CAST(SUBSTRING(sku, 5) AS UNSIGNED)) AS n FROM products WHERE sku LIKE 'PRD-%%'")
        return int(row["n"] or 0) if row else 0

    # ---- writes ----
    def create(self, p: Product) -> int:
        return self._execute(
            "INSERT INTO products (sku, barcode, name, category_id, supplier_id, price, cost, "
            "quantity_in_stock, low_stock_threshold, image_filename) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (p.sku, p.barcode, p.name, p.category_id, p.supplier_id, p.price, p.cost,
             p.quantity_in_stock, p.low_stock_threshold, p.image_filename))

    def update(self, p: Product) -> None:
        """Update catalog fields. Stock is NOT changed here — only through
        adjust_stock(), so every change leaves a stock_movements record."""
        self._execute(
            "UPDATE products SET sku=%s, barcode=%s, name=%s, category_id=%s, supplier_id=%s, price=%s, cost=%s, "
            "low_stock_threshold=%s, image_filename=%s WHERE id=%s",
            (p.sku, p.barcode, p.name, p.category_id, p.supplier_id, p.price, p.cost,
             p.low_stock_threshold, p.image_filename, p.id))

    def adjust_stock(self, product_id: int, change: int) -> int:
        """Atomically add/subtract stock; the WHERE clause refuses to go negative.
        Returns affected rows (0 means not enough stock)."""
        return self._execute(
            "UPDATE products SET quantity_in_stock = quantity_in_stock + %s "
            "WHERE id = %s AND quantity_in_stock + %s >= 0",
            (change, product_id, change))

    def has_sales(self, product_id: int) -> bool:
        return self._fetch_one("SELECT 1 AS x FROM sale_items WHERE product_id = %s LIMIT 1",
                               (product_id,)) is not None
