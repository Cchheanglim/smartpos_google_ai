"""Configuration classes, read from environment variables (.env supported)."""
import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    """Default (development) configuration."""

    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")

    # Defaults match a stock XAMPP install: MySQL on 127.0.0.1:3306, user
    # root, no password.
    DB_HOST = os.environ.get("DB_HOST", "127.0.0.1")
    DB_PORT = int(os.environ.get("DB_PORT", 3306))
    DB_USER = os.environ.get("DB_USER", "root")
    DB_PASSWORD = os.environ.get("DB_PASSWORD", "")
    DB_NAME = os.environ.get("DB_NAME", "smartpos_minimart")

    STORE_NAME = os.environ.get("STORE_NAME", "Mini Mart")
    DEFAULT_TAX_PERCENT = float(os.environ.get("DEFAULT_TAX_PERCENT", 0))
    # Display-only USD -> KHR conversion shown on checkout and receipts.
    KHR_EXCHANGE_RATE = int(os.environ.get("KHR_EXCHANGE_RATE", 4100))
    PRODUCTS_PER_PAGE = 20

    # Optional Telegram activity alerts (new products, restocks, low stock,
    # purchase orders, new staff/roles, password resets). Leave blank to
    # disable — every notification silently no-ops until both are set.
    TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")

    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    PRODUCT_UPLOAD_FOLDER = os.path.join(BASE_DIR, "app", "static", "uploads", "products")
    AVATAR_UPLOAD_FOLDER = os.path.join(BASE_DIR, "app", "static", "uploads", "avatars")
    ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB upload limit

    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"


class TestConfig(Config):
    """Configuration used by the automated tests (no CSRF, no real DB)."""

    TESTING = True
    WTF_CSRF_ENABLED = False
