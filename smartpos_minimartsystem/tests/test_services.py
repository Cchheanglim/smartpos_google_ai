"""
Integration Tests for Services and Business Rules
"""

import unittest
from app.services.checkout_service import CheckoutService
from app.repositories.product_repository import ProductRepository
from app.repositories.sale_repository import SaleRepository
from app.repositories.category_repository import CustomerRepository
from app.models.product import Product
from app.models.customer import Customer


class TestCheckoutService(unittest.TestCase):

    def setUp(self):
        self.checkout_service = CheckoutService()

    def test_calculate_cart_dual_currency(self):
        items_payload = [{'product_id': 1, 'quantity': 2}]
        calc = self.checkout_service.calculate_cart(
            items_payload=items_payload,
            cart_discount_percent=0.0,
            tax_percent=10.0,
            exchange_rate=4100.0
        )
        self.assertIn('total_usd', calc)
        self.assertIn('total_khr', calc)
        self.assertGreater(calc['total_usd'], 0)
        self.assertGreater(calc['total_khr'], 0)


if __name__ == '__main__':
    unittest.main()
