"""
Database Manager for MySQL (XAMPP) & SQLite Fallback
Provides connection pooling, cursor execution, transaction control, and schema bootstrapping.
"""

import os
import sqlite3
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

try:
    import pymysql
    from pymysql.cursors import DictCursor
    HAS_PYMYSQL = True
except ImportError:
    HAS_PYMYSQL = False


class DatabaseManager:
    """
    Singleton database manager.
    Primary target: MySQL (XAMPP localhost:3306).
    Fallback: Embedded SQLite if MySQL daemon is not currently active.
    """
    _instance: Optional['DatabaseManager'] = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, host='127.0.0.1', port=3306, user='root', password='', database='smartpos_minimart'):
        if self._initialized:
            return
        self.host = host
        self.port = int(port)
        self.user = user
        self.password = password
        self.database = database
        self.is_mysql = False
        self.sqlite_path = Path(__file__).resolve().parent.parent.parent / 'smartpos_minimart.db'
        self._test_connection_and_init()
        self._initialized = True

    @property
    def db_type(self) -> str:
        return 'mysql' if self.is_mysql else 'sqlite'

    def _test_connection_and_init(self):
        """Attempts to connect to MySQL; if unavailable, uses SQLite fallback seamlessly."""
        if HAS_PYMYSQL:
            try:
                # Try connecting to MySQL server
                conn = pymysql.connect(
                    host=self.host,
                    port=self.port,
                    user=self.user,
                    password=self.password,
                    charset='utf8mb4',
                    connect_timeout=2
                )
                with conn.cursor() as cursor:
                    cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{self.database}` CHARACTER SET utf8mb4;")
                conn.select_db(self.database)
                conn.close()
                self.is_mysql = True
                print(f"[SmartPOS DB] Connected successfully to MySQL ({self.host}:{self.port}/{self.database})")
                self._bootstrap_mysql_schema()
                self._heal_seed_users()
                return
            except Exception as e:
                print(f"[SmartPOS DB] MySQL not available ({e}). Initializing SQLite fallback: {self.sqlite_path}")
        else:
            print("[SmartPOS DB] PyMySQL not installed. Falling back to SQLite.")

        self.is_mysql = False
        self._bootstrap_sqlite_schema()
        self._heal_seed_users()

    def _heal_seed_users(self):
        """Repairs seed accounts to ensure default credentials (password123) work seamlessly."""
        valid_hash = 'pbkdf2:sha256:600000$WvQY8rK9k0xVzYl4$98f0957998e70032757b32e0977e263cd8dbdf3cba68ded4e164ba41956a6dbe'
        legacy_hash = 'pbkdf2:sha256:600000$WvQY8rK9k0xVzYl4$6c167b5e438bc8610eb67beaf8df572a1e0ce5e9d997d4c88e0019233be1267a'
        try:
            self.execute_update(
                "UPDATE users SET password_hash = %s WHERE password_hash = %s OR password_hash IN ('password', 'password123', 'admin123');",
                (valid_hash, legacy_hash)
            )
        except Exception:
            pass


    def get_connection(self):
        """Returns an active connection object."""
        if self.is_mysql:
            return pymysql.connect(
                host=self.host,
                port=self.port,
                user=self.user,
                password=self.password,
                database=self.database,
                charset='utf8mb4',
                cursorclass=DictCursor,
                autocommit=False
            )
        else:
            conn = sqlite3.connect(str(self.sqlite_path))
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA foreign_keys = ON;")
            return conn

    def _adapt_query(self, query: str) -> str:
        """Adapts MySQL parameter placeholders (%s) to SQLite (?) when in SQLite fallback mode."""
        if self.is_mysql:
            return query
        # Replace %s with ? for SQLite
        return query.replace('%s', '?')

    def execute_query(self, query: str, params: Union[Tuple, List] = ()) -> List[Dict[str, Any]]:
        """Executes a SELECT query and returns a list of dictionaries."""
        conn = self.get_connection()
        adapted_query = self._adapt_query(query)
        try:
            cursor = conn.cursor()
            cursor.execute(adapted_query, params)
            if self.is_mysql:
                results = cursor.fetchall()
            else:
                rows = cursor.fetchall()
                results = [dict(row) for row in rows]
            cursor.close()
            return results
        finally:
            conn.close()

    def execute_one(self, query: str, params: Union[Tuple, List] = ()) -> Optional[Dict[str, Any]]:
        """Executes a SELECT query and returns a single row dictionary or None."""
        results = self.execute_query(query, params)
        return results[0] if results else None

    def execute_non_query(self, query: str, params: Union[Tuple, List] = ()) -> int:
        """Executes INSERT/UPDATE/DELETE and returns lastrowid or affected rows."""
        conn = self.get_connection()
        adapted_query = self._adapt_query(query)
        try:
            cursor = conn.cursor()
            cursor.execute(adapted_query, params)
            conn.commit()
            last_id = cursor.lastrowid
            cursor.close()
            return last_id or 1
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _bootstrap_mysql_schema(self):
        """Executes schema.sql and seed_data.sql on MySQL if tables are missing."""
        schema_file = Path(__file__).resolve().parent.parent.parent / 'sql' / 'schema.sql'
        seed_file = Path(__file__).resolve().parent.parent.parent / 'sql' / 'seed_data.sql'
        
        tables = self.execute_query("SHOW TABLES;")
        if not tables:
            print("[SmartPOS DB] Bootstrapping MySQL tables from schema.sql...")
            if schema_file.exists():
                with open(schema_file, 'r', encoding='utf-8') as f:
                    sql_commands = f.read().split(';')
                    conn = self.get_connection()
                    cursor = conn.cursor()
                    for cmd in sql_commands:
                        cmd = cmd.strip()
                        if cmd:
                            try:
                                cursor.execute(cmd)
                            except Exception as ex:
                                pass
                    conn.commit()
                    conn.close()
            if seed_file.exists():
                print("[SmartPOS DB] Seeding default MySQL catalog, staff, and roles...")
                with open(seed_file, 'r', encoding='utf-8') as f:
                    sql_commands = f.read().split(';')
                    conn = self.get_connection()
                    cursor = conn.cursor()
                    for cmd in sql_commands:
                        cmd = cmd.strip()
                        if cmd:
                            try:
                                cursor.execute(cmd)
                            except Exception as ex:
                                pass
                    conn.commit()
                    conn.close()

    def _bootstrap_sqlite_schema(self):
        """Initializes SQLite tables if smartpos_minimart.db is newly created."""
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users';")
        if not cursor.fetchone():
            print("[SmartPOS DB] Creating SQLite fallback tables...")
            cursor.executescript("""
            CREATE TABLE IF NOT EXISTS roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                display_name TEXT NOT NULL,
                is_system INTEGER DEFAULT 1,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                display_name TEXT NOT NULL,
                description TEXT,
                is_system INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS role_permissions (
                role_id INTEGER NOT NULL,
                permission_id INTEGER NOT NULL,
                PRIMARY KEY (role_id, permission_id)
            );

            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                phone TEXT,
                password_hash TEXT NOT NULL,
                role_id INTEGER NOT NULL,
                shift_name TEXT DEFAULT 'Morning',
                shift_start TEXT DEFAULT '06:00:00',
                shift_end TEXT DEFAULT '14:00:00',
                is_active INTEGER DEFAULT 1,
                profile_picture TEXT DEFAULT 'f86e67858910489ba513eae41ad5b941.png',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_permissions (
                user_id INTEGER NOT NULL,
                permission_name TEXT NOT NULL,
                PRIMARY KEY (user_id, permission_name)
            );

            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                icon TEXT DEFAULT 'fa-box',
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS suppliers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                contact_person TEXT,
                phone TEXT,
                email TEXT,
                address TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                sku TEXT UNIQUE NOT NULL,
                barcode TEXT UNIQUE NOT NULL,
                category_id INTEGER NOT NULL,
                supplier_id INTEGER,
                price REAL NOT NULL DEFAULT 0.0,
                cost_price REAL NOT NULL DEFAULT 0.0,
                quantity_in_stock INTEGER NOT NULL DEFAULT 0,
                low_stock_threshold INTEGER NOT NULL DEFAULT 10,
                unit TEXT DEFAULT 'piece',
                image_url TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS stock_adjustments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                change_quantity INTEGER NOT NULL,
                previous_quantity INTEGER NOT NULL,
                new_quantity INTEGER NOT NULL,
                reason TEXT NOT NULL,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT UNIQUE NOT NULL,
                email TEXT,
                tier TEXT DEFAULT 'Bronze',
                points INTEGER DEFAULT 0,
                discount_rate REAL DEFAULT 0.0,
                total_spent REAL DEFAULT 0.0,
                notes TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS shifts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                clock_in TEXT NOT NULL,
                clock_out TEXT,
                status TEXT DEFAULT 'present',
                starting_cash REAL DEFAULT 0.0,
                counted_cash REAL,
                cash_discrepancy REAL DEFAULT 0.0,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS sales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_code TEXT UNIQUE NOT NULL,
                cashier_id INTEGER NOT NULL,
                customer_id INTEGER,
                subtotal REAL NOT NULL,
                discount_percent REAL DEFAULT 0.0,
                discount_amount REAL DEFAULT 0.0,
                tax_percent REAL DEFAULT 0.0,
                tax_amount REAL DEFAULT 0.0,
                total_amount REAL NOT NULL,
                payment_method TEXT DEFAULT 'Cash',
                currency_mode TEXT DEFAULT 'usd',
                exchange_rate REAL DEFAULT 4100.0,
                amount_paid_usd REAL DEFAULT 0.0,
                amount_paid_khr REAL DEFAULT 0.0,
                change_usd REAL DEFAULT 0.0,
                change_khr REAL DEFAULT 0.0,
                points_redeemed INTEGER DEFAULT 0,
                points_discount_usd REAL DEFAULT 0.0,
                points_earned INTEGER DEFAULT 0,
                status TEXT DEFAULT 'completed',
                notes TEXT,
                completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS sale_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                product_name TEXT NOT NULL,
                sku TEXT NOT NULL,
                unit_price REAL NOT NULL,
                cost_price REAL DEFAULT 0.0,
                quantity INTEGER NOT NULL,
                subtotal REAL NOT NULL,
                discount REAL DEFAULT 0.0,
                total REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS refunds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_id INTEGER NOT NULL,
                processed_by INTEGER NOT NULL,
                total_amount REAL NOT NULL,
                reason TEXT NOT NULL,
                notes TEXT,
                refunded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS refund_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                refund_id INTEGER NOT NULL,
                sale_item_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                unit_price REAL NOT NULL,
                subtotal REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                assigned_to INTEGER NOT NULL,
                assigned_by INTEGER NOT NULL,
                priority TEXT DEFAULT 'medium',
                status TEXT DEFAULT 'pending',
                due_date TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP
            );
            """)
            conn.commit()
            
            # Seed initial SQLite data
            self._seed_sqlite_data(conn)
        conn.close()

    def _seed_sqlite_data(self, conn):
        """Seeds initial data into SQLite matching the prototype."""
        cursor = conn.cursor()
        # Roles
        cursor.executemany("INSERT OR IGNORE INTO roles (id, name, display_name, description) VALUES (?, ?, ?, ?)", [
            (1, 'super_admin', 'Super Admin', 'Supreme authority with complete governance'),
            (2, 'admin', 'Admin', 'Store operations, staff and reporting'),
            (3, 'inventory_manager', 'Inventory Manager', 'Catalog and stock adjustments'),
            (4, 'cashier', 'Cashier', 'POS register and checkout')
        ])

        # Permissions
        perms = [
            (1, 'manage_users', 'Manage Staff'), (2, 'delete_staff', 'Delete Staff'),
            (3, 'admin_reset_password', 'Reset Staff Password'), (4, 'manage_roles', 'Manage Roles'),
            (5, 'manage_shifts', 'Manage Shifts'), (6, 'manage_tasks', 'Assign Tasks'),
            (7, 'manage_products', 'Manage Products'), (8, 'delete_products', 'Delete Products'),
            (9, 'adjust_stock', 'Adjust Stock'), (10, 'manage_categories', 'Manage Categories'),
            (11, 'print_barcodes', 'Print Barcodes'), (12, 'view_cost_prices', 'View Cost Prices'),
            (13, 'process_sale', 'Process POS Sales'), (14, 'apply_discounts', 'Apply Discounts'),
            (15, 'hold_orders', 'Hold Orders'), (16, 'manage_currency', 'Manage Currency'),
            (17, 'adjust_drawer_cash', 'Adjust Drawer Cash'), (18, 'view_reports', 'View Reports'),
            (19, 'export_reports', 'Export Reports'), (20, 'view_profit_loss', 'View Profit & Loss'),
            (21, 'manage_cashier_accounts', 'Audit Cashier Accounts'), (22, 'process_refund', 'Process Refunds'),
            (23, 'manage_loyalty_customers', 'Manage Customers'), (24, 'adjust_loyalty_points', 'Adjust Loyalty Points'),
            (25, 'delete_customers', 'Delete Customers')
        ]
        cursor.executemany("INSERT OR IGNORE INTO permissions (id, name, display_name) VALUES (?, ?, ?)", perms)

        # Role Permissions
        for p_id in range(1, 26):
            cursor.execute("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (1, ?)", (p_id,))
            cursor.execute("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (2, ?)", (p_id,))
        for p_id in [7, 8, 9, 10, 11, 12, 18]:
            cursor.execute("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (3, ?)", (p_id,))
        for p_id in [13, 14, 15, 22, 23]:
            cursor.execute("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (4, ?)", (p_id,))

        # Users (Password: password123)
        pwd_hash = 'pbkdf2:sha256:600000$WvQY8rK9k0xVzYl4$98f0957998e70032757b32e0977e263cd8dbdf3cba68ded4e164ba41956a6dbe'
        cursor.executemany("INSERT OR IGNORE INTO users (id, name, email, phone, password_hash, role_id, shift_name, shift_start, shift_end, profile_picture) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
            (1, 'Chheanglim Chhum', 'admin@smartpos.local', '012345678', pwd_hash, 1, 'Full Day', '08:00:00', '17:00:00', '109d0bba2885419aa36f1cf95552b8ee.png'),
            (2, 'Dara Sok', 'cashier@smartpos.local', '098765432', pwd_hash, 4, 'Morning', '06:00:00', '14:00:00', '64b7647b32ed4d23bebd67b77aad3d11.jpg'),
            (3, 'Bopha Meas', 'inventory@smartpos.local', '077889900', pwd_hash, 3, 'Afternoon', '14:00:00', '22:00:00', '73cad91d621142b1b46d3aac4a1d3770.jpg'),
            (4, 'Vannak Heng', 'cashier2@smartpos.local', '011223344', pwd_hash, 4, 'Night', '22:00:00', '06:00:00', 'f86e67858910489ba513eae41ad5b941.png')
        ])

        # Categories
        cursor.executemany("INSERT OR IGNORE INTO categories (id, name, icon) VALUES (?, ?, ?)", [
            (1, 'Beverages', 'fa-mug-hot'), (2, 'Snacks & Confectionery', 'fa-cookie-bite'),
            (3, 'Dairy & Eggs', 'fa-egg'), (4, 'Pantry Essentials', 'fa-wheat-awn'),
            (5, 'Bakery', 'fa-bread-slice'), (6, 'Personal Care', 'fa-pump-soap'),
            (7, 'Household Supplies', 'fa-spray-can')
        ])

        # Suppliers
        cursor.executemany("INSERT OR IGNORE INTO suppliers (id, name, contact_person, phone) VALUES (?, ?, ?, ?)", [
            (1, 'Angkor Distributing Co.', 'Sovan Rath', '023889900'),
            (2, 'Khmer Food & Beverage Supply', 'Channary Kim', '012998877'),
            (3, 'Phnom Penh Daily Essentials', 'Kosal Leng', '092554433')
        ])

        # Products
        cursor.executemany("INSERT OR IGNORE INTO products (id, name, sku, barcode, category_id, supplier_id, price, cost_price, quantity_in_stock, low_stock_threshold, unit, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
            (1, 'Coca Cola 330ml Can', 'BEV-COC-330', '8851959141013', 1, 1, 0.65, 0.40, 142, 24, 'can', '7f2260fe2eba469e8659426789ffb6e4.jpg'),
            (2, 'Red Bull Energy Drink 250ml', 'BEV-RED-250', '8850228000151', 1, 1, 0.85, 0.55, 88, 20, 'can', None),
            (3, 'Vital Premium Water 500ml', 'BEV-VIT-500', '8841020000018', 1, 2, 0.35, 0.18, 210, 48, 'bottle', None),
            (4, 'Lay''s Classic Potato Chips 50g', 'SNK-LAY-050', '8850718800100', 2, 2, 1.20, 0.75, 45, 15, 'pack', '2d0802d1c82f42039606e68be5f7b9d9.webp'),
            (5, 'Oreo Cookies Original 133g', 'SNK-ORE-133', '8992760221016', 2, 2, 1.10, 0.70, 60, 12, 'pack', None),
            (6, 'Meiji Fresh Milk 946ml', 'DAI-MEI-946', '8850329101112', 3, 3, 2.50, 1.85, 18, 10, 'carton', None),
            (7, 'Mama Instant Noodles Shrimp 60g', 'PAN-MAM-060', '8851876000011', 4, 2, 0.40, 0.22, 320, 50, 'pack', None),
            (8, 'Whole Wheat Sandwich Bread', 'BAK-WHT-400', '8841928001290', 5, 3, 1.80, 1.15, 14, 8, 'loaf', None),
            (9, 'Colgate Total Toothpaste 150g', 'PER-COL-150', '8850006320141', 6, 3, 2.20, 1.40, 32, 10, 'tube', None),
            (10, 'Puffs Ultra Soft Facial Tissues 2-Ply', 'HOU-PUF-200', '8850987110022', 7, 3, 1.50, 0.90, 48, 15, 'box', None)
        ])

        # Customers
        cursor.executemany("INSERT OR IGNORE INTO customers (id, name, phone, email, tier, points, discount_rate, total_spent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
            (1, 'Somnang Pich', '012990011', 'somnang.p@gmail.com', 'VIP', 680, 10.0, 745.50),
            (2, 'Sreymom Chan', '098112233', 'sreymom.c@gmail.com', 'Gold', 320, 5.0, 340.20),
            (3, 'Piseth Keo', '077445566', 'piseth.keo@gmail.com', 'Silver', 150, 2.0, 165.00),
            (4, 'Theara Vuthy', '086778899', 'theara.v@gmail.com', 'Bronze', 45, 0.0, 45.80)
        ])

        # Shifts
        cursor.executemany("INSERT OR IGNORE INTO shifts (id, name, start_time, end_time) VALUES (?, ?, ?, ?)", [
            (1, 'Morning Shift', '06:00:00', '14:00:00'),
            (2, 'Afternoon Shift', '14:00:00', '22:00:00'),
            (3, 'Night Shift', '22:00:00', '06:00:00'),
            (4, 'Admin Full Day', '08:00:00', '17:00:00')
        ])

        # Tasks
        cursor.executemany("INSERT OR IGNORE INTO tasks (id, title, description, assigned_to, assigned_by, priority, status, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
            (1, 'Audit Beverage Refrigerators', 'Check expiry dates and restock Coca Cola.', 2, 1, 'high', 'in_progress', '2026-09-24'),
            (2, 'Restock Instant Noodle Shelves', 'Replenish Mama noodles row FIFO.', 3, 1, 'medium', 'completed', '2026-09-23'),
            (3, 'Weekly Cash Drawer Reconciliation', 'Audit shift starting floats.', 2, 1, 'urgent', 'pending', '2026-09-25')
        ])

        # Sales & Line Items
        cursor.execute("""
            INSERT OR IGNORE INTO sales (id, transaction_code, cashier_id, customer_id, subtotal, discount_percent, discount_amount, tax_percent, tax_amount, total_amount, payment_method, currency_mode, exchange_rate, amount_paid_usd, change_usd, points_earned, status, completed_at)
            VALUES (1, 'TXN-20260920-001', 2, 1, 15.40, 10.0, 1.54, 10.0, 1.39, 15.25, 'Cash', 'usd', 4100.0, 20.0, 4.75, 15, 'completed', '2026-09-20 09:30:15')
        """)
        cursor.execute("""
            INSERT OR IGNORE INTO sale_items (id, sale_id, product_id, product_name, sku, unit_price, cost_price, quantity, subtotal, discount, total)
            VALUES (1, 1, 1, 'Coca Cola 330ml Can', 'BEV-COC-330', 0.65, 0.40, 4, 2.60, 0.26, 2.34)
        """)
        conn.commit()


# Instantiate default singleton instance
db_manager = DatabaseManager()
