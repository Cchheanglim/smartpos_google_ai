"""Loyalty customer (CRM) business rules."""
from app.forms.sales_forms import CustomerInput
from app.models.auth.user import User
from app.models.sales.customer import Customer, LoyaltyTier
from app.repositories.sales.customer_repository import CustomerRepository
from app.services.auth.auth_service import AuthService
from app.services.errors import NotFoundError


class CustomerService:
    def __init__(self, customer_repo: CustomerRepository | None = None,
                 auth_service: AuthService | None = None) -> None:
        self.customer_repo = customer_repo or CustomerRepository()
        self.auth_service = auth_service or AuthService()

    def list_page(self, term: str = "", tier: str = "") -> dict:
        min_points = LoyaltyTier[tier].min_points if tier in LoyaltyTier.__members__ else None
        customers = self.customer_repo.search(term, min_points)
        if tier in LoyaltyTier.__members__:
            customers = [c for c in customers if c.tier is LoyaltyTier[tier]]
        return {"customers": customers, "tiers": list(LoyaltyTier), "term": term, "tier": tier}

    def get(self, customer_id: int) -> Customer:
        customer = self.customer_repo.find_by_id(customer_id)
        if customer is None:
            raise NotFoundError("Customer not found.")
        return customer

    def form_page(self, customer_id: int | None = None) -> dict:
        return {"customer": self.get(customer_id) if customer_id else None, "tiers": list(LoyaltyTier)}

    def register(self, data: CustomerInput) -> Customer:
        customer = Customer(id=None, phone=data.phone, name=data.name, notes=data.notes)
        customer.validate()
        if self.customer_repo.find_by_phone(customer.phone):
            raise ValueError(f"{customer.phone} is already registered.")
        customer.id = self.customer_repo.create(customer)
        return customer

    def update(self, customer_id: int, data: CustomerInput, user: User) -> Customer:
        customer = self.get(customer_id)
        customer.phone, customer.name, customer.notes = Customer.normalize_phone(data.phone), data.name, data.notes
        if data.points is not None and data.points != customer.points:
            if not self.auth_service.has_permission(user, "adjust_loyalty_points"):
                raise ValueError("You do not have permission to change loyalty points.")
            customer.points = data.points
        customer.validate()
        clash = self.customer_repo.find_by_phone(customer.phone)
        if clash and clash.id != customer.id:
            raise ValueError(f"{customer.phone} is already registered to {clash.name}.")
        self.customer_repo.update(customer)
        return customer

    def delete(self, customer_id: int) -> Customer:
        customer = self.get(customer_id)
        if self.customer_repo.has_sales(customer_id):
            raise ValueError(f"{customer.name} has purchase history and cannot be deleted.")
        self.customer_repo.delete(customer_id)
        return customer
