"""
Sale, SaleItem, Payment Details, and Refund Domain Entities
Encapsulates transaction aggregation, checkout calculations, and refunds.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Any, Optional
from .base import BaseModel, Money


@dataclass
class SaleItem:
    """Represents a single purchased line item within a sale."""
    product_id: int
    product_name: str
    sku: str
    unit_price: float
    cost_price: float
    quantity: int
    discount: float = 0.0
    id: Optional[int] = None

    @property
    def subtotal(self) -> float:
        """Line subtotal before discount."""
        return round(self.unit_price * self.quantity, 2)

    @property
    def total(self) -> float:
        """Line total after line discount."""
        return max(0.0, round(self.subtotal - self.discount, 2))

    @property
    def total_cost(self) -> float:
        """Total wholesale cost of this line."""
        return round(self.cost_price * self.quantity, 2)

    @property
    def profit(self) -> float:
        """Net profit contribution of this line."""
        return round(self.total - self.total_cost, 2)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'product_id': self.product_id,
            'product_name': self.product_name,
            'sku': self.sku,
            'unit_price': self.unit_price,
            'cost_price': self.cost_price,
            'quantity': self.quantity,
            'subtotal': self.subtotal,
            'discount': self.discount,
            'total': self.total,
            'profit': self.profit
        }


@dataclass
class PaymentDetail:
    """Value object capturing multi-currency and tender breakdown."""
    method: str = 'Cash'                      # Cash, Card, KHQR, Split
    currency_mode: str = 'usd'                # usd, khr, mixed
    exchange_rate: float = 4100.0
    amount_paid_usd: float = 0.0
    amount_paid_khr: float = 0.0
    change_usd: float = 0.0
    change_khr: float = 0.0


class Sale(BaseModel):
    """Aggregate Root representing a completed point-of-sale checkout order."""
    
    def __init__(
        self,
        id: Optional[int],
        transaction_code: str,
        cashier_id: int,
        customer_id: Optional[int] = None,
        subtotal: float = 0.0,
        discount_percent: float = 0.0,
        discount_amount: float = 0.0,
        tax_percent: float = 0.0,
        tax_amount: float = 0.0,
        total_amount: float = 0.0,
        payment: Optional[PaymentDetail] = None,
        items: Optional[List[SaleItem]] = None,
        points_redeemed: int = 0,
        points_discount_usd: float = 0.0,
        points_earned: int = 0,
        status: str = 'completed',
        notes: str = '',
        cashier_name: str = '',
        customer_name: str = '',
        completed_at: Optional[datetime] = None
    ):
        super().__init__(id, completed_at)
        self.transaction_code = transaction_code
        self.cashier_id = cashier_id
        self.customer_id = customer_id
        self.subtotal = round(float(subtotal), 2)
        self.discount_percent = float(discount_percent)
        self.discount_amount = round(float(discount_amount), 2)
        self.tax_percent = float(tax_percent)
        self.tax_amount = round(float(tax_amount), 2)
        self.total_amount = round(float(total_amount), 2)
        self.payment = payment or PaymentDetail()
        self.items: List[SaleItem] = items or []
        self.points_redeemed = int(points_redeemed)
        self.points_discount_usd = round(float(points_discount_usd), 2)
        self.points_earned = int(points_earned)
        self.status = status
        self.notes = notes
        self.cashier_name = cashier_name
        self.customer_name = customer_name
        self.completed_at = completed_at or datetime.now()

    @property
    def total_cost(self) -> float:
        """Calculates total wholesale cost of goods sold (COGS)."""
        return round(sum(item.total_cost for item in self.items), 2)

    @property
    def net_profit(self) -> float:
        """Calculates gross profit revenue minus COGS."""
        return round(self.total_amount - self.total_cost, 2)

    @property
    def total_khr(self) -> int:
        """Calculates total in Cambodian Riel."""
        return Money.from_float(self.total_amount).to_khr(self.payment.exchange_rate)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'transaction_code': self.transaction_code,
            'cashier_id': self.cashier_id,
            'cashier_name': self.cashier_name,
            'customer_id': self.customer_id,
            'customer_name': self.customer_name,
            'subtotal': self.subtotal,
            'discount_percent': self.discount_percent,
            'discount_amount': self.discount_amount,
            'tax_percent': self.tax_percent,
            'tax_amount': self.tax_amount,
            'total_amount': self.total_amount,
            'total_khr': self.total_khr,
            'payment_method': self.payment.method,
            'currency_mode': self.payment.currency_mode,
            'exchange_rate': self.payment.exchange_rate,
            'amount_paid_usd': self.payment.amount_paid_usd,
            'amount_paid_khr': self.payment.amount_paid_khr,
            'change_usd': self.payment.change_usd,
            'change_khr': self.payment.change_khr,
            'points_redeemed': self.points_redeemed,
            'points_discount_usd': self.points_discount_usd,
            'points_earned': self.points_earned,
            'status': self.status,
            'notes': self.notes,
            'completed_at': self.completed_at.strftime('%Y-%m-%d %H:%M:%S') if self.completed_at else '',
            'items': [item.to_dict() for item in self.items]
        }


@dataclass
class RefundItem:
    """Individual item within a refund."""
    sale_item_id: int
    product_id: int
    quantity: int
    unit_price: float
    subtotal: float
    id: Optional[int] = None


class Refund(BaseModel):
    """Represents an authorized customer return and refund slip."""
    
    def __init__(
        self,
        id: Optional[int],
        sale_id: int,
        processed_by: int,
        total_amount: float,
        reason: str,
        notes: str = '',
        items: Optional[List[RefundItem]] = None,
        processor_name: str = '',
        refunded_at: Optional[datetime] = None
    ):
        super().__init__(id, refunded_at)
        self.sale_id = sale_id
        self.processed_by = processed_by
        self.total_amount = round(float(total_amount), 2)
        self.reason = reason
        self.notes = notes
        self.items = items or []
        self.processor_name = processor_name
        self.refunded_at = refunded_at or datetime.now()

    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'sale_id': self.sale_id,
            'processed_by': self.processed_by,
            'processor_name': self.processor_name,
            'total_amount': self.total_amount,
            'reason': self.reason,
            'notes': self.notes,
            'refunded_at': self.refunded_at.strftime('%Y-%m-%d %H:%M:%S') if self.refunded_at else '',
            'items': [
                {
                    'id': item.id,
                    'sale_item_id': item.sale_item_id,
                    'product_id': item.product_id,
                    'quantity': item.quantity,
                    'unit_price': item.unit_price,
                    'subtotal': item.subtotal
                }
                for item in self.items
            ]
        }
