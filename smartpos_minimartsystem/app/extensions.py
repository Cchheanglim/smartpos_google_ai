"""
Flask extensions and the PyMySQL database helper.

* ``get_db()`` returns ONE PyMySQL connection per request (stored on
  ``flask.g``) using a DictCursor, so repositories receive rows as dicts
  that the models' ``from_row()`` class methods understand.
* ``transaction()`` lets a *service* group several repository writes
  into one atomic MySQL transaction (e.g. checkout = sale + items +
  stock deduction + loyalty points). Repositories commit on their own
  only when no transaction is open.
* ``login_manager`` (Flask-Login) and ``csrf`` (Flask-WTF) are created
  here and bound to the app inside ``create_app()``.
"""
from contextlib import contextmanager
from typing import Iterator

import pymysql
import pymysql.cursors
from flask import Flask, current_app, g
from flask_login import LoginManager
from flask_wtf import CSRFProtect

login_manager = LoginManager()
csrf = CSRFProtect()


def get_db() -> pymysql.connections.Connection:
    """Return the request-scoped MySQL connection, opening it on first use."""
    if "db" not in g:
        cfg = current_app.config
        g.db = pymysql.connect(
            host=cfg["DB_HOST"],
            port=cfg["DB_PORT"],
            user=cfg["DB_USER"],
            password=cfg["DB_PASSWORD"],
            database=cfg["DB_NAME"],
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=False,
            charset="utf8mb4",
        )
    return g.db


def in_transaction() -> bool:
    """True while a service-level ``transaction()`` block is open."""
    return bool(g.get("tx_depth", 0))


@contextmanager
def transaction() -> Iterator[None]:
    """
    Unit-of-work context manager used by services.

    Commits once when the outermost block exits normally and rolls back
    everything if any exception escapes, so a multi-table workflow can
    never be left half-written.
    """
    db = get_db()
    g.tx_depth = g.get("tx_depth", 0) + 1
    try:
        yield
        g.tx_depth -= 1
        if g.tx_depth == 0:
            db.commit()
    except Exception:
        g.tx_depth = 0
        db.rollback()
        raise


def close_db(exception: BaseException | None = None) -> None:
    """Teardown hook: close the connection at the end of every request."""
    db = g.pop("db", None)
    g.pop("tx_depth", None)
    if db is not None:
        db.close()


def init_app(app: Flask) -> None:
    """Bind every extension to the application instance."""
    app.teardown_appcontext(close_db)
    csrf.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = "auth.login"
    login_manager.login_message = "Please log in to continue."
    login_manager.login_message_category = "info"
    login_manager.session_protection = "strong"
