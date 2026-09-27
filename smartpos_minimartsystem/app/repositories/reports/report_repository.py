"""Read-only aggregate queries for the reports module."""
from typing import Any, Mapping

from app.models.reports.report_models import CashierProductivity, DateRange, RankedRow, SalesSummary
from app.repositories.base_repository import BaseRepository


class ReportRepository(BaseRepository[SalesSummary]):
    """Aggregates over sales/sale_items/refunds. No writes."""

    table_name = "sales"

    def _to_model(self, row: Mapping[str, Any] | None) -> SalesSummary:
        return SalesSummary.from_row(row)

    _RANGE = "DATE(s.created_at) BETWEEN %s AND %s"

    def summary(self, period: DateRange) -> SalesSummary:
        row = self._fetch_one(
            "SELECT COUNT(*) AS transactions, COALESCE(SUM(s.total_amount),0) AS revenue, "
            "COALESCE(SUM(s.discount_amount + s.member_discount_amount + s.points_discount),0) AS discounts, "
            "(SELECT COALESCE(SUM(si.unit_cost * si.quantity),0) FROM sale_items si JOIN sales s2 "
            "   ON s2.id = si.sale_id WHERE DATE(s2.created_at) BETWEEN %s AND %s) AS cost, "
            "(SELECT COALESCE(SUM(si.quantity),0) FROM sale_items si JOIN sales s3 "
            "   ON s3.id = si.sale_id WHERE DATE(s3.created_at) BETWEEN %s AND %s) AS items_sold, "
            "(SELECT COALESCE(SUM(r.refund_amount),0) FROM refunds r "
            "   WHERE DATE(r.created_at) BETWEEN %s AND %s) AS refunds, "
            "(SELECT COALESCE(SUM(ri.quantity * si.unit_cost),0) FROM refund_items ri "
            "   JOIN refunds r2 ON r2.id = ri.refund_id JOIN sale_items si ON si.id = ri.sale_item_id "
            "   WHERE DATE(r2.created_at) BETWEEN %s AND %s) AS refunded_cost "
            f"FROM sales s WHERE {self._RANGE}",
            (period.start, period.end) * 5)
        return self._to_model(row)

    def revenue_by_day(self, period: DateRange) -> list[RankedRow]:
        rows = self._fetch_all(
            "SELECT DATE(s.created_at) AS label, SUM(s.total_amount) AS amount, COUNT(*) AS quantity "
            f"FROM sales s WHERE {self._RANGE} GROUP BY DATE(s.created_at) ORDER BY label",
            (period.start, period.end))
        return [RankedRow.from_row(r) for r in rows]

    def top_products(self, period: DateRange, limit: int = 10) -> list[RankedRow]:
        rows = self._fetch_all(
            "SELECT si.product_name AS label, SUM(si.quantity - si.refunded_quantity) AS quantity, "
            "SUM((si.quantity - si.refunded_quantity) * si.unit_price) AS amount "
            f"FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE {self._RANGE} "
            "GROUP BY si.product_name ORDER BY quantity DESC, amount DESC LIMIT %s",
            (period.start, period.end, limit))
        return [RankedRow.from_row(r) for r in rows]

    def top_products_by_revenue(self, period: DateRange, limit: int = 10) -> list[RankedRow]:
        rows = self._fetch_all(
            "SELECT si.product_name AS label, SUM(si.quantity - si.refunded_quantity) AS quantity, "
            "SUM((si.quantity - si.refunded_quantity) * si.unit_price) AS amount "
            f"FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE {self._RANGE} "
            "GROUP BY si.product_name ORDER BY amount DESC, quantity DESC LIMIT %s",
            (period.start, period.end, limit))
        return [RankedRow.from_row(r) for r in rows]

    def sales_by_hour(self, period: DateRange) -> dict[int, tuple]:
        """{hour: (revenue, transactions)} — used for the "rush hour" chart."""
        rows = self._fetch_all(
            "SELECT HOUR(s.created_at) AS hr, SUM(s.total_amount) AS amount, COUNT(*) AS quantity "
            f"FROM sales s WHERE {self._RANGE} GROUP BY HOUR(s.created_at)",
            (period.start, period.end))
        return {int(r["hr"]): (r["amount"], int(r["quantity"])) for r in rows}

    def cashier_productivity(self, period: DateRange) -> list[CashierProductivity]:
        rows = self._fetch_all(
            "SELECT u.id AS user_id, u.name, "
            "(SELECT COUNT(*) FROM sales s WHERE s.cashier_id = u.id AND "
            "   DATE(s.created_at) BETWEEN %s AND %s) AS transactions, "
            "(SELECT COALESCE(SUM(s.total_amount),0) FROM sales s WHERE s.cashier_id = u.id AND "
            "   DATE(s.created_at) BETWEEN %s AND %s) AS revenue, "
            "(SELECT COUNT(*) FROM attendance a WHERE a.user_id = u.id AND a.clock_out IS NOT NULL AND "
            "   DATE(a.clock_in) BETWEEN %s AND %s) AS shifts, "
            "(SELECT COUNT(*) FROM attendance a WHERE a.user_id = u.id AND a.cash_difference = 0 AND "
            "   DATE(a.clock_in) BETWEEN %s AND %s) AS balanced_shifts, "
            "(SELECT COALESCE(SUM(a.cash_difference),0) FROM attendance a WHERE a.user_id = u.id AND "
            "   DATE(a.clock_in) BETWEEN %s AND %s) AS variance_total "
            "FROM users u ORDER BY u.name",
            (period.start, period.end) * 5)
        stats = [CashierProductivity.from_row(r) for r in rows]
        return sorted((c for c in stats if c.transactions or c.shifts), key=lambda c: c.revenue, reverse=True)

    def waste_by_reason(self, period: DateRange) -> list[RankedRow]:
        """Stock written off (damaged, breakage, internal use, supplier returns) valued at cost."""
        rows = self._fetch_all(
            "SELECT m.reason AS label, SUM(-m.change_amount) AS quantity, SUM(-m.change_amount * p.cost) AS amount "
            "FROM stock_movements m JOIN products p ON p.id = m.product_id "
            "WHERE m.reason IN ('damaged','breakage','internal_use','supplier_return') "
            "AND DATE(m.created_at) BETWEEN %s AND %s GROUP BY m.reason ORDER BY amount DESC",
            (period.start, period.end))
        return [RankedRow.from_row(r) for r in rows]

    def revenue_by_category(self, period: DateRange) -> list[RankedRow]:
        rows = self._fetch_all(
            "SELECT COALESCE(c.name, 'Uncategorized') AS label, "
            "SUM(si.quantity * si.unit_price) AS amount, SUM(si.quantity) AS quantity "
            "FROM sale_items si JOIN sales s ON s.id = si.sale_id "
            "LEFT JOIN products p ON p.id = si.product_id LEFT JOIN categories c ON c.id = p.category_id "
            f"WHERE {self._RANGE} GROUP BY COALESCE(c.name, 'Uncategorized') ORDER BY amount DESC",
            (period.start, period.end))
        return [RankedRow.from_row(r) for r in rows]

    def revenue_by_payment(self, period: DateRange) -> list[RankedRow]:
        rows = self._fetch_all(
            "SELECT s.payment_method AS label, SUM(s.total_amount) AS amount, COUNT(*) AS quantity "
            f"FROM sales s WHERE {self._RANGE} GROUP BY s.payment_method ORDER BY amount DESC",
            (period.start, period.end))
        return [RankedRow.from_row(r) for r in rows]

    def revenue_by_cashier(self, period: DateRange) -> list[RankedRow]:
        rows = self._fetch_all(
            "SELECT u.name AS label, SUM(s.total_amount) AS amount, COUNT(*) AS quantity "
            f"FROM sales s JOIN users u ON u.id = s.cashier_id WHERE {self._RANGE} "
            "GROUP BY u.name ORDER BY amount DESC",
            (period.start, period.end))
        return [RankedRow.from_row(r) for r in rows]

    def sales_rows_for_export(self, period: DateRange) -> list[dict]:
        return self._fetch_all(
            "SELECT s.id, s.created_at, u.name AS cashier, COALESCE(c.name,'') AS customer, "
            "s.payment_method, COALESCE(s.currency_mode,'') AS currency_mode, s.subtotal, "
            "s.discount_amount + s.member_discount_amount + s.points_discount AS discounts, "
            "s.tax_amount, s.total_amount, "
            "(SELECT COALESCE(SUM(si.unit_cost * si.quantity),0) FROM sale_items si WHERE si.sale_id = s.id) AS cogs, "
            "(SELECT COALESCE(SUM(r.refund_amount),0) FROM refunds r WHERE r.sale_id = s.id) AS refunded "
            "FROM sales s JOIN users u ON u.id = s.cashier_id LEFT JOIN customers c ON c.id = s.customer_id "
            f"WHERE {self._RANGE} ORDER BY s.created_at",
            (period.start, period.end))
