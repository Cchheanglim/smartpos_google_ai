# SmartPOS Mini-Mart System

A full-featured point-of-sale and retail operations system for a small mini-mart. The application is built with **Python 3, Flask 3, MySQL/MariaDB, Jinja2, and vanilla JavaScript** using a layered architecture:

```text
Routes → Services → Repositories → Models
```

The project uses parameterized SQL through PyMySQL rather than an ORM. It includes authentication, role-based permissions, inventory, purchasing, checkout, refunds, shifts, reports, and optional Telegram alerts.

## Features

- Authentication with salted password hashing, session protection, CSRF protection, and role-based access control
- POS checkout with product search, barcode scanning, held orders, discounts, loyalty points, dual-currency tender, split payments, card payments, and demo KHQR payments
- Product, category, supplier, customer, staff, and purchase-order management
- Inventory tracking with stock adjustments, low-stock warnings, stock movement history, and product images
- Sales history, printable receipts, partial/full refunds, and cash-drawer reconciliation
- Staff shifts, tasks, reports, CSV/Excel exports, and permission overrides
- Optional Telegram notifications for sales, stock changes, refunds, staff changes, and other store events
- Automated tests that run without a live MySQL server

## Requirements

- Python 3.10 or newer
- MySQL or MariaDB (XAMPP is supported)
- A modern web browser

## Quick start

From this directory (`smartpos_minimartsystem`):

```bash
python -m venv venv

# macOS/Linux
source venv/bin/activate

# Windows
# venv\Scripts\activate

pip install -r requirements.txt
```

### 1. Configure the database

Create the database schema and demo data using phpMyAdmin or the MySQL client:

```bash
mysql -u root < sql/schema.sql
mysql -u root smartpos_minimart < sql/seed.sql
```

For a least-privilege application account, use a dedicated user instead of `root`:

```sql
CREATE USER 'smartpos_app'@'localhost' IDENTIFIED BY 'choose-a-password';
GRANT SELECT, INSERT, UPDATE, DELETE ON smartpos_minimart.* TO 'smartpos_app'@'localhost';
```

### 2. Configure environment variables

Copy the safe template to a local `.env` file:

```bash
cp .env.example .env
```

On Windows, copy `.env.example` to `.env` using File Explorer or PowerShell. Set the database values and a strong `SECRET_KEY` in `.env`. Telegram variables are optional and can remain blank to disable notifications.

> **Security:** `.env` is intentionally ignored by Git because it can contain passwords, secret keys, and API tokens. Never commit it or paste its contents into an issue or pull request. Only `.env.example` belongs in the repository.

### 3. Start the application

```bash
python run.py
```

Open <http://localhost:5000> in your browser.

The development server is configured to listen on `0.0.0.0:5000`. Do not use Flask's development server as the production deployment server.

## Demo accounts

The seed data uses the password `password123` for the demo accounts:

| Role | Email |
| --- | --- |
| Super Admin | `superadmin@smartpos.local` |
| Admin | `admin@smartpos.local` |
| Inventory Manager | `inventory@smartpos.local` |
| Cashier | `cashier@smartpos.local` |

Change or reset demo passwords before using the application with real data:

```bash
python scripts/reset_demo_passwords.py
```

## Testing

Run the test suite from `smartpos_minimartsystem`:

```bash
pytest
```

The test configuration is in `pytest.ini`, and tests are located in `tests/`. Most tests use fake/in-memory repositories and do not require MySQL.

## Project structure

```text
smartpos_minimartsystem/
├── app/
│   ├── models/          # Domain models and validation
│   ├── repositories/    # Parameterized SQL and persistence
│   ├── services/        # Business rules and workflows
│   ├── routes/          # Flask blueprints/controllers
│   ├── forms/           # Request parsing and validation
│   ├── templates/       # Jinja2 views
│   └── static/          # CSS, JavaScript, images, and uploads
├── docs/                # Architecture, database, testing, and user guides
├── scripts/             # Database backup/restore and password utilities
├── sql/                 # Schema and seed data
├── tests/               # Automated tests
├── .env.example         # Safe configuration template
├── .gitignore           # Ignores local secrets and generated files
├── requirements.txt
└── run.py               # Application entry point
```

See the documentation in `docs/` for the architecture, database design, testing strategy, and user guide.

## Backups and uploaded files

Use the scripts in `scripts/` for database backups and restores. Treat database dumps and uploaded files as private operational data; they are ignored or should be stored outside Git. Review backup permissions before sharing a deployment archive.

## License

No license has been specified for this repository yet. Add a license file before distributing or reusing the project publicly.
