"""
Reporting and Analytics Repository
Aggregates sales metrics, COGS, gross margins, and chart timeseries data.
"""

from typing import Dict, Any, List
from .db_manager import db_manager


class ReportRepository:
    """Provides analytical aggregations for store performance reporting."""

    def __init__(self, db=None):
        self.db = db or db_manager

    def get_dashboard_metrics(self) -> Dict[str, Any]:
        """Calculates store top-level KPIs."""
        sales_row = self.db.execute_one("""
            SELECT 
                COUNT(*) as total_orders,
                COALESCE(SUM(total_amount), 0) as total_revenue
            FROM sales 
            WHERE status != 'cancelled';
        """)

        # Calculate profit and total cost
        cogs_row = self.db.execute_one("""
            SELECT 
                COALESCE(SUM(si.cost_price * si.quantity), 0) as total_cost
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE s.status != 'cancelled';
        """)

        revenue = float(sales_row['total_revenue']) if sales_row else 0.0
        cogs = float(cogs_row['total_cost']) if cogs_row else 0.0
        gross_profit = max(0.0, revenue - cogs)
        profit_margin = round((gross_profit / revenue * 100.0), 1) if revenue > 0 else 0.0

        # Count low stock products
        low_stock_row = self.db.execute_one("""
            SELECT COUNT(*) as low_stock_count 
            FROM products 
            WHERE is_active = 1 AND quantity_in_stock <= low_stock_threshold;
        """)

        # Count total active products
        total_products_row = self.db.execute_one("""
            SELECT COUNT(*) as count FROM products WHERE is_active = 1;
        """)

        # Count active staff
        staff_row = self.db.execute_one("""
            SELECT COUNT(*) as count FROM users WHERE is_active = 1;
        """)

        return {
            'total_revenue': round(revenue, 2),
            'total_orders': int(sales_row['total_orders']) if sales_row else 0,
            'gross_profit': round(gross_profit, 2),
            'profit_margin': profit_margin,
            'total_cogs': round(cogs, 2),
            'low_stock_count': int(low_stock_row['low_stock_count']) if low_stock_row else 0,
            'total_products': int(total_products_row['count']) if total_products_row else 0,
            'active_staff': int(staff_row['count']) if staff_row else 0
        }

    def get_sales_trend(self, limit_days: int = 7) -> List[Dict[str, Any]]:
        """Returns daily sales aggregations for charts."""
        query = """
            SELECT 
                DATE(completed_at) as sale_date,
                COUNT(*) as order_count,
                COALESCE(SUM(total_amount), 0) as daily_revenue
            FROM sales
            WHERE status != 'cancelled'
            GROUP BY DATE(completed_at)
            ORDER BY sale_date DESC
            LIMIT %s;
        """
        rows = self.db.execute_query(query, (limit_days,))
        # Return in ascending chronological order for charts
        return list(reversed(rows))

    def get_top_selling_products(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Calculates best performing inventory items."""
        query = """
            SELECT 
                si.product_id,
                si.product_name,
                si.sku,
                SUM(si.quantity) as total_units_sold,
                SUM(si.total) as total_sales_volume
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE s.status != 'cancelled'
            GROUP BY si.product_id, si.product_name, si.sku
            ORDER BY total_units_sold DESC
            LIMIT %s;
        """
        return self.db.execute_query(query, (limit,))

    def get_revenue_by_category(self) -> List[Dict[str, Any]]:
        """Calculates sales distribution by category."""
        query = """
            SELECT 
                c.name as category_name,
                COALESCE(SUM(si.total), 0) as category_revenue
            FROM categories c
            JOIN products p ON c.id = p.category_id
            JOIN sale_items si ON p.id = si.product_id
            JOIN sales s ON si.sale_id = s.id
            WHERE s.status != 'cancelled'
            GROUP BY c.id, c.name
            ORDER BY category_revenue DESC;
        """
        return self.db.execute_query(query)
