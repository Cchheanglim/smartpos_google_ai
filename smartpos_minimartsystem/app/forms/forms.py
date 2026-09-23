"""
Form and Validation Helpers
Provides structured validation for web requests and form submissions.
"""

from typing import Dict, Any, List, Optional


class ValidationResult:
    """Encapsulates validation success or errors."""
    def __init__(self, is_valid: bool, errors: Optional[Dict[str, str]] = None):
        self.is_valid = is_valid
        self.errors = errors or {}

    def get_error(self, field: str) -> Optional[str]:
        return self.errors.get(field)


class LoginFormValidator:
    """Validates login credentials submission."""
    @staticmethod
    def validate(data: Dict[str, Any]) -> ValidationResult:
        errors = {}
        email = data.get('email', '').strip()
        password = data.get('password', '').strip()

        if not email:
            errors['email'] = "Email address is required."
        elif '@' not in email:
            errors['email'] = "Please enter a valid email address."

        if not password:
            errors['password'] = "Password is required."

        return ValidationResult(len(errors) == 0, errors)


class ProductFormValidator:
    """Validates new or edited product catalog data."""
    @staticmethod
    def validate(data: Dict[str, Any]) -> ValidationResult:
        errors = {}
        if not data.get('name', '').strip():
            errors['name'] = "Product name is required."
        if not data.get('sku', '').strip():
            errors['sku'] = "SKU is required."
        if not data.get('barcode', '').strip():
            errors['barcode'] = "Barcode is required."

        try:
            price = float(data.get('price', 0.0))
            if price < 0:
                errors['price'] = "Price cannot be negative."
        except (ValueError, TypeError):
            errors['price'] = "Invalid selling price."

        try:
            cost = float(data.get('cost_price', 0.0))
            if cost < 0:
                errors['cost_price'] = "Cost price cannot be negative."
        except (ValueError, TypeError):
            errors['cost_price'] = "Invalid cost price."

        try:
            qty = int(data.get('quantity_in_stock', 0))
            if qty < 0:
                errors['quantity_in_stock'] = "Stock quantity cannot be negative."
        except (ValueError, TypeError):
            errors['quantity_in_stock'] = "Invalid stock quantity."

        return ValidationResult(len(errors) == 0, errors)


class CustomerFormValidator:
    """Validates CRM customer registration."""
    @staticmethod
    def validate(data: Dict[str, Any]) -> ValidationResult:
        errors = {}
        if not data.get('name', '').strip():
            errors['name'] = "Customer name is required."
        phone = data.get('phone', '').strip()
        if not phone:
            errors['phone'] = "Phone number is required."
        elif len(phone) < 6:
            errors['phone'] = "Phone number must be at least 6 digits."

        return ValidationResult(len(errors) == 0, errors)


class StaffFormValidator:
    """Validates staff employee profiles."""
    @staticmethod
    def validate(data: Dict[str, Any], is_new: bool = True) -> ValidationResult:
        errors = {}
        if not data.get('name', '').strip():
            errors['name'] = "Staff name is required."
        email = data.get('email', '').strip()
        if not email or '@' not in email:
            errors['email'] = "Valid email is required."

        if is_new:
            password = data.get('password', '').strip()
            if not password or len(password) < 6:
                errors['password'] = "Password must be at least 6 characters."

        return ValidationResult(len(errors) == 0, errors)
