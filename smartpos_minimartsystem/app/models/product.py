"""
Product Domain Model and Stock Adjustment Entities
Encapsulates inventory items, pricing margins, and shrinkage tracking.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Any, Optional
from .base import BaseModel, Money


@dataclass
class StockAdjustment:
    """Value object recording an audit log entry for inventory quantity change."""
    product_id: int
    user_id: int
    change_quantity: int
    previous_quantity: int
    new_quantity: int
    reason: str
    notes: str = ''
    created_at: Optional[datetime] = None


class Product(BaseModel):
    """Represents a sellable catalog item in the mini-mart inventory."""
    
    def __init__(
        self,
        id: Optional[int],
        name: str,
        sku: str,
        barcode: str,
        category_id: int,
        price: float,
        cost_price: float = 0.0,
        quantity_in_stock: int = 0,
        low_stock_threshold: int = 10,
        supplier_id: Optional[int] = None,
        unit: str = 'piece',
        image_url: Optional[str] = None,
        is_active: bool = True,
        category_name: str = '',
        created_at: Optional[datetime] = None
    ):
        super().__init__(id, created_at)
        if not name:
            raise ValueError("Product name cannot be empty.")
        if not sku:
            raise ValueError("Product SKU cannot be empty.")
        if not barcode:
            raise ValueError("Product barcode cannot be empty.")
        if price < 0:
            raise ValueError("Selling price cannot be negative.")
        if cost_price < 0:
            raise ValueError("Cost price cannot be negative.")

        self.name = name.strip()
        self.sku = sku.strip().upper()
        self.barcode = barcode.strip()
        self.category_id = category_id
        self._price = round(float(price), 2)
        self._cost_price = round(float(cost_price), 2)
        self._quantity_in_stock = max(0, int(quantity_in_stock))
        self.low_stock_threshold = max(0, int(low_stock_threshold))
        self.supplier_id = supplier_id
        self.unit = unit or 'piece'
        self.image_url = image_url
        self.is_active = is_active
        self.category_name = category_name

    @property
    def price(self) -> float:
        """Selling price in USD."""
        return self._price

    @price.setter
    def price(self, val: float) -> None:
        if val < 0:
            raise ValueError("Price cannot be negative.")
        self._price = round(float(val), 2)

    @property
    def cost_price(self) -> float:
        """Wholesale unit cost price in USD."""
        return self._cost_price

    @cost_price.setter
    def cost_price(self, val: float) -> None:
        if val < 0:
            raise ValueError("Cost price cannot be negative.")
        self._cost_price = round(float(val), 2)

    @property
    def quantity_in_stock(self) -> int:
        """Current on-hand inventory count."""
        return self._quantity_in_stock

    @quantity_in_stock.setter
    def quantity_in_stock(self, val: int) -> None:
        self._quantity_in_stock = max(0, int(val))

    @property
    def is_low_stock(self) -> bool:
        """Returns True if current quantity is at or below the low stock threshold."""
        return self.quantity_in_stock <= self.low_stock_threshold

    @property
    def profit_margin_amount(self) -> float:
        """Gross profit margin amount per unit in USD."""
        return round(self.price - self.cost_price, 2)

    @property
    def profit_margin_percent(self) -> float:
        """Gross profit margin percentage."""
        if self.price <= 0:
            return 0.0
        return round(((self.price - self.cost_price) / self.price) * 100.0, 1)

    def price_khr(self, exchange_rate: float = 4100.0) -> int:
        """Calculates retail price in Cambodian Riel (KHR)."""
        return Money.from_float(self.price).to_khr(exchange_rate)

    def adjust_stock(self, change: int, reason: str, user_id: int) -> StockAdjustment:
        """
        Adjusts inventory quantity and yields an audit log record.
        Protects from negative inventory.
        """
        prev_qty = self._quantity_in_stock
        new_qty = max(0, prev_qty + change)
        self._quantity_in_stock = new_qty
        
        return StockAdjustment(
            product_id=self.id or 0,
            user_id=user_id,
            change_quantity=change,
            previous_quantity=prev_qty,
            new_quantity=new_qty,
            reason=reason,
            created_at=datetime.now()
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'sku': self.sku,
            'barcode': self.barcode,
            'category_id': self.category_id,
            'category_name': self.category_name,
            'price': self.price,
            'cost_price': self.cost_price,
            'quantity_in_stock': self.quantity_in_stock,
            'low_stock_threshold': self.low_stock_threshold,
            'is_low_stock': self.is_low_stock,
            'profit_margin_amount': self.profit_margin_amount,
            'profit_margin_percent': self.profit_margin_percent,
            'unit': self.unit,
            'image_url': self.image_url,
            'is_active': self.is_active
        }
