# Architecture

## Layers

```
Browser
  │  HTML forms / links
  ▼
Routes (app/routes/**)        Flask blueprints. Parse the request, call ONE
  │                            service method, render a template or redirect.
  │                            No SQL, no business rules.
  ▼
Services (app/services/**)     Business rules and workflows. Compose one or
  │                            more repositories (+ helpers like PasswordHasher,
  │                            ImageStorage) through the constructor
  │                            (composition). Raise ValueError for anything the
  │                            user did wrong; the route catches it and flashes
  │                            the message. Multi-table writes run inside
  │                            extensions.transaction().
  ▼
Repositories (app/repositories/**)   The ONLY place SQL is written. One class
  │                                   per entity, all queries parameterised
  │                                   (PyMySQL %s placeholders — never string-
  │                                   built from user input).
  ▼
Models (app/models/**)         Plain Python objects (POPOs): dataclasses with
                                validate()/properties/special methods, and a
                                from_row(cls, row) classmethod that turns a
                                PyMySQL DictCursor row into an instance. No
                                database access happens in a model.
```

A route never imports a repository directly, and no SQL string appears outside
`app/repositories/`. Every product list, checkout page, or report view is one
service call from its route.

## Vertical slice: Products & Stock

The clearest end-to-end example of the four layers, worth reading first:

- **Model** — `app/models/inventory/product.py` (`Product`, `StockStatus`) and
  `app/models/inventory/stock_movement.py` (`StockMovement`, `MovementReason`).
  `Product.validate()` protects invalid state (empty name, non-positive price,
  a barcode that isn't 8–14 digits); `MovementReason.check_change()` enforces
  that "Damaged goods" can only ever remove stock and "Restock" can only add
  it.
- **Repository** — `app/repositories/inventory/product_repository.py`. Search
  and sort use a *whitelist* (`ProductRepository.SORTS`), so a user-supplied
  sort key can never become raw SQL. `adjust_stock()` is one guarded
  `UPDATE ... WHERE quantity_in_stock + %s >= 0`, so two tills can never sell
  a product below zero even without a database-level lock.
- **Service** — `app/services/inventory/product_service.py`
  (`ProductService`). `create_product()` writes the product and its opening-
  stock ledger row inside one `transaction()`; `adjust_stock()` re-checks the
  reason's direction before writing.
- **Route** — `app/routes/inventory/product_routes.py`
  (`products_bp`). Each view is 3–6 lines: parse input with a form class,
  call one `ProductService` method, render or redirect.
- **Templates** — `app/templates/inventory/products_*.html`,
  `movements.html`, `barcodes.html`.

Every other module (checkout, refunds, staff, shifts, tasks, purchase orders)
follows the same shape.

## Domain classes (partial list — 60+ in total)

| Area | Classes | Notable OOP feature |
|---|---|---|
| Auth | `User`, `Role`, `Permission` | `User` implements the Flask-Login protocol itself (`is_authenticated`, `get_id()`, …) rather than inheriting a base class — composition over inheritance |
| Inventory | `Product`, `StockStatus` (Enum), `StockMovement`, `MovementReason` (Enum with per-member direction), `Category`, `Supplier`, `PurchaseOrder`, `POStatus` (Enum state machine), `PurchaseOrderItem` | `POStatus.transition_to()` — a state machine enforced by the enum itself |
| Sales | `Cart`, `CartLine`, `Discount`, `DiscountType`, `PricingSummary`, `Sale`, `SaleItem`, `PaymentMethod`, `HeldOrder`, `Refund`, `RefundItem`, `Customer`, `LoyaltyTier` | `Cart.__iter__/__len__/__bool__` make a cart behave like a native container; `Discount.__bool__`/`__str__` |
| Currency | `ExchangeRate`, `CashTender`, `Change`, `CurrencyMode`, `ChangeCurrency` | `ExchangeRate` is an immutable value object; `CashTender.change_for()` raises `ValueError` rather than returning a negative change |
| Staff | `AttendanceSession`, `DrawerStatus` (Enum), `CashMovement`, `CashMovementKind`, `Shift`, `Task`, `TaskPriority`, `TaskStatus`, `AuditEntry` | `Task.__lt__` gives tasks a natural sort order (urgent-first, then soonest due date), so `sorted(tasks)` "just works" |
| Reports | `DateRange`, `SalesSummary`, `RankedRow`, `CashierProductivity` | frozen dataclasses — a report row can't be mutated after it is built |

## Repository layer (19 classes, one per entity)

`BaseRepository(ABC, Generic[T])` defines `_to_model()` as an abstract method
and provides `find_by_id`, `list_all`, `delete`, `count` for free; every
concrete repository (`ProductRepository`, `SaleRepository`,
`AttendanceRepository`, …) implements only `_to_model()` and its own queries.
This is the project's one inheritance relationship, used because "every
repository converts rows to models and does basic CRUD" is a real is-a
relationship, not decoration.

## Service layer (20 classes)

Each service is built through its constructor from the repositories (and
helpers) it needs — composition, and it makes services trivial to unit-test
by passing in fakes instead of real repositories (see `docs/testing.md`).
Key ones:

- `CheckoutService` — cart math, barcode/SKU lookup, manual + loyalty-tier
  discounts, points redemption, dual-currency tender, atomic sale write
  (sale + items + stock + loyalty + drawer cash in one transaction).
- `RefundService` — pro-rated partial refunds; a cash refund is paid out of
  the *refunding cashier's own open drawer* and fails if that drawer doesn't
  hold enough cash.
- `AttendanceService` — clock-in/out, manual cash in/out, and the
  expected-vs-counted reconciliation that produces a `DrawerStatus`.
- `PurchaseOrderService` — enforces the `POStatus` state machine and adds
  stock (with ledger rows) only when an order is received.
- `StaffService` — deactivate/reactivate/delete, Super-Admin protections,
  per-user permission overrides, avatar moderation.
- `RoleService` — the role → permission matrix; the Super Admin role can
  never lose `manage_roles`/`manage_users`, and only a Super Admin may edit
  the Super Admin row.

## Request flow example: completing a sale

1. `checkout_routes.complete()` parses the POST into a `CheckoutInput` and
   calls `checkout_service.complete_sale(cart, data, current_user)`.
2. `CheckoutService` re-prices the cart server-side (never trusts a total the
   browser sent), builds a `CashTender` if the payment is cash, and opens
   `extensions.transaction()`.
3. Inside the transaction: `SaleRepository.create()`, one
   `SaleRepository.add_item()` per line, a guarded
   `ProductRepository.adjust_stock()` per line (raises if another till just
   sold the same stock), `StockMovementRepository.create()` per line,
   `CustomerRepository.add_purchase()` if a loyalty member is attached, and
   `AttendanceRepository.add_movement()` to log the cash into the cashier's
   drawer.
4. Any `ValueError` anywhere in that block rolls back the whole transaction;
   the route catches it and flashes the message back to the cashier.
