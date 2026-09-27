# User Guide

## Signing in

Go to `http://localhost:5000` and sign in with one of the demo accounts
(password for all: `password123`):

| Role | Email | Can do |
|---|---|---|
| Super Admin | `superadmin@smartpos.local` | Everything, including editing the Super Admin role itself |
| Admin | `admin@smartpos.local` | Everything except changing who holds Super Admin permissions |
| Inventory Manager | `inventory@smartpos.local` | Products, stock, categories, suppliers, purchase orders, barcode sheets |
| Cashier | `cashier@smartpos.local` | POS checkout, own shift & drawer, sales history, loyalty customers, tasks |

A fifth account, `dara.retired@smartpos.local`, is seeded **deactivated** so
you can see the "Resigned" state and the reactivate flow without creating one
yourself.

## Running a shift at the register

1. Open **My Shift & Drawer** and clock in with your starting cash float.
2. Go to **POS Checkout**. Add items by clicking a product card or by typing
   a barcode/SKU into the scan box.
3. Click the note icon on a cart line to add something like "no ice".
4. Look up a loyalty member by phone to apply their tier discount, or redeem
   their points (minimum 20, at 5¢ each) with the points field.
5. If you have permission, apply a manual discount (percent or a fixed
   dollar amount, capped at 50%).
6. Choose a payment method. For cash, pick USD, Riel, or mixed, use the
   denomination buttons or type an amount, and choose which currency to give
   change in.
7. **Complete sale.** You land on the printable receipt (with a barcode).
8. To serve someone else mid-sale, **Hold** the cart with a label and
   **Resume** it later from the same panel.
9. At the end of the shift, go back to **My Shift & Drawer**, count the
   physical cash, and **Clock out**. The page shows whether the drawer was
   Balanced, Over, or Short.

## Returns

From **Sales History**, open a receipt and click **Refund**. Enter the
quantity to return per line and a reason. The refund is pro-rated for any
discount/tax that was on the original sale, the stock goes back on the
shelf, and — for a cash sale — the money comes out of *your own* open
drawer.

## Inventory

- **Products & Stock** — search/filter/sort, and open a product to adjust
  its stock with a reason (restock, damaged, breakage, inventory count,
  supplier return, internal use). Every change is written to that product's
  ledger.
- **Stock ledger** (top of the Products page) — every movement across the
  whole catalog, filterable by reason, for waste auditing.
- **Barcode sheet** — printable 38×25mm shelf labels for one product or the
  whole catalog.
- **Purchase Orders** — draft an order with product lines, **Place** it with
  the supplier, then **Receive** it once it arrives; stock and the ledger
  update automatically. Orders can also be **Cancelled** before they're
  received.

## Staff & permissions

- **Staff Management** — add staff, edit their role/shift, reset a
  password, and **Deactivate** (keeps their history) or **Delete** (only
  allowed if they have no sales/shift history yet). A deactivated person
  shows up under the "Resigned" filter with a **Reactivate** link.
  On a staff member's edit page you can also remove an inappropriate profile
  picture and grant them individual permissions on top of their role.
- **Work Shifts** — the Morning/Afternoon/Evening/Night templates staff can
  be assigned to.
- **Roles & Permissions** — the full capability matrix; changing a role here
  changes it for everyone who holds it. The Super Admin role always keeps
  *Manage Staff* and *Manage Roles*, and only a Super Admin can edit the
  Super Admin row.
- **Cash Drawer Audit** — every shift's opening float, expected vs. counted
  cash, and the variance; a manager can force-close a register someone
  forgot to close.

## Tasks

Anyone can see **Tasks**; a manager (with *Assign Staff Tasks*) sees and
assigns every task, a cashier sees only their own. Cards move
Pending → In Progress → Completed; only a manager can cancel one.

## Reports

**Analytics & Reports** shows revenue, net profit, COGS, refunds, a daily
and hourly sales chart, best sellers, revenue by category/payment method,
cashier productivity (including drawer compliance %), and waste by reason.
Export the period as CSV or Excel from the top of the page.

## Terminal controls

- **Switch user** (top of the sidebar) hands the terminal to a colleague
  without ending your own session — enter their password to continue as
  them.
- **Lock** (next to it) locks every page behind your password while your
  shift stays open, for a quick break.

## Currency

Prices are entered and stored in USD. The riel amount shown everywhere uses
the store's exchange rate (`$1 = 4,100 ៛` by default), which an Admin/Super
Admin can change from the currency control on the checkout page.
