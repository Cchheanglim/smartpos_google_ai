"""Product category domain model."""
from dataclasses import dataclass
from typing import Any, Mapping


@dataclass
class Category:
    """A merchandise category (Snacks, Beverages, ...) with a Font Awesome icon."""

    DEFAULT_ICON = "fa-box"
    ICON_CHOICES = (
        "fa-box", "fa-cookie-bite", "fa-bottle-water", "fa-cheese", "fa-broom",
        "fa-pump-soap", "fa-jar", "fa-apple-whole", "fa-bread-slice", "fa-ice-cream",
        "fa-mug-hot", "fa-baby", "fa-paw", "fa-pills", "fa-bolt",
    )

    id: int
    name: str
    description: str = ""
    icon: str = DEFAULT_ICON
    product_count: int = 0

    def __post_init__(self) -> None:
        if self.icon not in self.ICON_CHOICES:
            self.icon = self.DEFAULT_ICON

    @classmethod
    def from_row(cls, row: Mapping[str, Any] | None) -> "Category | None":
        if row is None:
            return None
        return cls(
            id=row["id"],
            name=row["name"],
            description=row.get("description") or "",
            icon=row.get("icon") or cls.DEFAULT_ICON,
            product_count=int(row.get("product_count") or 0),
        )
