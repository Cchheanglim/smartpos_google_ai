"""Category directory business rules."""
from app.forms.inventory_forms import CategoryInput
from app.models.inventory.category import Category
from app.repositories.inventory.category_repository import CategoryRepository
from app.services.errors import NotFoundError


class CategoryService:
    def __init__(self, category_repo: CategoryRepository | None = None) -> None:
        self.category_repo = category_repo or CategoryRepository()

    def list_page(self) -> dict:
        return {"categories": self.category_repo.list_all(), "icons": Category.ICON_CHOICES}

    def form_page(self, category_id: int | None = None) -> dict:
        category = self.get(category_id) if category_id is not None else None
        return {"category": category, "icons": Category.ICON_CHOICES}

    def get(self, category_id: int) -> Category:
        category = self.category_repo.find_by_id(category_id)
        if category is None:
            raise NotFoundError("Category not found.")
        return category

    def create(self, data: CategoryInput) -> Category:
        category = Category(id=0, name=data.name, description=data.description, icon=data.icon)
        self._check(category)
        category.id = self.category_repo.create(category)
        return category

    def update(self, category_id: int, data: CategoryInput) -> Category:
        category = self.get(category_id)
        category.name, category.description, category.icon = data.name, data.description, data.icon
        category.__post_init__()
        self._check(category)
        self.category_repo.update(category)
        return category

    def delete(self, category_id: int) -> Category:
        category = self.get(category_id)
        if category.product_count:
            raise ValueError(f"'{category.name}' still has {category.product_count} product(s). "
                             "Move them to another category first.")
        self.category_repo.delete(category_id)
        return category

    def _check(self, category: Category) -> None:
        if len(category.name) > 60:
            raise ValueError("Category name must be 60 characters or fewer.")
        clash = self.category_repo.find_by_name(category.name)
        if clash and clash.id != category.id:
            raise ValueError(f"A category named '{category.name}' already exists.")
