"""Data access for the categories table."""
from typing import Any, Mapping

from app.models.inventory.category import Category
from app.repositories.base_repository import BaseRepository


class CategoryRepository(BaseRepository[Category]):
    table_name = "categories"
    default_order = "c.name"

    def _to_model(self, row: Mapping[str, Any] | None) -> Category | None:
        return Category.from_row(row)

    def _select_sql(self) -> str:
        return ("SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count "
                "FROM categories c")

    def _alias(self) -> str:
        return "c."

    def find_by_name(self, name: str) -> Category | None:
        return self._to_model(self._fetch_one(f"{self._select_sql()} WHERE c.name = %s", (name,)))

    def create(self, category: Category) -> int:
        return self._execute("INSERT INTO categories (name, description, icon) VALUES (%s, %s, %s)",
                             (category.name, category.description, category.icon))

    def update(self, category: Category) -> None:
        self._execute("UPDATE categories SET name=%s, description=%s, icon=%s WHERE id=%s",
                      (category.name, category.description, category.icon, category.id))
