# SmartPOS Mini-Mart System

> Modern, Object-Oriented Retail POS & Mini-Mart Management System built with **Python**, **Flask**, **Jinja2**, and **MySQL (XAMPP)**.

---

## 🏬 Overview

**SmartPOS Mini-Mart** is a retail management web application engineered with strict Object-Oriented Programming (OOP) design patterns and a clean layered architecture (Domain Models -> Repositories -> Business Services -> Routes & Controllers -> Jinja2 Views).

It replicates the look, signature violet & lime design system, and full feature set of the SmartPOS prototype:
- **Cashier POS Register Terminal**: Real-time product search, barcode scanner integration, category tabs, quantity modifiers, and subtotal calculation.
- **Dual-Currency Tender Engine**: Simultaneous calculation in USD ($) and Cambodian Riel (៛) at dynamic exchange rates (default `1 USD = 4,100 KHR`), with multi-currency mixed tenders and precise change breakdown in both currencies.
- **Customer CRM & Loyalty Points**: Customer lookup by phone number, automated membership tier progression (Bronze, Silver, Gold, VIP), loyalty discounts, and points redemption ($0.01 per point).
- **Inventory & Catalog Management**: Real-time stock levels, low-stock threshold replenishment alerts, manual stock adjustments with reason audit logging (shrinkage, damage, restock).
- **Printable Barcode Label Sheets**: Ready-to-print 38mm x 25mm retail shelf tags and item barcode stickers.
- **Sales History & Restocking Refunds**: Full receipts ledger with itemized breakdowns and transaction refunds that automatically restock inventory items back into the catalog.
- **Staff, Work Shifts & Punch Clock**: Staff employee directory, shift management (Morning, Afternoon, Night), cash drawer float recording, and discrepancy calculation.
- **Granular RBAC Matrix**: Dynamic Role-Based Access Control matrix allowing administrators to toggle 25+ system permissions across Store Manager, Cashier, and Inventory Manager roles.
- **Financial Analytics & Reporting**: Real-time gross sales revenue, Cost of Goods Sold (COGS), gross profit margins, category sales breakdown, and CSV report export.

---

## 🏗️ Architecture & Project Structure

```
smartpos_minimartsystem/
├── app/
│   ├── __init__.py               # Flask application factory (create_app)
│   ├── config.py                 # Environment-based configuration (Dev/Test/Prod)
│   ├── extensions.py             # AuthManager, RBAC decorators & PasswordHasher
│   ├── models/                   # OOP Domain entities & value objects
│   │   ├── __init__.py
│   │   ├── base.py               # BaseModel & immutable Money value object
│   │   ├── role.py               # Role & Permission entities
│   │   ├── user.py               # User employee domain entity
│   │   ├── category.py           # Category & Supplier entities
│   │   ├── product.py            # Product entity & StockAdjustment audit object
│   │   ├── customer.py           # Customer entity & CustomerTier enum
│   │   ├── sale.py               # Sale, SaleItem, PaymentDetail & Refund entities
│   │   ├── attendance.py         # AttendanceRecord & Shift entities
│   │   └── task.py               # Operational Task entity
│   ├── repositories/             # MySQL / Data access layer
│   │   ├── __init__.py
│   │   ├── base_repository.py    # Generic abstract CRUD repository interface
│   │   ├── db_manager.py         # Thread-safe DB singleton (MySQL with SQLite fallback)
│   │   ├── user_repository.py    # User data access
│   │   ├── role_repository.py    # Role & permission data access
│   │   ├── product_repository.py # Product & stock adjustment queries
│   │   ├── category_repository.py# Category & customer queries
│   │   ├── sale_repository.py    # Order checkout & refund atomic transactions
│   │   ├── attendance_repository.py # Attendance & task queries
│   │   └── report_repository.py  # Financial KPIs & aggregations
│   ├── services/                 # Business logic coordination
│   │   ├── __init__.py
│   │   ├── auth_service.py       # Authentication & security policies
│   │   ├── product_service.py    # Inventory & catalog workflows
│   │   ├── checkout_service.py   # Checkout math, dual currency & atomic sales
│   │   ├── refund_service.py     # Returns, restocking & staff shift workflows
│   │   └── customer_service.py   # Loyalty CRM, reports & operational duties
│   ├── routes/                   # Flask Blueprints (Controllers)
│   │   ├── auth_routes.py        # /auth (login, logout, profile)
│   │   ├── dashboard_routes.py   # / & /dashboard
│   │   ├── pos_routes.py         # /pos (Cashier terminal)
│   │   ├── product_routes.py     # /products (Catalog & barcodes)
│   │   ├── sales_routes.py       # /sales (Receipts & refunds)
│   │   ├── staff_routes.py       # /staff (Employees & RBAC matrix)
│   │   ├── report_routes.py      # /reports & /tasks
│   │   └── api_routes.py         # /api (AJAX barcode/customer lookup & checkout)
│   ├── forms/                    # Request validators & form helpers
│   │   ├── __init__.py
│   │   └── forms.py
│   ├── templates/                # Jinja2 HTML views
│   │   ├── base.html             # App layout with violet/lime theme & ambient blobs
│   │   ├── auth/                 # Sign in screen with 1-click demo role fillers
│   │   ├── dashboard/            # Executive KPI summary & sales trends
│   │   ├── pos/                  # Interactive POS terminal & tender modal
│   │   ├── products/             # Inventory catalog & barcode sheet
│   │   ├── sales/                # Sales ledger & printable receipts
│   │   ├── staff/                # Employee directory & RBAC matrix
│   │   ├── reports/              # Financial charts & customer CRM
│   │   ├── tasks/                # Operational duties checklist
│   │   ├── profile/              # User settings & password change
│   │   └── errors/               # 403, 404, 500 error pages
│   └── static/                   # Static assets
│       ├── css/style.css         # Unified design system stylesheet
│       ├── js/pos.js             # Real-time POS register engine
│       ├── js/main.js            # Modal & UI helpers
│       └── uploads/              # Product and avatar assets
├── sql/
│   ├── schema.sql                # Complete MySQL DDL tables
│   └── seed_data.sql             # Demo accounts, roles, products, categories, CRM
├── tests/
│   ├── test_models.py            # Unit tests for domain models
│   └── test_services.py          # Integration tests for services
├── requirements.txt              # Python package dependencies
├── .env.example                  # Environment configuration template
└── run.py                        # WSGI entry point & dev runner
```

---

## 🚀 Quickstart Guide (Local Development with XAMPP)

### 1. Requirements
- Python 3.10 or higher
- XAMPP with MySQL and Apache started (or any MySQL server)

### 2. Database Setup (XAMPP MySQL)
1. Open XAMPP Control Panel and start **MySQL**.
2. Open **phpMyAdmin** (`http://localhost/phpmyadmin`).
3. Create a new database named:
   ```sql
   CREATE DATABASE smartpos_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
4. Click on `smartpos_db` -> **Import** -> Select `sql/schema.sql` and run.
5. Next, click **Import** -> Select `sql/seed_data.sql` and run.

*(Note: If MySQL is not running, the application includes an automatic fallback to an embedded local SQLite database so development and testing can proceed seamlessly!)*

### 3. Install Python Dependencies
```bash
cd smartpos_minimartsystem
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS / Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### 4. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default XAMPP credentials in `.env`:
```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=smartpos_db
DB_USER=root
DB_PASSWORD=
KHR_EXCHANGE_RATE=4100.0
```

### 5. Launch the Application
```bash
python run.py
```
Access the application in your browser at:
**`http://localhost:5000`**

---

## 🔑 Demo Login Credentials

The login screen (`/auth/login`) includes quick 1-click autofill buttons for each role:

| Role | Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@smartpos.local` | `password123` | Full administrative control, RBAC, users, reports |
| **Cashier** | `cashier@smartpos.local` | `password123` | POS register, checkout tender, receipts, customer lookup |
| **Inventory Manager**| `inventory@smartpos.local` | `password123` | Product catalog, stock adjustments, barcode printing |

---

## 🧪 Running Automated Tests

Run the test suite using Python's built-in `unittest` runner:
```bash
cd smartpos_minimartsystem
python -m unittest discover tests
```
