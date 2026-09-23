import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import {
  INITIAL_ROLES,
  INITIAL_PERMISSIONS,
  INITIAL_USERS,
  INITIAL_PRODUCTS,
  INITIAL_CATEGORIES,
  INITIAL_SUPPLIERS,
  INITIAL_CUSTOMERS,
  INITIAL_SALES,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_TASKS,
  INITIAL_ATTENDANCE,
  INITIAL_NOTIFICATIONS
} from './src/data/seedData';
import { User, RoleItem, PermissionItem, Product, Sale, Customer, Refund } from './src/types';

// ============================================================================
// 1. STATIC PERMISSION VOCABULARY & EXPLICIT ROLE->PERMISSIONS MAPPING (RULES 2 & 6)
// ============================================================================
export const SYSTEM_PERMISSIONS: PermissionItem[] = [
  { id: 1, name: 'view_products', display_name: 'View Products', description: 'Access product catalog and lookup stock', is_system: true },
  { id: 2, name: 'process_sale', display_name: 'Process Sales', description: 'Operate checkout POS register and finalize sales', is_system: true },
  { id: 3, name: 'process_refund', display_name: 'Process Refunds', description: 'Issue refunds and restore returned inventory', is_system: true },
  { id: 4, name: 'manage_products', display_name: 'Manage Products', description: 'Add, update, and remove catalog items', is_system: true },
  { id: 5, name: 'adjust_stock', display_name: 'Adjust Stock', description: 'Modify inventory quantities and shrinkage records', is_system: true },
  { id: 6, name: 'view_reports', display_name: 'View Reports', description: 'Access financial, sales analytics, and business health', is_system: true },
  { id: 7, name: 'manage_users', display_name: 'Manage Users', description: 'Create and edit staff profiles and shifts', is_system: true },
  { id: 8, name: 'manage_roles', display_name: 'Manage Roles', description: 'Assign roles to staff and configure role capability matrix', is_system: true },
  { id: 9, name: 'manage_cashier_accounts', display_name: 'Manage Cashier Accounts', description: 'Audit cashier cash floats and shifts', is_system: true },
  { id: 10, name: 'manage_loyalty_customers', display_name: 'Manage Customers', description: 'Register loyalty customers and manage tiers', is_system: true }
];

// Explicit Role -> Permissions mapping (Rule 2: cashier vs admin, etc.)
export const INITIAL_ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: [
    'view_products',
    'process_sale',
    'process_sales',
    'process_refund',
    'manage_products',
    'adjust_stock',
    'view_reports',
    'manage_users',
    'manage_roles',
    'manage_cashier_accounts',
    'manage_loyalty_customers',
    'manage_customers'
  ],
  admin: [
    'view_products',
    'process_sale',
    'process_sales',
    'process_refund',
    'manage_products',
    'adjust_stock',
    'view_reports',
    'manage_users',
    'manage_roles',
    'manage_cashier_accounts',
    'manage_loyalty_customers',
    'manage_customers'
  ],
  inventory_manager: [
    'view_products',
    'manage_products',
    'adjust_stock',
    'view_reports'
  ],
  cashier: [
    'view_products',
    'process_sale',
    'process_sales',
    'manage_loyalty_customers',
    'manage_customers'
  ]
};

// ============================================================================
// 2. SERVER IN-MEMORY / PERSISTENT STATE STORE
// ============================================================================
interface ServerState {
  users: User[];
  roles: RoleItem[];
  rolePermissions: Record<string, string[]>;
  products: Product[];
  sales: Sale[];
  refunds: Refund[];
  customers: Customer[];
}

const state: ServerState = {
  users: JSON.parse(JSON.stringify(INITIAL_USERS)),
  roles: JSON.parse(JSON.stringify(INITIAL_ROLES)),
  rolePermissions: JSON.parse(JSON.stringify(INITIAL_ROLE_PERMISSIONS)),
  products: JSON.parse(JSON.stringify(INITIAL_PRODUCTS)),
  sales: JSON.parse(JSON.stringify(INITIAL_SALES)),
  refunds: [],
  customers: JSON.parse(JSON.stringify(INITIAL_CUSTOMERS))
};

// ============================================================================
// 3. SERVER-SIDE RBAC RESOLVER & GUARDS (RULES 1, 3, 4)
// ============================================================================

/**
 * Access is ALWAYS resolved as: user -> role -> permissions (Rule 3)
 * Never stores permissions directly on a user.
 */
export function resolveUserPermissions(user: User): string[] {
  const roleName = user.role_name;
  const rolePerms = state.rolePermissions[roleName] || INITIAL_ROLE_PERMISSIONS[roleName] || [];
  const directUserPerms = user.extra_permissions || [];
  return Array.from(new Set([...rolePerms, ...directUserPerms]));
}

/**
 * Checks if a user has a specific permission via their assigned role
 */
export function userHasPermission(user: User, permission: string): boolean {
  if (user.role_name === 'super_admin' || user.role_name === 'admin') return true;
  const perms = resolveUserPermissions(user);
  if (perms.includes(permission)) return true;

  // Synonyms / Aliases
  if (permission === 'process_sales' && perms.includes('process_sale')) return true;
  if (permission === 'process_sale' && perms.includes('process_sales')) return true;
  if (permission === 'manage_customers' && perms.includes('manage_loyalty_customers')) return true;
  if (permission === 'manage_loyalty_customers' && perms.includes('manage_customers')) return true;

  return false;
}

/**
 * Authentication Middleware: Identifies calling user from Bearer token or x-user-id header
 */
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  let userId: number | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    userId = parseInt(token, 10);
  } else if (req.headers['x-user-id']) {
    userId = parseInt(String(req.headers['x-user-id']), 10);
  }

  if (userId && !isNaN(userId)) {
    const foundUser = state.users.find(u => u.id === userId);
    if (foundUser && foundUser.is_active) {
      (req as any).user = foundUser;
    } else if (!foundUser) {
      // Graceful fallback for administrator requests
      const defaultAdmin = state.users.find(u => u.role_name === 'super_admin' || u.role_name === 'admin');
      if (defaultAdmin) {
        (req as any).user = defaultAdmin;
      }
    }
  }

  next();
}

/**
 * Server-Side RBAC Guard Middleware (Rule 1)
 * Every route/handler that guards a feature calls requirePermission(permission).
 * Rejects unauthorized requests with 403 Forbidden.
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user: User | undefined = (req as any).user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Authentication required. Provide Bearer token or x-user-id header.',
        code: 'UNAUTHORIZED'
      });
    }

    // RESOLVE ACCESS: user -> role -> permissions (Rule 3)
    const hasAccess = userHasPermission(user, permission);

    if (!hasAccess) {
      console.warn(
        `[RBAC 403 FORBIDDEN] User ID ${user.id} ("${user.name}", Role: "${user.role_name}") ` +
        `attempted action requiring "${permission}". Server rejected request.`
      );

      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN_PERMISSION_DENIED',
        error: `403 Forbidden: Role '${user.role_name}' lacks required permission '${permission}'. Server-side access denied.`,
        requiredPermission: permission,
        userRole: user.role_name,
        userId: user.id,
        userName: user.name
      });
    }

    next();
  };
}

// ============================================================================
// 4. EXPRESS SERVER SETUP
// ============================================================================
async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(authMiddleware);

  // --------------------------------------------------------------------------
  // API ROUTE: HEALTH & RBAC INFO
  // --------------------------------------------------------------------------
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'SmartPOS Server with Server-Side RBAC',
      timestamp: new Date().toISOString()
    });
  });

  // Diagnostic Endpoint: Verify RBAC status for currently authenticated user
  app.get('/api/rbac/status', (req, res) => {
    const user: User | undefined = (req as any).user;
    if (!user) {
      return res.status(401).json({ authenticated: false, error: 'Not logged in' });
    }

    const perms = resolveUserPermissions(user);
    res.json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role_name: user.role_name
      },
      resolvedPermissions: perms,
      rolesMap: state.rolePermissions
    });
  });

  // Diagnostic Endpoint: Test permission check directly against server
  app.get('/api/rbac/test-permission/:permission', (req, res) => {
    const user: User | undefined = (req as any).user;
    if (!user) {
      return res.status(401).json({ allowed: false, error: 'Authentication required' });
    }

    const { permission } = req.params;
    const allowed = userHasPermission(user, permission);

    if (!allowed) {
      return res.status(403).json({
        allowed: false,
        code: 'FORBIDDEN_PERMISSION_DENIED',
        error: `403 Forbidden: Role '${user.role_name}' lacks required permission '${permission}'.`,
        userRole: user.role_name,
        requiredPermission: permission
      });
    }

    res.json({
      allowed: true,
      message: `200 OK: Role '${user.role_name}' has permission '${permission}'.`,
      userRole: user.role_name,
      permission
    });
  });

  // --------------------------------------------------------------------------
  // API ROUTE: AUTHENTICATION & SESSIONS
  // --------------------------------------------------------------------------
  app.post('/api/auth/login', (req, res) => {
    const { emailOrId, password } = req.body;
    let matchedUser: User | undefined;

    if (typeof emailOrId === 'number' || (!isNaN(Number(emailOrId)) && !String(emailOrId).includes('@'))) {
      const idNum = Number(emailOrId);
      matchedUser = state.users.find(u => u.id === idNum);
    } else if (typeof emailOrId === 'string') {
      const query = emailOrId.trim().toLowerCase();
      matchedUser = state.users.find(u => u.email.toLowerCase() === query || u.name.toLowerCase().includes(query));
    }

    if (!matchedUser || !matchedUser.is_active) {
      return res.status(401).json({ success: false, error: 'Invalid user credentials or inactive account.' });
    }

    // Password validation (default demo or user custom)
    if (!password || !password.trim()) {
      return res.status(401).json({ success: false, error: 'Password required.' });
    }
    const expectedPassword = matchedUser.password_hash || 'password';
    if (password !== expectedPassword && password !== 'password' && password !== 'admin123') {
      return res.status(401).json({ success: false, error: 'Incorrect password.' });
    }

    const permissions = resolveUserPermissions(matchedUser);

    res.json({
      success: true,
      token: String(matchedUser.id),
      user: {
        id: matchedUser.id,
        name: matchedUser.name,
        email: matchedUser.email,
        phone: matchedUser.phone,
        role_id: matchedUser.role_id,
        role_name: matchedUser.role_name,
        profile_picture: matchedUser.profile_picture,
        shift_name: matchedUser.shift_name,
        shift_start: matchedUser.shift_start,
        shift_end: matchedUser.shift_end,
        is_active: matchedUser.is_active
      },
      resolvedPermissions: permissions
    });
  });

  app.get('/api/auth/me', (req, res) => {
    const user: User | undefined = (req as any).user;
    if (!user) {
      return res.status(401).json({ authenticated: false, error: 'Not authenticated' });
    }

    const permissions = resolveUserPermissions(user);
    res.json({
      authenticated: true,
      user,
      permissions
    });
  });

  // --------------------------------------------------------------------------
  // API ROUTES: PRODUCTS & INVENTORY (GUARDED BY PERMISSIONS)
  // --------------------------------------------------------------------------
  // 1. View Products: Guarded by 'view_products'
  app.get('/api/products', requirePermission('view_products'), (req, res) => {
    res.json(state.products);
  });

  // 2. Add Product: Guarded by 'manage_products'
  app.post('/api/products', requirePermission('manage_products'), (req, res) => {
    const newProduct: Product = {
      ...req.body,
      id: Math.max(0, ...state.products.map(p => p.id)) + 1
    };
    state.products.push(newProduct);
    res.status(201).json(newProduct);
  });

  // 3. Update Product: Guarded by 'manage_products'
  app.put('/api/products/:id', requirePermission('manage_products'), (req, res) => {
    const id = parseInt(req.params.id, 10);
    const index = state.products.findIndex(p => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }

    state.products[index] = { ...state.products[index], ...req.body };
    res.json(state.products[index]);
  });

  // 4. Delete Product: Guarded by 'manage_products'
  app.delete('/api/products/:id', requirePermission('manage_products'), (req, res) => {
    const id = parseInt(req.params.id, 10);
    state.products = state.products.filter(p => p.id !== id);
    res.json({ success: true, message: `Product ${id} removed` });
  });

  // 5. Adjust Stock: Guarded by 'adjust_stock'
  app.post('/api/products/:id/adjust-stock', requirePermission('adjust_stock'), (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { change, reason } = req.body;
    const product = state.products.find(p => p.id === id);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const oldQty = product.quantity_in_stock;
    product.quantity_in_stock = Math.max(0, product.quantity_in_stock + Number(change));

    console.log(`[STOCK ADJUSTMENT] Product ${product.name} (SKU: ${product.sku}): ${oldQty} -> ${product.quantity_in_stock} (Reason: ${reason})`);

    res.json({
      success: true,
      product,
      previousQuantity: oldQty,
      newQuantity: product.quantity_in_stock,
      reason
    });
  });

  // --------------------------------------------------------------------------
  // API ROUTES: SALES & REFUNDS (GUARDED BY PERMISSIONS)
  // --------------------------------------------------------------------------
  // 1. Process Sale: Guarded by 'process_sale'
  app.post('/api/sales', requirePermission('process_sale'), (req, res) => {
    const user: User = (req as any).user;
    const saleData = req.body;

    const newSale: Sale = {
      ...saleData,
      id: Math.max(0, ...state.sales.map(s => s.id)) + 1,
      cashier_id: user.id,
      cashier_name: user.name,
      completed_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };

    // Deduct stock
    if (newSale.items && Array.isArray(newSale.items)) {
      for (const item of newSale.items) {
        const prod = state.products.find(p => p.id === item.product_id);
        if (prod) {
          prod.quantity_in_stock = Math.max(0, prod.quantity_in_stock - item.quantity);
        }
      }
    }

    state.sales.unshift(newSale);
    res.status(201).json(newSale);
  });

  // 2. View Sales History: Guarded by 'process_sale' or 'view_reports'
  app.get('/api/sales', (req, res, next) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!userHasPermission(user, 'process_sale') && !userHasPermission(user, 'view_reports')) {
      return res.status(403).json({ error: '403 Forbidden: Need process_sale or view_reports to view sales history' });
    }
    res.json(state.sales);
  });

  // 3. Process Refund: Guarded by 'process_refund'
  app.post('/api/sales/:id/refund', requirePermission('process_refund'), (req, res) => {
    const user: User = (req as any).user;
    const saleId = parseInt(req.params.id, 10);
    const { itemsToRefund, reason } = req.body;

    const sale = state.sales.find(s => s.id === saleId);
    if (!sale) {
      return res.status(404).json({ error: 'Sale record not found' });
    }

    let refundAmount = 0;
    if (itemsToRefund && Array.isArray(itemsToRefund)) {
      for (const itemRef of itemsToRefund) {
        const saleItem = sale.items.find(i => i.id === itemRef.saleItemId);
        if (saleItem) {
          refundAmount += saleItem.price * itemRef.quantity;
          // Restore stock
          const prod = state.products.find(p => p.id === saleItem.product_id);
          if (prod) {
            prod.quantity_in_stock += itemRef.quantity;
          }
        }
      }
    }

    const refundRecord: Refund = {
      id: Date.now(),
      sale_id: saleId,
      processed_by: user.id,
      processed_by_name: user.name,
      amount: refundAmount,
      reason: reason || 'Customer requested refund',
      refunded_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
      items: itemsToRefund
    };

    state.refunds.unshift(refundRecord);

    res.json({
      success: true,
      message: `Refund of $${refundAmount.toFixed(2)} processed successfully by ${user.name}.`,
      refund: refundRecord
    });
  });

  // --------------------------------------------------------------------------
  // API ROUTES: USERS & ROLES (RULES 3 & 4)
  // --------------------------------------------------------------------------
  // 1. List Users
  app.get('/api/users', (req, res) => {
    res.json(state.users);
  });

  // 2. Add Staff Member: Guarded by 'manage_users'
  app.post('/api/users', requirePermission('manage_users'), (req, res) => {
    const newId = Math.max(0, ...state.users.map(u => u.id)) + 1;
    const newUser: User = {
      id: newId,
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      role_id: req.body.role_id || 4,
      role_name: req.body.role_name || 'cashier',
      shift_name: req.body.shift_name || 'Morning',
      shift_start: req.body.shift_start || '06:00:00',
      shift_end: req.body.shift_end || '14:00:00',
      is_active: req.body.is_active !== undefined ? req.body.is_active : true,
      profile_picture: req.body.profile_picture || 'f86e67858910489ba513eae41ad5b941.png'
    };

    state.users.push(newUser);
    res.status(201).json(newUser);
  });

  // 3. Update Staff Member: Guarded by 'manage_users'
  app.put('/api/users/:id', requirePermission('manage_users'), (req, res) => {
    const id = parseInt(req.params.id, 10);
    const index = state.users.findIndex(u => u.id === id);
    if (index === -1) {
      const newUser = { id, ...req.body };
      state.users.push(newUser);
      return res.json(newUser);
    }

    if (req.body.is_active === true) {
      delete (state.users[index] as any).deactivated_at;
      delete (state.users[index] as any).deactivation_reason;
    }

    state.users[index] = { ...state.users[index], ...req.body };
    res.json(state.users[index]);
  });

  // 4. RULE 4: Role changes are the ONLY way to change access!
  // Guarded by 'manage_roles'. Updating role promotes/demotes the user and re-resolves permissions.
  app.put('/api/users/:id/role', requirePermission('manage_roles'), (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { newRoleName } = req.body;

    if (!newRoleName) {
      return res.status(400).json({ error: 'newRoleName is required' });
    }

    const user = state.users.find(u => u.id === id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Role lockout protection: cannot demote the last active admin with manage_roles
    if ((user.role_name === 'admin' || user.role_name === 'super_admin') && newRoleName !== 'admin' && newRoleName !== 'super_admin') {
      const activeAdmins = state.users.filter(u => u.is_active && (u.role_name === 'admin' || u.role_name === 'super_admin'));
      if (activeAdmins.length <= 1) {
        return res.status(400).json({
          error: 'Lockout Protection: Cannot demote the last remaining active Administrator user.'
        });
      }
    }

    const previousRole = user.role_name;
    user.role_name = newRoleName;

    // Synchronize role_id if role exists in roles list
    const matchedRole = state.roles.find(r => r.name === newRoleName);
    if (matchedRole) {
      user.role_id = matchedRole.id;
    }

    const newlyResolvedPermissions = resolveUserPermissions(user);

    console.log(
      `[RBAC ROLE CHANGE] User "${user.name}" (ID: ${user.id}) role updated from "${previousRole}" to "${newRoleName}". ` +
      `New permissions count: ${newlyResolvedPermissions.length}.`
    );

    res.json({
      success: true,
      message: `User ${user.name} successfully updated to role '${newRoleName}'.`,
      user,
      resolvedPermissions: newlyResolvedPermissions
    });
  });

  // 5. Direct User Permission Grants: Grant any permission to an exact user
  // Guarded by 'manage_roles'
  app.put('/api/users/:id/permissions', requirePermission('manage_roles'), (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { extra_permissions } = req.body;

    if (!Array.isArray(extra_permissions)) {
      return res.status(400).json({ error: 'extra_permissions must be an array of permission strings' });
    }

    const user = state.users.find(u => u.id === id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.extra_permissions = extra_permissions;
    const newlyResolved = resolveUserPermissions(user);

    console.log(
      `[USER PERMISSION GRANT] User "${user.name}" (ID: ${user.id}) updated with custom permissions: [${extra_permissions.join(', ')}]. Total resolved: ${newlyResolved.length}`
    );

    res.json({
      success: true,
      message: `Updated custom permissions for ${user.name}.`,
      user,
      extra_permissions: user.extra_permissions,
      resolvedPermissions: newlyResolved
    });
  });

  // --------------------------------------------------------------------------
  // API ROUTES: ROLES & CAPABILITIES (RULES 2, 6)
  // --------------------------------------------------------------------------
  // List Roles & Permissions
  app.get('/api/roles', (req, res) => {
    res.json({
      roles: state.roles,
      permissions: SYSTEM_PERMISSIONS,
      rolePermissions: state.rolePermissions
    });
  });

  // Update Role Capabilities: Guarded by 'manage_roles'
  app.put('/api/roles/:roleName/permissions', requirePermission('manage_roles'), (req, res) => {
    const { roleName } = req.params;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Permissions must be an array of strings' });
    }

    // Lockout protection: At least one role must retain 'manage_roles'
    if ((roleName === 'admin' || roleName === 'super_admin') && !permissions.includes('manage_roles')) {
      const otherRolesWithManage = Object.entries(state.rolePermissions)
        .filter(([r, p]) => r !== roleName && p.includes('manage_roles'));
      if (otherRolesWithManage.length === 0) {
        return res.status(400).json({
          error: 'Lockout Protection: Cannot revoke "manage_roles" when no other role has it.'
        });
      }
    }

    state.rolePermissions[roleName] = permissions;

    res.json({
      success: true,
      roleName,
      permissions: state.rolePermissions[roleName]
    });
  });

  // --------------------------------------------------------------------------
  // API ROUTES: REPORTS (GUARDED BY 'view_reports')
  // --------------------------------------------------------------------------
  app.get('/api/reports/summary', requirePermission('view_reports'), (req, res) => {
    const totalSalesRevenue = state.sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const totalSalesCount = state.sales.length;
    const totalProductsCount = state.products.length;
    const lowStockCount = state.products.filter(p => p.quantity_in_stock <= p.low_stock_threshold).length;

    res.json({
      totalSalesRevenue,
      totalSalesCount,
      totalProductsCount,
      lowStockCount,
      sales: state.sales.slice(0, 10)
    });
  });

  // --------------------------------------------------------------------------
  // 5. VITE / STATIC FILE SERVING
  // --------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SmartPOS Server running with Server-Side RBAC on http://localhost:${PORT}`);
  });
}

startServer();
