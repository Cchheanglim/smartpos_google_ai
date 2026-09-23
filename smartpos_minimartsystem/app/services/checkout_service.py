"""
Checkout and Point of Sale Service
Handles shopping cart reconciliation, dual-currency tenders, stock checks, and CRM points.
"""

import random
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from ..models.sale import Sale, SaleItem, PaymentDetail
from ..models.product import Product
from ..models.customer import Customer
from ..repositories.sale_repository import SaleRepository
from ..repositories.product_repository import ProductRepository
from ..repositories.category_repository import CustomerRepository


class CheckoutService:
    """Coordinates checkout calculation and atomic sale completion."""

    def __init__(
        self,
        sale_repo: Optional[SaleRepository] = None,
        product_repo: Optional[ProductRepository] = None,
        customer_repo: Optional[CustomerRepository] = None
    ):
        self.sale_repo = sale_repo or SaleRepository()
        self.product_repo = product_repo or ProductRepository()
        self.customer_repo = customer_repo or CustomerRepository()

    def generate_transaction_code(self) -> str:
        """Generates a human-friendly unique transaction receipt code."""
        timestamp = datetime.now().strftime('%Y%m%d%H%M')
        random_suffix = random.randint(100, 999)
        return f"TXN-{timestamp}-{random_suffix}"

    def calculate_cart(
        self,
        items_payload: List[Dict[str, Any]],
        cart_discount_percent: float = 0.0,
        tax_percent: float = 10.0,
        customer_id: Optional[int] = None,
        points_to_redeem: int = 0,
        exchange_rate: float = 4100.0
    ) -> Dict[str, Any]:
        """Performs precise calculations for the active checkout register."""
        subtotal = 0.0
        line_items = []

        for item in items_payload:
            product = self.product_repo.get_by_id(int(item['product_id']))
            if not product:
                continue
            qty = max(1, int(item.get('quantity', 1)))
            unit_price = float(product.price)
            cost_price = float(product.cost_price)
            line_subtotal = round(unit_price * qty, 2)
            subtotal += line_subtotal

            line_items.append({
                'product_id': product.id,
                'product_name': product.name,
                'sku': product.sku,
                'unit_price': unit_price,
                'cost_price': cost_price,
                'quantity': qty,
                'subtotal': line_subtotal,
                'discount': 0.0,
                'total': line_subtotal
            })

        subtotal = round(subtotal, 2)

        # Calculate customer tier discount if enrolled
        customer_discount_rate = 0.0
        customer = None
        if customer_id:
            customer = self.customer_repo.get_by_id(customer_id)
            if customer:
                customer_discount_rate = customer.discount_rate

        # Highest discount applies (custom manual discount or customer loyalty tier)
        effective_discount_pct = max(float(cart_discount_percent), customer_discount_rate)
        discount_amount = round(subtotal * (effective_discount_pct / 100.0), 2)
        taxable_amount = max(0.0, round(subtotal - discount_amount, 2))

        # Points discount ($0.01 per point)
        points_discount = 0.0
        if customer and points_to_redeem > 0:
            max_redeemable = min(customer.points, points_to_redeem)
            points_discount = round(max_redeemable * 0.01, 2)
            taxable_amount = max(0.0, round(taxable_amount - points_discount, 2))

        # Tax calculation
        tax_amount = round(taxable_amount * (float(tax_percent) / 100.0), 2)
        total_usd = round(taxable_amount + tax_amount, 2)

        # Dual currency KHR conversion
        total_khr = int(round((total_usd * exchange_rate) / 100.0) * 100)

        # Points to be earned (1 point per whole $1 spent)
        points_earned = int(total_usd)

        return {
            'subtotal': subtotal,
            'discount_percent': effective_discount_pct,
            'discount_amount': discount_amount,
            'points_redeemed': points_to_redeem if customer else 0,
            'points_discount_usd': points_discount,
            'tax_percent': tax_percent,
            'tax_amount': tax_amount,
            'total_usd': total_usd,
            'total_khr': total_khr,
            'exchange_rate': exchange_rate,
            'points_earned': points_earned,
            'line_items': line_items,
            'customer': customer.to_dict() if customer else None
        }

    def process_checkout(
        self,
        cashier_id: int,
        items_payload: List[Dict[str, Any]],
        payment_payload: Dict[str, Any],
        customer_id: Optional[int] = None,
        discount_percent: float = 0.0,
        tax_percent: float = 10.0,
        points_to_redeem: int = 0,
        notes: str = ''
    ) -> Tuple[Optional[Sale], Optional[str]]:
        """
        Validates inventory stock and tender amounts, then persists the sale.
        """
        if not items_payload:
            return None, "Shopping cart is empty."

        # Stock availability check
        for item in items_payload:
            p_id = int(item['product_id'])
            qty = max(1, int(item.get('quantity', 1)))
            product = self.product_repo.get_by_id(p_id)
            if not product:
                return None, f"Product ID {p_id} not found."
            if product.quantity_in_stock < qty:
                return None, f"Insufficient stock for '{product.name}'. Available: {product.quantity_in_stock}, Requested: {qty}"

        exchange_rate = float(payment_payload.get('exchange_rate', 4100.0))
        calc = self.calculate_cart(
            items_payload=items_payload,
            cart_discount_percent=discount_percent,
            tax_percent=tax_percent,
            customer_id=customer_id,
            points_to_redeem=points_to_redeem,
            exchange_rate=exchange_rate
        )

        total_amount = calc['total_usd']

        # Tender validation
        method = payment_payload.get('method', 'Cash')
        paid_usd = float(payment_payload.get('amount_paid_usd', 0.0))
        paid_khr = float(payment_payload.get('amount_paid_khr', 0.0))

        # Total paid equivalent in USD
        total_paid_usd = paid_usd + (paid_khr / exchange_rate)

        # For Card and KHQR, assume exact payment
        if method in ('Card', 'KHQR'):
            paid_usd = total_amount
            paid_khr = 0.0
            change_usd = 0.0
            change_khr = 0.0
        else:
            if total_paid_usd < (total_amount - 0.009):
                return None, f"Tender amount insufficient. Total due: ${total_amount:.2f}, Paid: ${total_paid_usd:.2f}"
            change_total_usd = max(0.0, total_paid_usd - total_amount)
            # Break down change into USD whole notes and KHR fractional change
            change_usd = float(int(change_total_usd))
            fractional_change = change_total_usd - change_usd
            change_khr = float(int(round((fractional_change * exchange_rate) / 100.0) * 100))

        payment = PaymentDetail(
            method=method,
            currency_mode=payment_payload.get('currency_mode', 'usd'),
            exchange_rate=exchange_rate,
            amount_paid_usd=round(paid_usd, 2),
            amount_paid_khr=round(paid_khr, 2),
            change_usd=round(change_usd, 2),
            change_khr=round(change_khr, 2)
        )

        sale_items = [
            SaleItem(
                product_id=li['product_id'],
                product_name=li['product_name'],
                sku=li['sku'],
                unit_price=li['unit_price'],
                cost_price=li['cost_price'],
                quantity=li['quantity'],
                discount=li['discount'],
                id=None
            )
            for li in calc['line_items']
        ]

        sale = Sale(
            id=None,
            transaction_code=self.generate_transaction_code(),
            cashier_id=cashier_id,
            customer_id=customer_id,
            subtotal=calc['subtotal'],
            discount_percent=calc['discount_percent'],
            discount_amount=calc['discount_amount'],
            tax_percent=calc['tax_percent'],
            tax_amount=calc['tax_amount'],
            total_amount=calc['total_usd'],
            payment=payment,
            items=sale_items,
            points_redeemed=calc['points_redeemed'],
            points_discount_usd=calc['points_discount_usd'],
            points_earned=calc['points_earned'],
            status='completed',
            notes=notes
        )

        # Persist sale (deducts product stock)
        saved_sale = self.sale_repo.create(sale)

        # Update customer loyalty points and spend
        if customer_id:
            customer = self.customer_repo.get_by_id(customer_id)
            if customer:
                if calc['points_redeemed'] > 0:
                    customer.redeem_points(calc['points_redeemed'])
                customer.add_spend(saved_sale.total_amount)
                self.customer_repo.update(customer)

        return saved_sale, None
