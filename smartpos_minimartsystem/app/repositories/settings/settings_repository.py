"""Key/value store for runtime settings (exchange rate, tax, store name)."""
from app.extensions import get_db, in_transaction


class SettingsRepository:
    """Not a BaseRepository: the table has a string primary key and no entity model."""

    def get(self, key: str, default: str | None = None) -> str | None:
        with get_db().cursor() as cur:
            cur.execute("SELECT setting_value FROM settings WHERE setting_key = %s", (key,))
            row = cur.fetchone()
        return row["setting_value"] if row else default

    def set(self, key: str, value: str, updated_by: int | None = None) -> None:
        # SELECT-then-write (not rowcount): MySQL reports 0 affected rows when the value is unchanged.
        exists = self.get(key) is not None
        db = get_db()
        with db.cursor() as cur:
            if exists:
                cur.execute("UPDATE settings SET setting_value = %s, updated_by = %s, updated_at = NOW() "
                            "WHERE setting_key = %s", (value, updated_by, key))
            else:
                cur.execute("INSERT INTO settings (setting_key, setting_value, updated_by) VALUES (%s, %s, %s)",
                            (key, value, updated_by))
        if not in_transaction():
            db.commit()
