"""
Unit Tests for SmartPOS Domain Models
"""

import unittest
from datetime import datetime
from app.models.base import Money
from app.models.user import User
from app.models.role import Role, Permission
from app.models.product import Product
from app.models.customer import Customer, CustomerTier
from app.models.sale import Sale, SaleItem, PaymentDetail


class TestDomainModels(unittest.TestCase):

    def test_money_value_object(self):
        m1 = Money(10.50, 'USD')
        m2 = Money(5.25, 'USD')
        sum_m = m1 + m2
        self.assertEqual(sum_m.amount, 15.75)
        self.assertEqual(sum_m.to_khr(4100), 64600)

    def test_user_permissions(self):
        user = User(
            id=1,
            name="Test Cashier",
            email="cashier@test.com",
            role_id=2,
            role_name="cashier",
            permissions=["process_sale", "view_products"]
        )
        self.assertTrue(user.has_permission("process_sale"))
        self.assertTrue(user.has_permission("view_products"))
        self.assertFalse(user.has_permission("manage_users"))

    def test_customer_tier_progression(self):
        cust = Customer(id=1, name="John Doe", phone="012999000", total_spent=50.0)
        self.assertEqual(cust.tier, CustomerTier.BRONZE)
        self.assertEqual(cust.discount_rate, 0.0)

        # Spend passes $200 threshold
        cust.add_spend(200.0)
        self.assertEqual(cust.tier, CustomerTier.SILVER)
        self.assertEqual(cust.discount_rate, 3.0)

        # Spend passes $500 threshold
        cust.add_spend(300.0)
        self.assertEqual(cust.tier, CustomerTier.GOLD)
        self.assertEqual(cust.discount_rate, 5.0)

    def test_product_low_stock(self):
        prod = Product(
            id=1,
            name="Mineral Water",
            sku="WAT-01",
            barcode="123456789",
            category_id=1,
            price=0.50,
            cost_price=0.25,
            quantity_in_stock=5,
            low_stock_threshold=10
        )
        self.assertTrue(prod.is_low_stock)
        self.assertEqual(prod.gross_margin_percent, 50.0)


if __name__ == '__main__':
    unittest.main()
