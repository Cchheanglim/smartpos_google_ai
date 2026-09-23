#!/usr/bin/env python3
"""
SmartPOS Mini-Mart System
WSGI Application Launcher and CLI Entry Point
"""

import os
import sys
from app import create_app
from app.repositories.db_manager import db_manager

# Determine environment
env_name = os.environ.get('FLASK_ENV', 'development')
app = create_app(env_name)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    host = os.environ.get('HOST', '0.0.0.0')
    debug = env_name == 'development'

    print("=" * 60)
    print("  SmartPOS Mini-Mart System (Python + Flask + MySQL)")
    print(f"  Starting development server on http://localhost:{port}")
    db_mode = getattr(db_manager, 'db_type', 'mysql' if getattr(db_manager, 'is_mysql', False) else 'sqlite')
    print(f"  Database Mode: {db_mode.upper()}")
    print("=" * 60)

    app.run(host=host, port=port, debug=debug)
