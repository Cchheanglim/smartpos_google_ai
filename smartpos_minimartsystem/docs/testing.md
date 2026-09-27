# Testing

```bash
pip install -r requirements.txt
pytest
```

No MySQL server is needed to run the suite: every service takes its
repositories through the constructor (composition), so the tests build each
service with **in-memory fake repositories** (`tests/fakes.py`) instead of
the real MySQL-backed ones and assert on the business rules directly.

## What's covered

**38 test functions, 42 cases once parametrised cases are counted**
(`pytest --collect-only -q` / the run log below), across:

| File | Covers |
|---|---|
| `tests/test_models.py` (17) | `Product.validate()` (price, barcode format), stock-status thresholds, `Cart.price()` with a percent discount + member discount + points redemption together, a fixed discount capped at the subtotal, the 50%-discount ceiling, all four loyalty tiers, point-redemption rules (minimum, balance, bill-size cap), `ExchangeRate` conversion (rounded to the nearest 100 ៛) and its 1,000–10,000 valid range, `CashTender` change/shortfall in both USD-only and mixed-currency modes, the `POStatus` state machine (draft→ordered→received, illegal moves rejected), `AttendanceSession.close()` producing Balanced/Shortage, `Task` status transitions and its `__lt__` ordering (urgent-first), `MovementReason` direction guards, `PasswordHasher` policy |
| `tests/test_checkout_service.py` (7) | add-by-id and add-by-barcode, stock-limited quantity + note persistence, discount blocked without `apply_discounts`, a sale blocked with no open shift, a full USD cash sale (stock decrement, loyalty discount, change, drawer cash movement), a KHR cash sale (riel change), points redemption validated against the live cart |
| `tests/test_staff_and_rbac.py` (10) | last-Super-Admin protection (self-deactivate, demote), only a Super Admin can grant the Super Admin role, duplicate email / weak password rejected, deactivation blocked while a shift is open, delete blocked once a staff member has sales/shift history, the Super Admin role's protected permissions, clock-in/out producing a Balanced shift, the float ceiling, manual cash-in/cash-out (including "not enough in the drawer"), and a manager-only task-cancel permission check |
| `tests/test_purchase_orders.py` (4) | duplicate product lines merge into one, the supplier is required, place→receive increases stock and writes a ledger row, a draft/cancelled order can't be received, and an expected date can't be in the past |

## Running just one thing

```bash
pytest tests/test_checkout_service.py -k khr -v
```

## Evidence from this build

The commands below were run against this exact codebase before packaging:

```
$ python -m compileall app run.py tests    # → no output = every file compiles
$ pytest                                   # → 42 passed
```

A companion route-crawl (not part of the shipped test suite, since it needs a
database) logged into every one of the four roles and requested every `GET`
route — 0 server errors — then walked through the full POST lifecycle:
clock-in → add product by barcode → set a line note → attach a loyalty
member → redeem points → complete a USD cash sale → complete a KHR cash sale
→ hold and resume a cart → refund from the processing cashier's own drawer →
clock-out with a Balanced result → create/edit/deactivate/reactivate/delete a
staff account → add and delete a shift template → create/move/delete a task
→ draft → place → receive a purchase order (stock increased correctly) →
edit the role matrix (both as Admin and as Super Admin) → grant an individual
permission override → switch users → lock/unlock the terminal → change the
exchange rate → export both CSV and Excel reports. All of it completed
without a server error.

## Manual test checklist (for the required screenshots)

If your rubric wants ≥10 documented manual cases with screenshots, these map
onto the automated evidence above and are quick to re-run by hand:

1. Log in as each of the 4 demo roles; confirm the sidebar only shows what
   that role can do.
2. Try a URL your role doesn't have permission for → custom 403 page.
3. Add a product with a duplicate SKU or barcode → rejected with a message.
4. Sell a product down to 0 stock, then try to sell one more → rejected.
5. Complete a cash sale in KHR and confirm the change shown in riel.
6. Redeem loyalty points on a sale and confirm the discount line and the
   member's points balance afterward.
7. Refund part of a sale twice; confirm the second refund can't exceed what's
   left.
8. Deactivate a staff member with an open shift → blocked until closed.
9. Reactivate a deactivated staff member and log in as them again.
10. Receive a purchase order and confirm stock and the stock ledger both
    updated.
11. Close a cash drawer with a counted amount different from expected →
    Overage/Shortage shown and recorded.
12. Edit the role matrix as Admin, then try to edit the Super Admin row (only
    a Super Admin can).
