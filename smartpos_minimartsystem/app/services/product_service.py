"""
Product and Inventory Service
Encapsulates inventory workflows, catalog adjustments, and barcode generation.
"""

from typing import List, Optional, Tuple, Dict, Any
from ..models.product import Product, StockAdjustment
from ..models.category import Category
from ..repositories.product_repository import ProductRepository
from ..repositories.category_repository import CategoryRepository


class ProductService:
    """Coordinates catalog operations and stock adjustments."""

    def __init__(self, product_repo: Optional[ProductRepository] = None, category_repo: Optional[CategoryRepository] = None):
        self.product_repo = product_repo or ProductRepository()
        self.category_repo = category_repo or CategoryRepository()

    def get_catalog(self) -> List[Product]:
        """Returns all active catalog products."""
        return self.product_repo.get_all()

    def get_categories(self) -> List[Category]:
        """Returns all merchandise categories."""
        return self.category_repo.get_all()

    def get_product(self, product_id: int) -> Optional[Product]:
        return self.product_repo.get_by_id(product_id)

    def find_by_barcode_or_sku(self, query: str) -> Optional[Product]:
        """Scans by barcode first, then falls back to SKU."""
        product = self.product_repo.get_by_barcode(query)
        if not product:
            product = self.product_repo.get_by_sku(query)
        return product

    def get_low_stock_items(self) -> List[Product]:
        """Returns products needing replenishment."""
        return self.product_repo.get_low_stock()

    def add_product(self, data: Dict[str, Any]) -> Tuple[Optional[Product], Optional[str]]:
        """Creates a new catalog product with duplicate validation."""
        sku = data.get('sku', '').strip().upper()
        barcode = data.get('barcode', '').strip()

        if self.product_repo.get_by_sku(sku):
            return None, f"A product with SKU '{sku}' already exists."

        if self.product_repo.get_by_barcode(barcode):
            return None, f"A product with barcode '{barcode}' already exists."

        try:
            product = Product(
                id=None,
                name=data['name'],
                sku=sku,
                barcode=barcode,
                category_id=int(data['category_id']),
                price=float(data['price']),
                cost_price=float(data.get('cost_price', 0.0)),
                quantity_in_stock=int(data.get('quantity_in_stock', 0)),
                low_stock_threshold=int(data.get('low_stock_threshold', 10)),
                supplier_id=int(data['supplier_id']) if data.get('supplier_id') else None,
                unit=data.get('unit', 'piece'),
                image_url=data.get('image_url')
            )
            saved_product = self.product_repo.create(product)
            return saved_product, None
        except Exception as ex:
            return None, str(ex)

    def update_product(self, product_id: int, data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Updates product information."""
        product = self.product_repo.get_by_id(product_id)
        if not product:
            return False, "Product not found."

        try:
            product.name = data.get('name', product.name)
            product.category_id = int(data.get('category_id', product.category_id))
            product.price = float(data.get('price', product.price))
            product.cost_price = float(data.get('cost_price', product.cost_price))
            product.quantity_in_stock = int(data.get('quantity_in_stock', product.quantity_in_stock))
            product.low_stock_threshold = int(data.get('low_stock_threshold', product.low_stock_threshold))
            product.unit = data.get('unit', product.unit)
            if data.get('image_url'):
                product.image_url = data['image_url']

            self.product_repo.update(product)
            return True, None
        except Exception as ex:
            return False, str(ex)

    def adjust_stock(self, product_id: int, change: int, reason: str, user_id: int, notes: str = '') -> Tuple[bool, Optional[str]]:
        """Applies manual inventory adjustment with audit trail."""
        adjustment = self.product_repo.adjust_stock(product_id, change, reason, user_id, notes)
        if not adjustment:
            return False, "Failed to adjust inventory for product."
        return True, None

    def get_stock_adjustment_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        return self.product_repo.get_stock_adjustments(limit)
