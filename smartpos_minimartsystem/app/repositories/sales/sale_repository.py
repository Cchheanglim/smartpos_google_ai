"""Data access for sales and sale_items."""
from datetime import date
from typing import Any, Mapping

from app.models.sales.sale import Sale, SaleItem
from app.repositories.base_repository import BaseRepository


class SaleRepository(BaseRepository[Sale]):
    table_name = "sales"
    default_order = "s.created_at DESC"

    def _to_model(self, row: Mapping[str, Any] | None) -> Sale | None:
        return Sale.from_row(row)

    def _select_sql(self) -> str:
        return ("SELECT s.*, u.name AS cashier_name, c.name AS customer_name, c.phone AS customer_phone, "
                "(SELECT COALESCE(SUM(r.refund_amount),0) FROM refunds r WHERE r.sale_id = s.id) AS refunded_amount "
                "FROM sales s JOIN users u ON u.id = s.cashier_id "
                "LEFT JOIN customers c ON c.id = s.customer_id")

    def _alias(self) -> str:
        return "s."

    def find_with_items(self, sale_id: int) -> Sale | None:
        sale = self.find_by_id(sale_id)
        if sale:
            sale.items = self.items_for(sale_id)
        return sale

    def items_for(self, sale_id: int) -> list[SaleItem]:
        rows = self._fetch_all("SELECT * FROM sale_items WHERE sale_id = %s ORDER BY id", (sale_id,))
        return [SaleItem.from_row(r) for r in rows]

    def search(self, term: str = "", start: date | None = None, end: date | None = None,
               payment_method: str = "", cashier_id: int | None = None, limit: int = 100) -> list[Sale]:
        sql, params = f"{self._select_sql()} WHERE 1=1", []
        if term:
            digits = "".join(ch for ch in term if ch.isdigit())
            sql += " AND (c.name LIKE %s OR c.phone LIKE %s OR u.name LIKE %s OR s.id = %s)"
            params += [f"%{term}%", f"%{term}%", f"%{term}%", int(digits) if digits else -1]
        if start:
            sql += " AND DATE(s.created_at) >= %s"
            params.append(start)
        if end:
            sql += " AND DATE(s.created_at) <= %s"
            params.append(end)
        if payment_method:
            sql += " AND s.payment_method = %s"
            params.append(payment_method)
        if cashier_id:
            sql += " AND s.cashier_id = %s"
            params.append(cashier_id)
        sql += " ORDER BY s.created_at DESC, s.id DESC LIMIT %s"
        params.append(limit)
        return [self._to_model(r) for r in self._fetch_all(sql, params)]

    def create(self, sale: Sale) -> int:
        enum_value = lambda e: e.value if e is not None else None
        return self._execute(
            "INSERT INTO sales (cashier_id, customer_id, attendance_id, subtotal, discount_type, discount_value, "
            "discount_amount, member_discount_amount, points_redeemed, points_discount, tax_percent, tax_amount, "
            "total_amount, payment_method, currency_mode, cash_usd, cash_khr, change_currency, change_usd, "
            "change_khr, exchange_rate, qr_bank, card_brand, split_card_amount, split_qr_amount, points_earned) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, "
            "%s, %s, %s)",
            (sale.cashier_id, sale.customer_id, sale.attendance_id, sale.subtotal, sale.discount_type,
             sale.discount_value, sale.discount_amount, sale.member_discount_amount, sale.points_redeemed,
             sale.points_discount, sale.tax_percent, sale.tax_amount, sale.total_amount,
             sale.payment_method.value, enum_value(sale.currency_mode), sale.cash_usd, sale.cash_khr,
             enum_value(sale.change_currency), sale.change_usd, sale.change_khr, sale.exchange_rate,
             sale.qr_bank, sale.card_brand, sale.split_card_amount, sale.split_qr_amount, sale.points_earned))

    def add_item(self, sale_id: int, item: SaleItem) -> int:
        return self._execute(
            "INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, unit_cost, note) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (sale_id, item.product_id, item.product_name, item.quantity, item.unit_price, item.unit_cost,
             item.note or None))

    def latest(self, limit: int = 8) -> list[Sale]:
        return [self._to_model(r) for r in self._fetch_all(
            f"{self._select_sql()} ORDER BY s.created_at DESC, s.id DESC LIMIT %s", (limit,))]

    def add_refunded_quantity(self, sale_item_id: int, quantity: int) -> int:
        return self._execute(
            "UPDATE sale_items SET refunded_quantity = refunded_quantity + %s "
            "WHERE id = %s AND refunded_quantity + %s <= quantity",
            (quantity, sale_item_id, quantity))

    def today_totals(self, cashier_id: int | None = None) -> dict:
        sql = ("SELECT COUNT(*) AS transactions, COALESCE(SUM(total_amount),0) AS revenue "
               "FROM sales WHERE DATE(created_at) = CURDATE()")
        params: list[Any] = []
        if cashier_id:
            sql += " AND cashier_id = %s"
            params.append(cashier_id)
        return self._fetch_one(sql, params) or {}
