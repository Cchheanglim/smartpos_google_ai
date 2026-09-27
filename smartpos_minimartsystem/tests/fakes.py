"""In-memory fake repositories used by the unit tests."""
from contextlib import nullcontext
from dataclasses import replace
from decimal import Decimal

from app.models.auth.permission import Permission
from app.models.auth.role import Role
from app.models.auth.user import User
from app.models.inventory.category import Category
from app.models.inventory.product import Product
from app.models.inventory.supplier import Supplier
from app.models.sales.customer import Customer
from app.models.staff.shift import Shift


def no_tx():
    """Stand-in for extensions.transaction() — does nothing."""
    return nullcontext()


def make_user(uid=1, role="admin", active=True, password_hash="") -> User:
    role_id = {"super_admin": 1, "admin": 2, "inventory_manager": 3, "cashier": 4}.get(role, 2)
    return User(id=uid, name=f"User {uid}", email=f"user{uid}@test.local", role_id=role_id,
                role_name=role, role_display_name=role.replace("_", " ").title(),
                password_hash=password_hash, active=active)


def make_product(pid=1, price="2.00", cost="1.00", stock=10, sku=None, barcode=None) -> Product:
    return Product(id=pid, sku=sku or f"PRD-{pid:03d}", name=f"Product {pid}", price=Decimal(price),
                   cost=Decimal(cost), quantity_in_stock=stock, low_stock_threshold=2, barcode=barcode)


class FakeProductRepo:
    def __init__(self, *products: Product):
        self.items = {p.id: p for p in products}
        self.with_sales: set[int] = set()
        self.deleted: list[int] = []

    def find_by_id(self, pid):
        return replace(self.items[pid]) if pid in self.items else None

    def find_many(self, ids):
        return [replace(self.items[i]) for i in ids if i in self.items]

    def find_by_sku(self, sku):
        return next((replace(p) for p in self.items.values() if p.sku == sku), None)

    def find_by_barcode(self, barcode):
        return next((replace(p) for p in self.items.values() if p.barcode == barcode), None)

    def find_by_scan_code(self, code):
        return next((replace(p) for p in self.items.values() if p.barcode == code or p.sku == code), None)

    def list_by_supplier(self, supplier_id):
        return [replace(p) for p in self.items.values()]

    def max_sku_number(self):
        return max((int(p.sku.split("-")[1]) for p in self.items.values()), default=0)

    def create(self, product):
        new_id = max(self.items, default=0) + 1
        product.id = new_id
        self.items[new_id] = product
        return new_id

    def update(self, product):
        self.items[product.id] = product
        return 1

    def delete(self, pid):
        self.deleted.append(pid)
        return 1 if self.items.pop(pid, None) else 0

    def has_sales(self, pid):
        return pid in self.with_sales

    def adjust_stock(self, pid, change):
        product = self.items[pid]
        if product.quantity_in_stock + change < 0:
            return 0
        product.quantity_in_stock += change
        return 1


class FakeStockRepo:
    def __init__(self):
        self.rows: list[tuple] = []

    def create(self, product_id, change, reason, note, user_id):
        self.rows.append((product_id, change, reason, note, user_id))
        return len(self.rows)

    def list_filtered(self, reason="", product_id=None, limit=100):
        return []


class FakeCategoryRepo:
    def __init__(self, *ids: int):
        self.items = {i: Category(id=i, name=f"Cat {i}") for i in ids}

    def find_by_id(self, cid):
        return self.items.get(cid)

    def list_all(self):
        return list(self.items.values())


class FakeSupplierRepo:
    def __init__(self, *ids: int):
        self.items = {i: Supplier(id=i, name=f"Supplier {i}") for i in ids}

    def find_by_id(self, sid):
        return self.items.get(sid)

    def list_all(self):
        return list(self.items.values())


class FakeImageStorage:
    def save(self, file):
        return None


class FakeCustomerRepo:
    def __init__(self, *customers: Customer):
        self.items = {c.phone: c for c in customers}
        self.purchases: list[tuple] = []
        self.reversals: list[tuple] = []

    def find_by_phone(self, phone):
        return self.items.get(phone)

    def add_purchase(self, cid, amount, points_earned, points_spent=0):
        self.purchases.append((cid, amount, points_earned, points_spent))
        for c in self.items.values():
            if c.id == cid:
                if c.points < points_spent:
                    return 0
                c.points = c.points - points_spent + points_earned
        return 1

    def reverse_purchase(self, cid, amount, points):
        self.reversals.append((cid, amount, points))


class FakeSaleRepo:
    def __init__(self, sale=None):
        self.sale = sale
        self.created = []
        self.items = []

    def create(self, sale):
        self.created.append(sale)
        return 500 + len(self.created)

    def add_item(self, sale_id, item):
        self.items.append(item)
        return len(self.items)

    def find_with_items(self, sale_id):
        return self.sale if self.sale and self.sale.id == sale_id else None

    def add_refunded_quantity(self, item_id, qty):
        for item in self.sale.items:
            if item.id == item_id and item.refunded_quantity + qty <= item.quantity:
                item.refunded_quantity += qty
                return 1
        return 0


class FakeRefundRepo:
    def __init__(self):
        self.refunds, self.items = [], []

    def create(self, refund):
        self.refunds.append(refund)
        return len(self.refunds)

    def add_item(self, refund_id, item):
        self.items.append(item)


class FakeAuthService:
    """Grants a fixed set of permission names to every user."""

    def __init__(self, *perms: str):
        self.perms = set(perms)

    def has_permission(self, user, name):
        return name in self.perms

    def permissions_for(self, user):
        return set(self.perms)


class FakeAttendanceRepo:
    def __init__(self):
        self.open_by_user: dict[int, object] = {}
        self.movements: dict[int, list] = {}
        self.next_id = 1
        self.closed: list = []

    def find_open_for(self, user_id):
        return self.open_by_user.get(user_id)

    def open_session(self, user_id, opening_float, notes=""):
        from app.models.staff.attendance import AttendanceSession
        session = AttendanceSession(id=self.next_id, user_id=user_id, opening_float=opening_float, notes=notes)
        from datetime import datetime
        session.clock_in = datetime.now()
        self.open_by_user[user_id] = session
        self.movements[self.next_id] = []
        self.next_id += 1
        return session.id

    def add_movement(self, attendance_id, kind, amount, reference="", created_by=None):
        self.movements.setdefault(attendance_id, []).append((kind, amount, reference, created_by))
        return len(self.movements[attendance_id])

    def drawer_balance(self, attendance_id):
        return sum((m[1] for m in self.movements.get(attendance_id, [])), Decimal("0.00"))

    def close(self, session, closed_by):
        for uid, s in list(self.open_by_user.items()):
            if s.id == session.id:
                del self.open_by_user[uid]
                self.closed.append(session)
                return 1
        return 0

    def find_by_id(self, attendance_id):
        for s in list(self.open_by_user.values()) + self.closed:
            if s.id == attendance_id:
                return s
        return None

    def list_open(self):
        return list(self.open_by_user.values())

    def search(self, user_id=None, status="", limit=100):
        return list(self.open_by_user.values()) + self.closed

    def movements_for(self, attendance_id):
        return []

    def total_cash_in_drawers(self):
        return sum((self.drawer_balance(s.id) for s in self.open_by_user.values()), Decimal("0.00"))


class FakeAuditRepo:
    def __init__(self):
        self.entries: list[tuple] = []

    def record(self, user_id, action, details=""):
        self.entries.append((user_id, action, details))
        return len(self.entries)


class FakeUserRepo:
    def __init__(self, *users: User):
        self.items = {u.id: u for u in users}
        self.passwords: dict[int, str] = {}

    def find_by_id(self, uid):
        return self.items.get(uid)

    def find_by_email(self, email):
        return next((u for u in self.items.values() if u.email == email), None)

    def count_active_in_role(self, role_name):
        return sum(1 for u in self.items.values() if u.role_name == role_name and u.is_active)

    def update(self, user):
        self.items[user.id] = user

    def update_password(self, uid, password_hash):
        self.passwords[uid] = password_hash

    def set_active(self, user_id, active, reason=None):
        self.items[user_id].active = active
        self.items[user_id].deactivation_reason = reason

    def clear_avatar(self, uid):
        self.items[uid].avatar_filename = None

    def create(self, user):
        new_id = max(self.items, default=0) + 1
        user.id = new_id
        self.items[new_id] = user
        return new_id

    def delete(self, uid):
        self.items.pop(uid, None)

    def has_history(self, uid):
        return False

    def list_active(self):
        return [u for u in self.items.values() if u.is_active]

    def search(self, term="", role_id=None, active=None):
        return list(self.items.values())


class FakeRoleRepo:
    def __init__(self, *roles: Role, perms_by_role: dict | None = None):
        self.items = {r.id: r for r in roles}
        self.perms_by_role = perms_by_role or {}
        self.replaced: dict[int, list[int]] = {}
        self.next_id = max(self.items, default=0) + 1

    def find_by_id(self, rid):
        role = self.items.get(rid)
        if role is not None:
            role.permission_names = self.permission_names_for_role(rid)
        return role

    def find_by_name(self, name):
        return next((r for r in self.items.values() if r.name == name), None)

    def list_all(self):
        return list(self.items.values())

    def permission_names_for_role(self, rid):
        return set(self.perms_by_role.get(rid, set()))

    def replace_permissions(self, rid, perm_ids):
        self.replaced[rid] = perm_ids
        self.perms_by_role[rid] = set(perm_ids)

    def create(self, role):
        role.id = self.next_id
        self.items[self.next_id] = role
        self.next_id += 1
        return role.id

    def delete(self, rid):
        self.items.pop(rid, None)


class FakePermissionRepo:
    def __init__(self, names: dict[int, str] | None = None):
        self.names = names or {}
        self.overrides: dict[int, set[int]] = {}
        self.next_id = max(self.names, default=0) + 1

    def list_all(self):
        return [Permission(id=i, name=n, display_name=n) for i, n in self.names.items()]

    def find_by_name(self, name):
        pid = next((i for i, n in self.names.items() if n == name), None)
        return Permission(id=pid, name=name, display_name=name) if pid is not None else None

    def names_for_user(self, user_id):
        ids = self.overrides.get(user_id, set())
        return {self.names[i] for i in ids if i in self.names}

    def replace_user_permissions(self, user_id, permission_ids, granted_by):
        self.overrides[user_id] = set(permission_ids)

    def create(self, permission):
        permission.id = self.next_id
        self.names[self.next_id] = permission.name
        self.next_id += 1
        return permission.id


class FakeShiftRepo:
    def __init__(self, *shifts: Shift):
        self.items = {s.id: s for s in shifts}
        self.next_id = max([s.id for s in shifts], default=0) + 1

    def find_by_id(self, sid):
        return self.items.get(sid)

    def find_by_name(self, name):
        return next((s for s in self.items.values() if s.name == name), None)

    def list_all(self):
        return list(self.items.values())

    def create(self, shift):
        shift.id = self.next_id
        self.items[self.next_id] = shift
        self.next_id += 1
        return shift.id

    def update(self, shift):
        self.items[shift.id] = shift

    def delete(self, sid):
        self.items.pop(sid, None)


class FakeTaskRepo:
    def __init__(self):
        self.items: dict[int, object] = {}
        self.next_id = 1

    def find_by_id(self, tid):
        return self.items.get(tid)

    def search(self, assigned_to=None, assigned_by=None, status="", priority=""):
        rows = list(self.items.values())
        if assigned_to:
            rows = [t for t in rows if t.assigned_to == assigned_to]
        if assigned_by:
            rows = [t for t in rows if t.assigned_by == assigned_by]
        if priority:
            rows = [t for t in rows if t.priority.value == priority]
        return rows

    def count_open_for(self, user_id):
        return sum(1 for t in self.items.values() if t.assigned_to == user_id and not t.status.is_closed)

    def create(self, task):
        task.id = self.next_id
        self.items[self.next_id] = task
        self.next_id += 1
        return task.id

    def update(self, task):
        self.items[task.id] = task

    def delete(self, tid):
        self.items.pop(tid, None)


class FakePurchaseOrderRepo:
    def __init__(self):
        self.items: dict[int, object] = {}
        self.items_by_po: dict[int, list] = {}
        self.next_id = 1

    def find_by_id(self, po_id):
        return replace(self.items[po_id]) if po_id in self.items else None

    def find_with_items(self, po_id):
        po = self.find_by_id(po_id)
        if po:
            po.items = list(self.items_by_po.get(po_id, []))
        return po

    def create(self, po):
        po.id = self.next_id
        self.items[self.next_id] = po
        self.next_id += 1
        return po.id

    def update_header(self, po):
        self.items[po.id] = po

    def replace_items(self, po_id, items):
        self.items_by_po[po_id] = items

    def set_status(self, po_id, current, target, user_id):
        po = self.items[po_id]
        if po.status != current:
            return 0
        po.status = target
        return 1


class FakeHeldOrderRepo:
    def __init__(self):
        self.items: dict[int, object] = {}
        self.next_id = 1

    def find_by_id(self, hid):
        return self.items.get(hid)

    def list_for(self, cashier_id=None):
        rows = list(self.items.values())
        return [o for o in rows if cashier_id is None or o.cashier_id == cashier_id]

    def create(self, order):
        order.id = self.next_id
        self.items[self.next_id] = order
        self.next_id += 1
        return order.id

    def delete(self, hid):
        self.items.pop(hid, None)
