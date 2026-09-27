"""Supplier directory business rules."""
import re

from app.forms.inventory_forms import SupplierInput
from app.models.inventory.supplier import Supplier
from app.repositories.inventory.supplier_repository import SupplierRepository
from app.services.errors import NotFoundError

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class SupplierService:
    def __init__(self, supplier_repo: SupplierRepository | None = None) -> None:
        self.supplier_repo = supplier_repo or SupplierRepository()

    def list_suppliers(self) -> list[Supplier]:
        return self.supplier_repo.list_all()

    def get(self, supplier_id: int) -> Supplier:
        supplier = self.supplier_repo.find_by_id(supplier_id)
        if supplier is None:
            raise NotFoundError("Supplier not found.")
        return supplier

    def create(self, data: SupplierInput) -> Supplier:
        supplier = Supplier(id=0, **data.__dict__)
        self._check(supplier)
        supplier.id = self.supplier_repo.create(supplier)
        return supplier

    def update(self, supplier_id: int, data: SupplierInput) -> Supplier:
        supplier = self.get(supplier_id)
        for key, value in data.__dict__.items():
            setattr(supplier, key, value)
        self._check(supplier)
        self.supplier_repo.update(supplier)
        return supplier

    def delete(self, supplier_id: int) -> Supplier:
        supplier = self.get(supplier_id)
        if supplier.product_count:
            raise ValueError(f"'{supplier.name}' still supplies {supplier.product_count} product(s).")
        self.supplier_repo.delete(supplier_id)
        return supplier

    def _check(self, supplier: Supplier) -> None:
        if supplier.email and not EMAIL_RE.match(supplier.email):
            raise ValueError("Supplier email address is not valid.")
        clash = self.supplier_repo.find_by_name(supplier.name)
        if clash and clash.id != supplier.id:
            raise ValueError(f"A supplier named '{supplier.name}' already exists.")
