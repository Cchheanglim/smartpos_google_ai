"""Data access for the users table."""
from typing import Any, Mapping

from app.models.auth.user import User
from app.repositories.base_repository import BaseRepository


class UserRepository(BaseRepository[User]):
    table_name = "users"
    default_order = "u.name"

    def _to_model(self, row: Mapping[str, Any] | None) -> User | None:
        return User.from_row(row)

    def _select_sql(self) -> str:
        return ("SELECT u.*, r.name AS role_name, r.display_name AS role_display_name, "
                "sh.name AS shift_name, sh.start_time AS shift_start, sh.end_time AS shift_end "
                "FROM users u JOIN roles r ON r.id = u.role_id "
                "LEFT JOIN shifts sh ON sh.id = u.shift_id")

    def _alias(self) -> str:
        return "u."

    def find_by_email(self, email: str) -> User | None:
        return self._to_model(self._fetch_one(f"{self._select_sql()} WHERE u.email = %s", (email,)))

    def search(self, term: str | None = None, role_id: int | None = None,
               active: bool | None = None) -> list[User]:
        sql, params = f"{self._select_sql()} WHERE 1=1", []
        if term:
            sql += " AND (u.name LIKE %s OR u.email LIKE %s OR u.phone LIKE %s)"
            like = f"%{term}%"
            params += [like, like, like]
        if role_id:
            sql += " AND u.role_id = %s"
            params.append(role_id)
        if active is not None:
            sql += " AND u.is_active = %s"
            params.append(int(active))
        sql += " ORDER BY u.is_active DESC, r.id, u.name"
        return [self._to_model(r) for r in self._fetch_all(sql, params)]

    def list_active(self) -> list[User]:
        return self.search(active=True)

    def status_counts(self) -> dict:
        return self._fetch_one("SELECT COALESCE(SUM(is_active = 1),0) AS active, "
                               "COALESCE(SUM(is_active = 0),0) AS resigned FROM users") or {}

    def create(self, user: User) -> int:
        return self._execute(
            "INSERT INTO users (name, email, phone, password_hash, role_id, shift_id, avatar_filename, is_active) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            (user.name, user.email, user.phone, user.password_hash, user.role_id, user.shift_id,
             user.avatar_filename, int(user.active)),
        )

    def update(self, user: User) -> None:
        self._execute(
            "UPDATE users SET name=%s, email=%s, phone=%s, role_id=%s, shift_id=%s WHERE id=%s",
            (user.name, user.email, user.phone, user.role_id, user.shift_id, user.id),
        )

    def set_active(self, user_id: int, active: bool, reason: str | None = None) -> None:
        """Deactivate (resigned) or reactivate an account. Rows are never deleted,
        so sales, refunds and shifts keep pointing at a real person."""
        if active:
            self._execute("UPDATE users SET is_active=1, deactivated_at=NULL, deactivation_reason=NULL "
                          "WHERE id=%s", (user_id,))
        else:
            self._execute("UPDATE users SET is_active=0, deactivated_at=NOW(), deactivation_reason=%s "
                          "WHERE id=%s", (reason, user_id))

    def update_profile(self, user_id: int, name: str, phone: str | None, avatar_filename: str | None) -> None:
        if avatar_filename:
            self._execute("UPDATE users SET name=%s, phone=%s, avatar_filename=%s WHERE id=%s",
                          (name, phone, avatar_filename, user_id))
        else:
            self._execute("UPDATE users SET name=%s, phone=%s WHERE id=%s", (name, phone, user_id))

    def clear_avatar(self, user_id: int) -> None:
        self._execute("UPDATE users SET avatar_filename=NULL WHERE id=%s", (user_id,))

    def update_password(self, user_id: int, password_hash: str) -> None:
        self._execute("UPDATE users SET password_hash=%s WHERE id=%s", (password_hash, user_id))

    def count_active_in_role(self, role_name: str) -> int:
        row = self._fetch_one(
            "SELECT COUNT(*) AS n FROM users u JOIN roles r ON r.id = u.role_id "
            "WHERE r.name = %s AND u.is_active = 1", (role_name,))
        return int(row["n"]) if row else 0

    def has_history(self, user_id: int) -> bool:
        """True if the person appears in sales/refunds/shifts (then they may never be hard-deleted)."""
        row = self._fetch_one(
            "SELECT (SELECT COUNT(*) FROM sales WHERE cashier_id=%s) + "
            "(SELECT COUNT(*) FROM refunds WHERE processed_by=%s) + "
            "(SELECT COUNT(*) FROM attendance WHERE user_id=%s) AS n", (user_id, user_id, user_id))
        return bool(row and row["n"])
