"""
Abstract base class for every repository.

Repositories are the ONLY layer that writes SQL. All queries are
parameterized (``%s`` placeholders handled by PyMySQL) — user input is
never concatenated into SQL text. ``table_name`` / ``order_by`` below are
class-level constants chosen by the developer, never user input.
"""
from abc import ABC, abstractmethod
from typing import Any, Generic, Mapping, Sequence, TypeVar

from app.extensions import get_db, in_transaction

T = TypeVar("T")


class BaseRepository(ABC, Generic[T]):
    table_name: str = ""
    default_order: str = "id"

    # ---- subclasses decide how a row becomes a model ----
    @abstractmethod
    def _to_model(self, row: Mapping[str, Any] | None) -> T | None:
        """Convert one DictCursor row into a domain model."""

    def _select_sql(self) -> str:
        """Base SELECT used by find_by_id/list_all; override to add JOINs."""
        return f"SELECT * FROM {self.table_name}"

    # ---- low-level helpers shared by all repositories ----
    def _fetch_one(self, sql: str, params: Sequence[Any] = ()) -> dict | None:
        with get_db().cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchone()

    def _fetch_all(self, sql: str, params: Sequence[Any] = ()) -> list[dict]:
        with get_db().cursor() as cur:
            cur.execute(sql, params)
            return list(cur.fetchall())

    def _execute(self, sql: str, params: Sequence[Any] = ()) -> int:
        """Run INSERT/UPDATE/DELETE; return lastrowid (INSERT) or rowcount."""
        db = get_db()
        with db.cursor() as cur:
            cur.execute(sql, params)
            result = cur.lastrowid or cur.rowcount
        if not in_transaction():
            db.commit()
        return result

    # ---- generic CRUD ----
    def find_by_id(self, entity_id: int) -> T | None:
        alias = self._alias()
        return self._to_model(self._fetch_one(f"{self._select_sql()} WHERE {alias}id = %s", (entity_id,)))

    def list_all(self) -> list[T]:
        return [self._to_model(r) for r in self._fetch_all(f"{self._select_sql()} ORDER BY {self.default_order}")]

    def delete(self, entity_id: int) -> int:
        return self._execute(f"DELETE FROM {self.table_name} WHERE id = %s", (entity_id,))

    def count(self) -> int:
        row = self._fetch_one(f"SELECT COUNT(*) AS n FROM {self.table_name}")
        return int(row["n"]) if row else 0

    def _alias(self) -> str:
        """Column prefix when _select_sql() uses a table alias (e.g. 'p.')."""
        return ""
