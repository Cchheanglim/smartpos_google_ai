# SmartPOS Mini-Mart System

A full-featured Point-of-Sale and retail operations system for a small
mini-mart, built as an **Advanced OOP** R&D project. It follows a strict
four-layer architecture — **Routes → Services → Repositories → Models** —
in **Python 3 / Flask 3 / MySQL (XAMPP) / Jinja2**, with no ORM (raw
parameterised SQL only) and no frontend framework.

The application recreates the look, feel and full feature set of the
`smartpos_google_ai` React/Express prototype it was rebuilt from, including
dual-currency tender, cash-drawer reconciliation, held orders, purchase
orders, per-user permission overrides, and a team task board.

---

## 1. Quick start (XAMPP)

Requirements: Python 3.10+, XAMPP with MySQL/MariaDB running.

```bash
# 1) Python environment
python -m venv venv
source venv/bin/activate            # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 2) Database — phpMyAdmin: Import tab → sql/schema.sql, then sql/seed.sql
#    or from a terminal:
mysql -u root < sql/schema.sql
mysql -u root smartpos_minimart < sql/seed.sql

# 3) Configuration (defaults already match XAMPP: 127.0.0.1, root, no password)
cp .env.example .env

# 4) Run
python run.py                        # http://localhost:5000
```

### (Recommended) least-privilege database account

```sql
CREATE USER 'smartpos_app'@'localhost' IDENTIFIED BY 'choose-a-password';
GRANT SELECT, INSERT, UPDATE, DELETE ON smartpos_minimart.* TO 'smartpos_app'@'localhost';
```
Then set `DB_USER`/`DB_PASSWORD` in `.env` to match.

### Demo accounts (password for all: `password123`)

| Role | Email |
|---|---|
| Super Admin | `superadmin@smartpos.local` |
| Admin | `admin@smartpos.local` |
| Inventory Manager | `inventory@smartpos.local` |
| Cashier | `cashier@smartpos.local` |

If a login ever fails because of a hashing mismatch between machines, run
`python scripts/reset_demo_passwords.py` (optionally with a new password).

### Tests

```bash
pytest            # 42 test cases, no MySQL server needed
```
See `docs/testing.md` for what's covered and how the whole app was
verified (every route, every role, the full checkout/refund/staff/purchase-
order/shift lifecycle) before this build was packaged.

---

## 2. Feature coverage

| Module | Highlights |
|---|---|
| **Authentication & RBAC** | Salted password hashing, session protection, CSRF on every form, 4 system roles + 25 permissions, per-user individual permission overrides, fast user switching, emergency terminal lock |
| **POS Checkout** | Category/search/barcode product picker, per-line notes, held (parked) orders, loyalty lookup with tier discount, points redemption, manual % or fixed discount, dual-currency (USD/KHR) tender with denomination buttons and change in either currency, printable barcode receipt |
| **Inventory & Purchasing** | Product CRUD with barcode + margin/markup, low/out-of-stock badges, waste-auditing stock ledger with 6 reason codes, categories, suppliers, printable barcode sheets, purchase orders with a Draft → Ordered → Received/Cancelled state machine that auto-restocks on receipt |
| **Dashboard** | Live KPIs (revenue, net profit, average basket), low-stock and cash-in-drawer widgets, hourly sales chart, my-shift and my-tasks summary |
| **Sales History & Refunds** | Filterable ledger, printable receipts, a separate refund audit log, pro-rated partial/full refunds that restock inventory and are paid from the processing cashier's own drawer |
| **Staff & Shifts** | Directory with active/resigned filter, deactivate (reason kept) / reactivate / delete-if-no-history, shift templates, clock-in/out with cash-float and drawer reconciliation (Balanced/Overage/Shortage), manager force-close, manual cash in/out, a full cash-drawer audit page |
| **Tasks** | Manager-to-staff task board with priority, due dates, and Pending → In Progress → Completed (manager-only cancel) |
| **Reports** | Revenue, COGS, gross & net profit, discounts, refunds, daily and hourly charts, best sellers, category/payment breakdowns, cashier productivity with drawer compliance %, waste by reason, CSV **and** Excel (.xlsx) export |
| **Profile & Security** | Self-service profile/avatar/password, admin profile-picture moderation |

---

## 3. Project structure

```
smartpos_minimartsystem/
├── app/
│   ├── __init__.py          # create_app() application factory
│   ├── config.py             # Config / TestConfig (reads .env)
│   ├── extensions.py         # LoginManager, CSRFProtect, get_db() (PyMySQL), transaction()
│   ├── models/                # POPO dataclasses with from_row() — no DB access (60+ classes)
│   │   ├── auth/ inventory/ sales/ staff/ reports/
│   ├── repositories/          # the ONLY place SQL is written (19 classes, one per entity)
│   ├── services/               # business rules and workflows (20 classes)
│   ├── routes/                 # thin Flask blueprints — 15 controllers
│   ├── forms/                   # request parsing + server-side validation
│   ├── utils/                    # decorators, password hasher, image storage, CSV/XLSX/barcode
│   ├── templates/                 # 40 Jinja2 pages, violet/lime theme
│   └── static/                     # css/style.css, logo, uploads/
├── sql/                     # schema.sql (23 tables) and seed.sql (demo data)
├── tests/                   # pytest suite with in-memory fake repositories
├── docs/                    # architecture.md, database.md, testing.md, user_guide.md
├── scripts/                 # reset_demo_passwords.py, backup_db.sh, restore_db.sh
├── .env / .env.example
├── run.py
├── requirements.txt
└── README.md
```

See `docs/architecture.md` for the layer diagram and the Products/Stock
vertical-slice walkthrough, and `docs/database.md` for the full ERD.

---

## 4. Rubric mapping

| Requirement | Where |
|---|---|
| Flask app factory, config classes, extensions | `app/__init__.py`, `app/config.py`, `app/extensions.py` |
| Strict Routes → Services → Repositories → Models | No SQL outside `repositories/`; no route imports a repository — see `docs/architecture.md` |
| ≥5 domain classes / 3 services / 3 repositories | 60+ model classes, 20 services, 19 repositories |
| Dataclasses, properties, validation | e.g. `Product.validate()`, `Discount`, `ExchangeRate`, `CashTender` |
| Inheritance / ABC used meaningfully | `BaseRepository(ABC, Generic[T])`; `NotFoundError(LookupError)` |
| Composition | Every service is built from repositories + helpers through its constructor |
| Special methods, enums, state machines | `Cart.__iter__/__len__/__bool__`, `Task.__lt__`, `Discount.__bool__/__str__`; `POStatus`/`TaskStatus` as enum-driven state machines; `MovementReason` with per-member direction rules |
| Type hints + docstrings | Throughout |
| Login/logout, hashing, session protection, RBAC, 403 | Flask-Login (`session_protection="strong"`), Werkzeug salted hashes, `@permission_required`, `templates/errors/403.html` |
| CRUD on ≥2 modules | Products, categories, suppliers, customers, staff, shifts, tasks, purchase orders |
| Search/filter via MySQL | Products, sales, customers, staff, tasks, purchase orders, attendance audit |
| Report / export | `/reports` with CSV and Excel export |
| Server-side validation | `forms/` + model `validate()` + service rules + DB `CHECK`/`UNIQUE`/FK constraints |
| Transactions | `extensions.transaction()`: checkout, refund, stock/PO receipt, staff lifecycle, role matrix |
| Tests (≥10) | 42 pytest cases — see `docs/testing.md` |
| ERD, schema, seed, least-privilege DB user, backup | `docs/database.md`, `sql/`, `scripts/backup_db.sh` |

---

## 5. Product photos

Every product in `sql/seed.sql` links to a real product photo hosted on its
own brand's or retailer's website. These are **hotlinked**, not bundled into
this project, so:

- They need an internet connection to display (the app itself still runs
  fully offline — only the pictures need the network).
- If a link ever goes stale or 404s, that product's card automatically falls
  back to its category icon (built into the image's `onerror` handling —
  nothing breaks).
- To use your own photo for any product instead, open it from **Products &
  Stock → Edit** and upload a file — that always replaces the linked URL
  with your own image, stored locally in `app/static/uploads/products/`.

---

## 6. Payments, RBAC and other additions in this update

- **KHQR bank picker + demo QR** — choosing "ABA PAY / KHQR" at checkout shows a
  grid of Cambodian banks (ABA, Wing, ACLEDA, Canadia, Chip Mong, Prince,
  Sathapana, Cambodia Post, Vattanac) and generates a scannable QR code for
  the sale total. **This QR is a demo for the project** — it is not wired to
  a real bank's payment rails (that requires a signed merchant agreement
  with each bank), but it is a genuine, scannable QR code containing the
  sale details, and which bank was chosen is saved with the sale and shown
  on the receipt.
- **Card brand picker** — choosing "Credit/Debit Card" shows Visa,
  Mastercard and Amex logos to pick from; the choice is saved and shown on
  the receipt.
- **Real camera barcode scanning** — the camera icon next to the barcode box
  on checkout opens a live scanner (needs camera permission in the
  browser) and adds the scanned item automatically.
- **Sound effects** — short, synthesized tones (no external audio files)
  play on add-to-cart, remove, and a barcode scan.
- **Snappier checkout** — adding items, updating quantities, applying
  discounts/points, and looking up loyalty members now happen without a
  full page reload.
- **Roles & Permissions redesign** — three linked admin pages instead of one
  big form: **Role management** (list + create a role), a per-role
  **Configure** page for granting permissions, and a **Permission
  registry** (list + register a brand-new permission code). The original
  all-in-one **bulk matrix editor** is still there for fast multi-role
  edits.
- **New logo** — swapped in across every page, the browser tab icon, and
  the login/lock/switch-user screens.

Bank badges are generated in each bank's real, verified brand colors rather
than scraped logo files (see `app/static/img/banks/`), since reliably
sourcing an official logo file for every bank couldn't be guaranteed. Swap
in your own image at any time by replacing the matching SVG/PNG in that
folder — no code changes needed as long as the filename stays the same.

---

## 7. Camera scanning and split payments (latest update)

- **Continuous camera scanning** — the camera scanner now stays open and adds
  each barcode it sees automatically (with a running log inside the
  scanner window), instead of closing after every single item. Close it
  yourself with the **Done scanning** button when finished. The same
  barcode won't be added twice in a row if it's still in view.
- **Split / Mixed payment** — a 4th payment option lets a sale be paid
  across cash, card and QR at once (e.g. $3 by card, the rest in cash).
  Enter how much goes on card and/or QR (with the bank/card picked from a
  dropdown); the remaining balance is shown live and paid in cash the same
  way a normal cash sale works, denomination buttons included. The receipt
  itemizes exactly how much went to each method. A refund on a split sale
  correctly returns only the *cash share* of the refund to the drawer —
  the card/QR share was never physical cash to begin with.

---

## 8. Telegram store alerts

Your bot is already configured in `.env` (`TELEGRAM_BOT_TOKEN` /
`TELEGRAM_CHAT_ID`). Alerts fire automatically for:

| Event | Where it's triggered |
|---|---|
| New product added | Products & Stock → Add product |
| Stock restocked (manual) | Product detail → Adjust stock (restock reason) |
| Low stock crossed | Any sale or manual adjustment that drops a product to/below its threshold |
| Purchase order received | Purchase Orders → Receive |
| New sale completed | POS Checkout → Complete sale |
| Refund processed | Sales History → Refund |
| New staff added | Staff Management → Add staff |
| New role created | Roles & Permissions → New role |
| Password reset | Staff Management → Reset password |

Every alert includes **who** did it and **when**, plus the relevant product/
amount. On **Staff Management** there's a banner showing whether Telegram is
configured, with a **Send test alert** button — use that first to confirm
your bot and chat ID actually work before relying on real events.

A misconfigured or unreachable bot never breaks the app — every alert is
sent in a try/except that only logs a warning on failure, so a network
hiccup or wrong token never stops a sale, a stock update, or anything else
from completing normally.

---

## 9. Fixes: modal visibility, big customer-facing QR popup

- **Fixed washed-out popups** — the Hold Order, camera scanner, and new-task
  dialogs were missing their background/padding styling entirely (a CSS
  class mismatch), so their text sat almost unreadable directly on the
  dimmed backdrop. They now render as solid, readable cards.
- **KHQR QR now pops up big** — picking a bank at checkout opens a large,
  high-contrast popup (store logo, bank name, amount, big QR) meant to be
  turned toward the customer, instead of a small code buried in the
  sidebar. A **Show QR to customer** button reopens it anytime; click
  outside the popup or the × to close it.
