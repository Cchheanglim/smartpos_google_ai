"""Park ("hold") a cart and resume it later."""
from typing import Any

from app.models.auth.user import User
from app.models.sales.held_order import HeldOrder
from app.repositories.sales.held_order_repository import HeldOrderRepository
from app.services.auth.auth_service import AuthService
from app.services.errors import NotFoundError


class HeldOrderService:
    MAX_PER_CASHIER = 10

    def __init__(self, held_repo: HeldOrderRepository | None = None,
                 auth_service: AuthService | None = None) -> None:
        self.held_repo = held_repo or HeldOrderRepository()
        self.auth_service = auth_service or AuthService()

    def hold(self, cashier: User, cart: dict[str, Any], state: dict[str, Any], label: str) -> HeldOrder:
        if len(self.held_repo.list_for(cashier.id)) >= self.MAX_PER_CASHIER:
            raise ValueError(f"You already have {self.MAX_PER_CASHIER} held orders. Resume or delete one first.")
        order = HeldOrder(id=None, cashier_id=cashier.id, cart={"items": cart, "state": state},
                          label=label or state.get("customer_phone") or "Walk-in customer",
                          customer_phone=state.get("customer_phone", ""))
        if not cart:
            raise ValueError("There is nothing in the cart to hold.")
        order.validate()
        order.id = self.held_repo.create(order)
        return order

    def resume(self, cashier: User, held_id: int) -> tuple[dict[str, Any], dict[str, Any], HeldOrder]:
        """Return (cart, state) of the held order and remove it from the list."""
        order = self._get_owned(cashier, held_id)
        self.held_repo.delete(order.id)
        return dict(order.cart.get("items", {})), dict(order.cart.get("state", {})), order

    def discard(self, cashier: User, held_id: int) -> HeldOrder:
        order = self._get_owned(cashier, held_id)
        self.held_repo.delete(order.id)
        return order

    def _get_owned(self, cashier: User, held_id: int) -> HeldOrder:
        order = self.held_repo.find_by_id(held_id)
        if order is None:
            raise NotFoundError("That held order no longer exists.")
        if order.cashier_id != cashier.id and not self.auth_service.has_permission(cashier, "view_reports"):
            raise PermissionError("That held order belongs to another cashier.")
        return order
