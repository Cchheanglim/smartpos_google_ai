"""
ProductService — business rules for the Products/Inventory vertical slice.

    Route (product_routes.py)
      -> ProductService            (this file: rules + orchestration)
         -> ProductRepository      (SQL for products)
         -> StockMovementRepository(SQL for the stock ledger)
         -> Category/SupplierRepository (dropdown data)
      -> Jinja2 template (templates/inventory/products_*.html)

Invalid input raises ValueError; a missing product raises NotFoundError.
"""
import math
from dataclasses import dataclass, field
from typing import Callable, ContextManager

from werkzeug.datastructures import FileStorage

from app.extensions import transaction
from app.forms.inventory_forms import ProductInput, StockAdjustmentInput
from app.models.inventory.category import Category
from app.models.inventory.product import Product
from app.models.inventory.stock_movement import MovementReason, StockMovement
from app.models.inventory.supplier import Supplier
from app.repositories.inventory.category_repository import CategoryRepository
from app.repositories.inventory.product_repository import ProductFilter, ProductRepository
from app.repositories.inventory.stock_movement_repository import StockMovementRepository
from app.repositories.inventory.supplier_repository import SupplierRepository
from app.services.errors import NotFoundError
from app.services.notifications.telegram_service import TelegramService
from app.utils.file_storage import ImageStorage


@dataclass
class ProductListPage:
    """Everything the product list template needs, built in one call."""

    products: list[Product]
    filter: ProductFilter
    total: int
    categories: list[Category]
    suppliers: list[Supplier]
    totals: dict = field(default_factory=dict)

    @property
    def pages(self) -> int:
        return max(math.ceil(self.total / self.filter.per_page), 1)


@dataclass
class ProductFormPage:
    product: Product | None
    categories: list[Category]
    suppliers: list[Supplier]
    suggested_sku: str


@dataclass
class ProductDetailPage:
    product: Product
    movements: list[StockMovement]
    reasons: list[MovementReason]


class ProductService:
    MAX_ADJUSTMENT = 10_000

    def __init__(self, product_repo: ProductRepository | None = None,
                 category_repo: CategoryRepository | None = None,
                 supplier_repo: SupplierRepository | None = None,
                 stock_repo: StockMovementRepository | None = None,
                 image_storage: ImageStorage | None = None,
                 telegram: TelegramService | None = None,
                 tx: Callable[[], ContextManager] = transaction) -> None:
        # Composition: the service is built from repositories + helpers.
        self.product_repo = product_repo or ProductRepository()
        self.category_repo = category_repo or CategoryRepository()
        self.supplier_repo = supplier_repo or SupplierRepository()
        self.stock_repo = stock_repo or StockMovementRepository()
        self.image_storage = image_storage or ImageStorage("PRODUCT_UPLOAD_FOLDER")
        self.telegram = telegram or TelegramService()
        self.tx = tx

    # ---------------- read ----------------
    def list_page(self, product_filter: ProductFilter) -> ProductListPage:
        """Search + filter + paginate products for the list page."""
        return ProductListPage(
            products=self.product_repo.search(product_filter),
            filter=product_filter,
            total=self.product_repo.count_matching(product_filter),
            categories=self.category_repo.list_all(),
            suppliers=self.supplier_repo.list_all(),
            totals=self.product_repo.inventory_totals(),
        )

    def form_page(self, product_id: int | None = None) -> ProductFormPage:
        product = self.get_product(product_id) if product_id is not None else None
        return ProductFormPage(
            product=product,
            categories=self.category_repo.list_all(),
            suppliers=self.supplier_repo.list_all(),
            suggested_sku=self.next_sku(),
        )

    def detail_page(self, product_id: int) -> ProductDetailPage:
        return ProductDetailPage(
            product=self.get_product(product_id),
            movements=self.stock_repo.list_for_product(product_id),
            reasons=MovementReason.manual_choices(),
        )

    def get_product(self, product_id: int) -> Product:
        product = self.product_repo.find_by_id(product_id)
        if product is None:
            raise NotFoundError("Product not found.")
        return product

    def next_sku(self) -> str:
        return f"PRD-{self.product_repo.max_sku_number() + 1:03d}"

    # ---------------- write ----------------
    def create_product(self, data: ProductInput, image: FileStorage | None = None,
                       user_id: int | None = None, user_name: str = "") -> Product:
        product = Product(
            id=None, sku=data.sku or self.next_sku(), barcode=data.barcode or None,
            name=data.name, price=data.price, cost=data.cost,
            quantity_in_stock=data.quantity_in_stock, low_stock_threshold=data.low_stock_threshold,
            category_id=data.category_id, supplier_id=data.supplier_id,
        )
        self._check_rules(product)
        product.image_filename = self.image_storage.save(image)
        with self.tx():
            product.id = self.product_repo.create(product)
            if product.quantity_in_stock > 0:
                self.stock_repo.create(product.id, product.quantity_in_stock,
                                       MovementReason.INITIAL.value, "Opening stock", user_id)
        self.telegram.notify_product_added(product.name, product.sku, product.quantity_in_stock,
                                           user_name or "Unknown")
        if product.is_low_stock:
            self.telegram.notify_low_stock(product.name, product.quantity_in_stock, product.low_stock_threshold)
        return product

    def update_product(self, product_id: int, data: ProductInput,
                       image: FileStorage | None = None) -> Product:
        product = self.get_product(product_id)
        product.sku = data.sku or product.sku
        product.barcode = data.barcode or None
        product.name, product.price, product.cost = data.name, data.price, data.cost
        product.low_stock_threshold = data.low_stock_threshold
        product.category_id, product.supplier_id = data.category_id, data.supplier_id
        product.__post_init__()           # re-normalise money fields
        self._check_rules(product)
        new_image = self.image_storage.save(image)
        if new_image:
            product.image_filename = new_image
        self.product_repo.update(product)
        return product

    def delete_product(self, product_id: int) -> Product:
        product = self.get_product(product_id)
        if self.product_repo.has_sales(product_id):
            raise ValueError(f"'{product.name}' appears in past sales and cannot be deleted. "
                             "Set its stock to 0 instead to retire it.")
        self.product_repo.delete(product_id)
        return product

    def adjust_stock(self, product_id: int, data: StockAdjustmentInput, user_id: int,
                     user_name: str = "") -> Product:
        """Manual stock in/out. Always writes a ledger row in the same transaction."""
        product = self.get_product(product_id)
        if data.quantity <= 0:
            raise ValueError("Quantity must be at least 1.")
        if data.quantity > self.MAX_ADJUSTMENT:
            raise ValueError(f"Quantity cannot exceed {self.MAX_ADJUSTMENT:,} in one adjustment.")
        try:
            reason = MovementReason(data.reason)
        except ValueError:
            raise ValueError("Please choose a valid reason.") from None
        if reason not in MovementReason.manual_choices():
            raise ValueError("Please choose a valid reason.")
        reason.check_change(data.signed_change)     # e.g. breakage can only remove stock

        change = data.signed_change
        with self.tx():
            if self.product_repo.adjust_stock(product_id, change) == 0:
                raise ValueError(f"Only {product.quantity_in_stock} in stock — cannot remove {data.quantity}.")
            self.stock_repo.create(product_id, change, reason.value, data.note, user_id)
        product.quantity_in_stock += change
        if reason is MovementReason.RESTOCK:
            self.telegram.notify_restock(product.name, change, product.quantity_in_stock, user_name or "Unknown")
        if product.is_low_stock:
            self.telegram.notify_low_stock(product.name, product.quantity_in_stock, product.low_stock_threshold,
                                           product.supplier_name or "")
        return product

    def movements_page(self, reason: str = "") -> dict:
        """Stock ledger for waste auditing, optionally filtered by reason code."""
        valid = {r.value for r in MovementReason}
        reason = reason if reason in valid else ""
        return {"movements": self.stock_repo.list_filtered(reason=reason, limit=200),
                "reasons": list(MovementReason), "reason": reason}

    def barcode_sheet(self, product_ids: list[int]) -> list[Product]:
        """Products for the printable label sheet (all products when none are chosen)."""
        return self.product_repo.find_many(product_ids) if product_ids else self.product_repo.list_for_export()

    # ---------------- rules ----------------
    def _check_rules(self, product: Product) -> None:
        product.validate()
        if product.cost > product.price:
            raise ValueError("Cost price cannot be higher than the selling price.")
        clash = self.product_repo.find_by_sku(product.sku)
        if clash and clash.id != product.id:
            raise ValueError(f"SKU {product.sku} is already used by '{clash.name}'.")
        if product.barcode:
            clash = self.product_repo.find_by_barcode(product.barcode)
            if clash and clash.id != product.id:
                raise ValueError(f"Barcode {product.barcode} is already used by '{clash.name}'.")
        if product.category_id and self.category_repo.find_by_id(product.category_id) is None:
            raise ValueError("Selected category does not exist.")
        if product.supplier_id and self.supplier_repo.find_by_id(product.supplier_id) is None:
            raise ValueError("Selected supplier does not exist.")
