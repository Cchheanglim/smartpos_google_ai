# Presentation Cheat Sheet — SmartPOS Mini-Mart

This is written so you can basically **read it out loud**. Practice it
once or twice and you'll be fine. Don't try to memorize — just understand
the one big idea (the restaurant), and the rest follows naturally.

---

## THE ONE BIG IDEA (say this first)

> "Our app is built like a restaurant. Every request — like adding a
> product to the cart — passes through 4 stations, in order, like an
> assembly line. Each station has ONE job and doesn't do anyone else's
> job."

That's it. That's 90% of what you need to explain. Everything else is
just naming the 4 stations.

---

## THE 4 STATIONS (5-minute explanation)

Draw this on the board if you can, or just say it in order:

```
BROWSER  →  ROUTES  →  SERVICES  →  REPOSITORIES  →  DATABASE
(customer)  (waiter)    (chef)      (the pantry)      (MySQL)
```

Explain each one in one sentence:

1. **Routes = the waiter.**
   Takes your order (the web request), writes it down, and hands it to
   the kitchen. The waiter does **not** cook. In our code: a route just
   reads what the person typed/clicked and calls ONE function. That's
   it — no logic, no math, no database stuff happens here.
   *(Files: `app/routes/`)*

2. **Services = the chef.**
   This is where the actual thinking happens. "Is there enough stock?"
   "What's 10% off $9?" "Is this person allowed to delete a staff
   member?" All the rules of the business live here.
   *(Files: `app/services/`)*

3. **Repositories = the pantry / the fridge.**
   The chef doesn't go digging through the fridge themselves in a messy
   way — they ask the pantry person: "get me 3 tomatoes." The
   repository is the ONLY part of the whole app allowed to write
   database queries (SQL). Nowhere else in the code touches the
   database directly.
   *(Files: `app/repositories/`)*

4. **Database = the actual ingredients.**
   MySQL. Where everything is actually stored — products, sales, staff,
   everything. 23 tables.

**Why does this matter?** (say this if they ask "so what?")
> "Because if we ever want to change HOW we store data — like switching
> databases — we only touch the repository layer. The chef (services)
> never notices. Everything is separated so one change doesn't break
> ten other things."

---

## ONE CONCRETE EXAMPLE (use this if you want to sound smart)

Walk through what happens when a cashier clicks **"Add"** on a product:

1. **Browser** sends "add product #5" to the server.
2. **Route** (`checkout_routes.py`) catches it. It doesn't know anything
   about stock or prices — it just says "hey Service, someone wants to
   add product #5, you handle it."
3. **Service** (`checkout_service.py`) does the actual thinking: "Is
   product #5 in stock? Is the quantity valid?" If something's wrong,
   it stops right here and sends back an error message.
4. **Repository** (`product_repository.py`) is the only one that
   actually runs `SELECT * FROM products WHERE id = 5` against MySQL.
5. The answer travels back up the same chain to the browser.

Say this line, it's a good closer for this part:
> "Every single feature in this app — checkout, refunds, staff
> management, reports — follows this exact same 4-step pattern. Once
> you understand one, you understand all of them."

---

## THE "OOP" WORDS YOUR PROFESSOR WANTS TO HEAR

If this is being graded on Object-Oriented Programming, drop these terms
— you don't need to explain them in depth, just say them confidently:

- **"We used dataclasses"** — plain Python objects that represent real
  things, like a `Product` or a `Sale`. Each one protects itself from
  bad data (e.g. a product can't be saved with a negative price).
- **"We used composition"** — instead of one giant class doing
  everything, each Service is *built out of* smaller pieces (a
  repository, a password hasher, etc.), like Lego blocks snapped
  together.
- **"We used inheritance where it actually made sense"** — every
  Repository class shares one parent class (`BaseRepository`) because
  they all genuinely do the same basic jobs (find one, find all,
  delete).
- **"We used enums for state machines"** — e.g. a Purchase Order can
  only go Draft → Ordered → Received, in that order. The code itself
  refuses to let you skip a step or go backwards.

That's the whole "explain the code" section. Now the demo.

---

## 15-MINUTE DEMO — SUGGESTED ORDER

Don't wing it — follow this order, it tells a story and shows the most
impressive stuff without wasting time.

### 1. Login as different roles (1 min)
Log in as `cashier@smartpos.local` (password `password123`), point out
the sidebar only shows what a cashier can do. Log out, log in as
`superadmin@smartpos.local` — sidebar now shows everything.
> "This is Role-Based Access Control — what you see and can click
> depends on your permissions, enforced by the server, not just hidden
> with CSS."

### 2. POS Checkout — the main event (5 min)
As a cashier:
- Clock in first (My Shift & Drawer) — mention the cash-drawer feature.
- Add a few products by clicking, then scan a barcode with your
  **camera** (open the camera icon) — scan 2–3 items in a row without
  closing it, show it keeps adding items.
- Attach a loyalty customer by phone number, show the member discount
  apply automatically.
- Pick **KHQR** payment, choose a bank — the big QR popup appears.
  Mention: *"this is a demo QR for the project, not a real payment
  link — building a real one needs a signed agreement with each bank."*
- Show **Split payment** — pay part card, part cash, complete the sale.
- Show the printed receipt.

### 3. Refunds (1–2 min)
Log in as an admin/manager, go to Sales History, open the receipt you
just made, refund one item, show the stock went back up.

### 4. Staff & Roles (3 min)
- Staff Management: show deactivating an account (mention: history is
  kept, nothing is deleted).
- Roles & Permissions: create a brand new role live, open its
  **Configure** page, tick a couple of permissions.
- Permission registry: register a new permission code live.

### 5. Purchase Orders (2 min)
Create a draft PO, place it, receive it — show the stock number go up
automatically and mention the stock ledger recorded it.

### 6. Telegram alert (1 min) — good closer, feels "real"
Go to Staff Management, hit **Send test alert**, show your phone
getting the Telegram message live. This always gets a good reaction.

### 7. Reports (1 min)
Open Analytics & Reports, point at the charts, export to Excel to show
the file downloads.

---

## IF SOMETHING BREAKS DURING THE DEMO

Say this, calmly, and move on:
> "That's a great example of why we built this in layers — if
> something's wrong, we know exactly which layer to check instead of
> guessing across the whole app."

Nobody will question it. Practice the demo order once beforehand so you
know roughly what to click.
