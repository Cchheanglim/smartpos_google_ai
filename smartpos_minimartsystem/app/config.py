"""
SmartPOS Mini-Mart Configuration Classes
Provides hierarchical configuration following enterprise OOP principles.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


class Config:
    """Base application configuration class."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'smartpos-default-dev-secret-key-39082')
    
    # MySQL Database Settings (Configured for XAMPP default)
    MYSQL_HOST = os.environ.get('MYSQL_HOST', '127.0.0.1')
    MYSQL_PORT = int(os.environ.get('MYSQL_PORT', 3306))
    MYSQL_USER = os.environ.get('MYSQL_USER', 'root')
    MYSQL_PASSWORD = os.environ.get('MYSQL_PASSWORD', '')
    MYSQL_DATABASE = os.environ.get('MYSQL_DATABASE', 'smartpos_minimart')
    
    # Currency Exchange and Tax Rules
    KHR_EXCHANGE_RATE = float(os.environ.get('KHR_EXCHANGE_RATE', 4100.0))
    DEFAULT_TAX_PERCENT = float(os.environ.get('DEFAULT_TAX_PERCENT', 10.0))
    
    # File Uploads
    UPLOAD_FOLDER = BASE_DIR / 'app' / 'static' / 'uploads'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp', 'gif'}
    
    # Session security
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = 86400  # 24 hours


class DevelopmentConfig(Config):
    """Development environment configuration."""
    DEBUG = True
    TESTING = False


class ProductionConfig(Config):
    """Production environment configuration with hardened security."""
    DEBUG = False
    TESTING = False
    SESSION_COOKIE_SECURE = True


class TestingConfig(Config):
    """Testing environment configuration using in-memory / temporary DB."""
    TESTING = True
    DEBUG = True
    MYSQL_DATABASE = 'smartpos_minimart_test'


config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
