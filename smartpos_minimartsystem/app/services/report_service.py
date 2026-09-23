"""
Report and Analytics Service
"""

from typing import Dict, Any, Optional
from ..repositories.report_repository import ReportRepository
from ..repositories.sale_repository import SaleRepository


class ReportService:
    """Aggregates executive metrics and financial summaries."""

    def __init__(self, report_repo: Optional[ReportRepository] = None, sale_repo: Optional[SaleRepository] = None):
        self.report_repo = report_repo or ReportRepository()
        self.sale_repo = sale_repo or SaleRepository()

    def get_executive_summary(self) -> Dict[str, Any]:
        metrics = self.report_repo.get_dashboard_metrics()
        sales_trend = self.report_repo.get_sales_trend(7)
        top_products = self.report_repo.get_top_selling_products(5)
        category_rev = self.report_repo.get_revenue_by_category()

        return {
            'metrics': metrics,
            'sales_trend': sales_trend,
            'top_products': top_products,
            'category_revenue': category_rev
        }
