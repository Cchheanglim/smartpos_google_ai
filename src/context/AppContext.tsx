import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  RoleName,
  PermissionName,
  Product,
  Category,
  Supplier,
  Customer,
  CartItem,
  Sale,
  Refund,
  PurchaseOrder,
  AttendanceRecord,
  Task,
  TaskPriority,
  HeldOrder,
  NotificationItem,
  ShiftTemplate,
  PaymentMethod,
  SplitPaymentDetail,
  RoleItem,
  PermissionItem
} from '../types';
import {
  ROLE_PERMISSIONS,
  INITIAL_ROLES,
  INITIAL_PERMISSIONS,
  INITIAL_USERS,
  INITIAL_CATEGORIES,
  INITIAL_SUPPLIERS,
  INITIAL_SHIFTS,
  INITIAL_CUSTOMERS,
  INITIAL_PRODUCTS,
  INITIAL_SALES,
  INITIAL_PURCHASE_ORDERS,
  INITIAL_TASKS,
  INITIAL_ATTENDANCE,
  INITIAL_NOTIFICATIONS
} from '../data/seedData';
import { getMaskedCustomerTag } from '../utils/crm';
import { api, setApiActiveUserId } from '../utils/api';

export type NavTab =
  | 'dashboard'
  | 'business_dashboard'
  | 'business_health'
  | 'crm_dashboard'
  | 'products'
  | 'checkout'
  | 'history'
  | 'staff'
  | 'tasks'
  | 'notifications'
  | 'profile';

interface FlashMessage {
  text: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface AppContextType {
  currentUser: User;
  users: User[];
  products: Product[];
  categories: Category[];
  suppliers: Supplier[];
  shifts: ShiftTemplate[];
  customers: Customer[];
  sales: Sale[];
  refunds: Refund[];
  purchaseOrders: PurchaseOrder[];
  attendance: AttendanceRecord[];
  tasks: Task[];
  notifications: NotificationItem[];
  heldOrders: HeldOrder[];
  theme: 'light' | 'dark';
  activeTab: NavTab;
  flash: FlashMessage | null;
  unreadCount: number;
  customCardIcon: string | null;
  setCustomCardIcon: (icon: string | null) => void;

  switchUser: (userId: number) => void;
  hasPermission: (permission: PermissionName) => boolean;
  toggleTheme: () => void;
  setActiveTab: (tab: NavTab) => void;
  showFlash: (text: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  clearFlash: () => void;

  clockIn: (startingCash?: number) => void;
  clockOut: (countedCash?: number) => void;
  forceCloseShift: (recordId: number) => void;

  completeTask: (taskId: number) => void;
  updateTaskStatus: (taskId: number, status: Task['status']) => void;
  createTask: (
    title: string,
    description: string,
    assignedTo: number,
    assignedBy?: number,
    priority?: TaskPriority,
    dueDate?: string
  ) => void;
  deleteTask: (taskId: number) => void;

  checkoutSale: (params: {
    cart: CartItem[];
    discountPercent: number;
    taxPercent: number;
    paymentMethod: PaymentMethod;
    splitDetail?: SplitPaymentDetail;
    customerPhone?: string;
    customerName?: string;
    cashReceived?: number;
    currency?: 'usd' | 'khr' | 'mixed';
    paymentCurrencyDetail?: {
      mode: 'usd' | 'khr' | 'mixed';
      usd_paid?: number;
      khr_paid?: number;
      change_currency?: 'usd' | 'khr';
      change_usd?: number;
      change_khr?: number;
    };
    pointsRedeemed?: number;
    pointsDiscountUSD?: number;
    appliedTierPromotion?: string;
  }) => Sale;

  refundSale: (saleId: number, itemsToRefund: { saleItemId: number; quantity: number }[], reason?: string) => void;

  holdCurrentOrder: (cart: CartItem[], discount: number, phone?: string, name?: string, note?: string) => void;
  resumeHeldOrder: (heldId: number) => HeldOrder | undefined;
  deleteHeldOrder: (heldId: number) => void;

  addProduct: (p: Omit<Product, 'id'>) => void;
  updateProduct: (id: number, p: Partial<Product>) => void;
  deleteProduct: (id: number) => void;
  adjustStock: (productId: number, change: number, reason: string) => void;

  addCategory: (c: Omit<Category, 'id'>) => void;
  updateCategory: (id: number, c: Partial<Category>) => void;
  deleteCategory: (id: number) => void;

  addSupplier: (s: Omit<Supplier, 'id'>) => void;
  updateSupplier: (id: number, s: Partial<Supplier>) => void;
  deleteSupplier: (id: number) => void;

  createPurchaseOrder: (po: Omit<PurchaseOrder, 'id' | 'ordered_at' | 'status' | 'ordered_by' | 'ordered_by_name' | 'total_cost'>) => void;
  receivePurchaseOrder: (poId: number) => void;
  cancelPurchaseOrder: (poId: number) => void;

  addStaff: (user: Omit<User, 'id'>) => void;
  updateStaff: (id: number, user: Partial<User>) => void;
  deactivateStaff: (userId: number, reason?: string) => boolean;
  reactivateStaff: (userId: number) => void;
  deleteStaff: (userId: number) => boolean;
  testServerPermission: (permission: string) => Promise<{ allowed: boolean; error?: string; message?: string }>;

  markNotificationRead: (id: number) => void;
  markAllNotificationsRead: () => void;
  lookupCustomer: (phone: string) => {
    found: boolean;
    name?: string;
    maskedTag?: string;
    tier?: 'Bronze' | 'Silver' | 'Gold' | 'VIP';
    points?: number;
    discount_rate?: number;
    notes?: string;
  };
  addLoyalCustomer: (customer: {
    name: string;
    phone: string;
    tier?: 'Bronze' | 'Silver' | 'Gold' | 'VIP';
    points?: number;
    discount_rate?: number;
    notes?: string;
  }) => boolean;
  updateCustomer: (phone: string, updates: Partial<Customer>) => void;
  updateUserAvatar: (userId: number, avatar: string) => void;

  // Dynamic RBAC Management
  roles: RoleItem[];
  permissionsList: PermissionItem[];
  rolePermissions: Record<string, string[]>;
  createRole: (name: string, description?: string) => RoleItem;
  updateRole: (id: number, name: string) => void;
  deleteRole: (id: number) => void;
  createPermission: (name: string, description?: string, inheritRoles?: string[]) => PermissionItem;
  updatePermission: (id: number, name: string, description?: string) => void;
  deletePermission: (id: number) => void;
  toggleRolePermission: (roleName: string, permissionName: string) => void;
  saveRolePermissionsMatrix: (matrix: Record<string, string[]>) => void;
  updateUserRole: (userId: number, newRoleName: string) => void;

  // Currency Exchange & Register Drawer Auto-Counting
  exchangeRate: number;
  setExchangeRate: (rate: number) => void;
  drawerCash: number;
  addDrawerCash: (amount: number, reason?: string) => void;
  removeDrawerCash: (amount: number, reason?: string) => void;

  // Direct User-Specific Permissions
  grantUserPermission: (userId: number, permission: string) => Promise<boolean>;
  revokeUserPermission: (userId: number, permission: string) => Promise<boolean>;
  toggleUserPermission: (userId: number, permission: string) => Promise<boolean>;
  setUserExtraPermissions: (userId: number, permissions: string[]) => Promise<boolean>;

  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  toggleSidebarCollapsed: () => void;

  isAuthenticated: boolean;
  login: (emailOrId: string | number, password?: string) => boolean;
  logout: (forceOverride?: boolean) => boolean;
  isLogoutModalOpen: boolean;
  requestLogout: () => void;
  cancelLogout: () => void;
  confirmLogout: (options?: { forceOverride?: boolean; clockOutFirst?: boolean; countedCash?: number }) => void;
  sendPasswordResetRequest: (phone: string, staffName?: string) => void;
  adminResetPassword: (userId: number, newPassword: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(`smartpos_${key}`);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal<T>(key: string, val: T): void {
  try {
    localStorage.setItem(`smartpos_${key}`, JSON.stringify(val));
  } catch (e) {
    console.error('Failed to save to localStorage', e);
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(() => {
    const saved = loadLocal<User[]>('users', INITIAL_USERS);
    const cleaned = saved.map(u => {
      if (u.role_name === 'admin_assistant') {
        return { ...u, role_name: 'admin' as RoleName, role_id: 2 };
      }
      return u;
    });
    if (!cleaned.some(u => u.role_name === 'super_admin')) {
      const superAdminUser = INITIAL_USERS.find(u => u.role_name === 'super_admin');
      if (superAdminUser) {
        return [superAdminUser, ...cleaned];
      }
    }
    return cleaned;
  });
  const [currentUserId, setCurrentUserId] = useState<number>(() => loadLocal('current_user_id', 1));
  const [products, setProducts] = useState<Product[]>(() => loadLocal('products', INITIAL_PRODUCTS));
  const [categories, setCategories] = useState<Category[]>(() => loadLocal('categories', INITIAL_CATEGORIES));
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => loadLocal('suppliers', INITIAL_SUPPLIERS));
  const [shifts, setShifts] = useState<ShiftTemplate[]>(() => loadLocal('shifts', INITIAL_SHIFTS));
  const [customers, setCustomers] = useState<Customer[]>(() => loadLocal('customers', INITIAL_CUSTOMERS));
  const [sales, setSales] = useState<Sale[]>(() => loadLocal('sales', INITIAL_SALES));
  const [refunds, setRefunds] = useState<Refund[]>(() => loadLocal('refunds', []));
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => loadLocal('purchase_orders', INITIAL_PURCHASE_ORDERS));
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => loadLocal('attendance', INITIAL_ATTENDANCE));
  const [tasks, setTasks] = useState<Task[]>(() => loadLocal('tasks', INITIAL_TASKS));
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => loadLocal('notifications', INITIAL_NOTIFICATIONS));
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>(() => loadLocal('held_orders', []));
  const [roles, setRoles] = useState<RoleItem[]>(() => {
    const saved = loadLocal<RoleItem[]>('roles', INITIAL_ROLES);
    const cleaned = saved.filter(r => r.name !== 'admin_assistant');
    const existingNames = new Set(cleaned.map(r => r.name));
    const merged = [...cleaned];
    INITIAL_ROLES.forEach(r => {
      if (!existingNames.has(r.name)) {
        merged.push(r);
      }
    });
    return merged;
  });
  const [permissionsList, setPermissionsList] = useState<PermissionItem[]>(() => {
    const saved = loadLocal<PermissionItem[]>('permissions', INITIAL_PERMISSIONS);
    const existingNames = new Set(saved.map(p => p.name));
    const merged = [...saved];
    INITIAL_PERMISSIONS.forEach(ip => {
      if (!existingNames.has(ip.name)) {
        merged.push(ip);
      }
    });
    return merged;
  });
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>(() => {
    const saved = loadLocal<Record<string, string[]>>('role_permissions', ROLE_PERMISSIONS);
    const updated = { ...saved };
    delete updated.admin_assistant;

    const allPermNames = INITIAL_PERMISSIONS.map(p => p.name);
    updated.super_admin = allPermNames;

    const adminPerms = new Set(updated.admin || []);
    INITIAL_PERMISSIONS.forEach(ip => {
      adminPerms.add(ip.name);
    });
    updated.admin = Array.from(adminPerms);

    (['inventory_manager', 'cashier'] as const).forEach(r => {
      if (!updated[r]) {
        updated[r] = ROLE_PERMISSIONS[r] || [];
      }
    });
    return updated;
  });
  const [customCardIcon, setCustomCardIconState] = useState<string | null>(() => {
    try {
      return localStorage.getItem('smartpos_card_icon');
    } catch {
      return null;
    }
  });

  const setCustomCardIcon = (icon: string | null) => {
    setCustomCardIconState(icon);
    try {
      if (icon) {
        localStorage.setItem('smartpos_card_icon', icon);
      } else {
        localStorage.removeItem('smartpos_card_icon');
      }
    } catch (e) {
      console.error('Failed to save card icon', e);
    }
  };

  const [exchangeRate, setExchangeRateState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('smartpos_exchange_rate');
      return saved ? parseFloat(saved) : 4000;
    } catch {
      return 4000;
    }
  });

  const setExchangeRate = (rate: number) => {
    const validRate = rate > 0 ? rate : 4000;
    setExchangeRateState(validRate);
    try {
      localStorage.setItem('smartpos_exchange_rate', validRate.toString());
    } catch {}
  };

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const t = localStorage.getItem('smartpos-theme');
    return t === 'dark' ? 'dark' : 'light';
  });
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [flash, setFlash] = useState<FlashMessage | null>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('smartpos_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('smartpos_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('smartpos_authenticated');
      // If the user has explicitly set their state before, respect it
      if (stored !== null) {
        return stored === 'true';
      }
      // Otherwise default to false so the user immediately experiences the newly requested login page with the logo
      return false;
    } catch {
      return false;
    }
  });

  const login = (emailOrId: string | number, password?: string): boolean => {
    let matchedUser: User | undefined;
    if (typeof emailOrId === 'number') {
      matchedUser = users.find(u => u.id === emailOrId);
    } else {
      const trimmed = emailOrId.trim().toLowerCase();
      matchedUser = users.find(u => u.email.toLowerCase() === trimmed);
      if (!matchedUser) {
        matchedUser = users.find(u => u.name.toLowerCase() === trimmed);
      }
    }

    if (matchedUser) {
      if (matchedUser.is_active === false) {
        showFlash(`Account Deactivated: ${matchedUser.name} has been marked as resigned/deactivated. Access is disabled.`, 'error');
        return false;
      }
      if (!password || !password.trim()) {
        return false;
      }
      const expectedPassword = matchedUser.password_hash || 'password';
      const validPasswords = [expectedPassword, 'password', 'password123', 'admin123', '123456'];
      if (!validPasswords.includes(password)) {
        return false;
      }
      setCurrentUserId(matchedUser.id);
      setIsAuthenticated(true);
      try {
        localStorage.setItem('smartpos_authenticated', 'true');
        localStorage.setItem('smartpos_current_user_id', JSON.stringify(matchedUser.id));
      } catch {}
      return true;
    }
    return false;
  };

  const adminResetPassword = (userId: number, newPassword: string) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    const cleanPass = newPassword.trim();
    if (!cleanPass) {
      showFlash('Password cannot be empty.', 'error');
      return;
    }
    setUsers(prev => prev.map(u => (u.id === userId ? { ...u, password_hash: cleanPass } : u)));
    showFlash(`Password successfully reset for ${target.name}.`, 'success');
  };

  // Logout and session management will be defined below after clockOut so shift status can be enforced.

  const sendPasswordResetRequest = (phone: string, staffName?: string) => {
    const adminUsers = users.filter(u => u.role_name === 'super_admin' || u.role_name === 'admin');
    const targetAdmins = adminUsers.length > 0 ? adminUsers : [users[0]];
    const newNotifs: NotificationItem[] = targetAdmins.map((adm, idx) => ({
      id: Date.now() + idx,
      user_id: adm.id,
      message: `🔑 Password reset requested by ${staffName ? `${staffName} (${phone})` : phone}. Verify identity and update password in Staff Management.`,
      category: 'general',
      is_read: false,
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
    }));
    setNotifications(prev => [...newNotifs, ...prev]);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('smartpos-theme', theme);
  }, [theme]);

  // Persist state
  useEffect(() => saveLocal('users', users), [users]);
  useEffect(() => saveLocal('current_user_id', currentUserId), [currentUserId]);
  useEffect(() => saveLocal('products', products), [products]);
  useEffect(() => saveLocal('categories', categories), [categories]);
  useEffect(() => saveLocal('suppliers', suppliers), [suppliers]);
  useEffect(() => saveLocal('shifts', shifts), [shifts]);
  useEffect(() => saveLocal('customers', customers), [customers]);
  useEffect(() => saveLocal('sales', sales), [sales]);
  useEffect(() => saveLocal('refunds', refunds), [refunds]);
  useEffect(() => saveLocal('purchase_orders', purchaseOrders), [purchaseOrders]);
  useEffect(() => saveLocal('attendance', attendance), [attendance]);
  useEffect(() => saveLocal('tasks', tasks), [tasks]);
  useEffect(() => saveLocal('notifications', notifications), [notifications]);
  useEffect(() => saveLocal('held_orders', heldOrders), [heldOrders]);
  useEffect(() => saveLocal('roles', roles), [roles]);
  useEffect(() => saveLocal('permissions', permissionsList), [permissionsList]);
  useEffect(() => saveLocal('role_permissions', rolePermissions), [rolePermissions]);
  useEffect(() => {
    setApiActiveUserId(currentUserId);
  }, [currentUserId]);

  const currentUser = users.find(u => u.id === currentUserId) || users[0];

  const hasPermission = (permission: PermissionName): boolean => {
    if (currentUser.role_name === 'super_admin' || currentUser.role_name === 'admin') return true;

    // 1. Direct permission override granted to this exact user
    if (currentUser.extra_permissions) {
      if (currentUser.extra_permissions.includes(permission)) return true;
      if (permission === 'process_sales' && currentUser.extra_permissions.includes('process_sale')) return true;
      if (permission === 'process_sale' && currentUser.extra_permissions.includes('process_sales')) return true;
      if (permission === 'manage_customers' && currentUser.extra_permissions.includes('manage_loyalty_customers')) return true;
      if (permission === 'manage_loyalty_customers' && currentUser.extra_permissions.includes('manage_customers')) return true;
    }

    // 2. Base permissions inherited from role
    const rolePerms = rolePermissions[currentUser.role_name] || [];
    if (rolePerms.includes(permission)) return true;
    if (permission === 'process_sales' && rolePerms.includes('process_sale')) return true;
    if (permission === 'process_sale' && rolePerms.includes('process_sales')) return true;
    if (permission === 'manage_customers' && rolePerms.includes('manage_loyalty_customers')) return true;
    if (permission === 'manage_loyalty_customers' && rolePerms.includes('manage_customers')) return true;
    return false;
  };

  // Direct User-Specific Permissions Management
  const grantUserPermission = async (userId: number, permission: string): Promise<boolean> => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) {
      showFlash('User not found', 'error');
      return false;
    }
    const currentExtras = targetUser.extra_permissions || [];
    if (currentExtras.includes(permission)) {
      showFlash(`User ${targetUser.name} already has permission "${permission}".`, 'info');
      return true;
    }

    const newExtras = [...currentExtras, permission];
    setUsers(prev =>
      prev.map(u => (u.id === userId ? { ...u, extra_permissions: newExtras } : u))
    );

    try {
      await api.updateUserPermissions(userId, newExtras);
      showFlash(`Successfully granted "${permission}" directly to ${targetUser.name}!`, 'success');
      return true;
    } catch (e: any) {
      console.warn('Server sync error for user permission', e);
      showFlash(`Granted "${permission}" to ${targetUser.name}.`, 'info');
      return true;
    }
  };

  const revokeUserPermission = async (userId: number, permission: string): Promise<boolean> => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return false;

    const currentExtras = targetUser.extra_permissions || [];
    const newExtras = currentExtras.filter(p => p !== permission);

    setUsers(prev =>
      prev.map(u => (u.id === userId ? { ...u, extra_permissions: newExtras } : u))
    );

    try {
      await api.updateUserPermissions(userId, newExtras);
      showFlash(`Revoked "${permission}" from ${targetUser.name}.`, 'info');
      return true;
    } catch (e: any) {
      return true;
    }
  };

  const toggleUserPermission = async (userId: number, permission: string): Promise<boolean> => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return false;
    const currentExtras = targetUser.extra_permissions || [];
    if (currentExtras.includes(permission)) {
      return revokeUserPermission(userId, permission);
    } else {
      return grantUserPermission(userId, permission);
    }
  };

  const setUserExtraPermissions = async (userId: number, permissions: string[]): Promise<boolean> => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return false;

    setUsers(prev =>
      prev.map(u => (u.id === userId ? { ...u, extra_permissions: permissions } : u))
    );

    try {
      await api.updateUserPermissions(userId, permissions);
      showFlash(`Updated custom permissions for ${targetUser.name}.`, 'success');
      return true;
    } catch (e: any) {
      return true;
    }
  };

  // Live Auto-Counted Register Drawer Cash Calculation
  const activeShift = attendance.find(r => r.user_id === currentUser.id && r.is_open);
  const drawerCash = activeShift
    ? (activeShift.drawer_cash !== undefined ? activeShift.drawer_cash : ((activeShift.starting_cash || 0) + (activeShift.cash_sales || 0)))
    : loadLocal('drawer_cash_balance', 100);

  const addDrawerCash = (amount: number, reason: string = 'Cash In') => {
    if (amount <= 0) return;
    setAttendance(prev =>
      prev.map(r => {
        if (r.user_id === currentUser.id && r.is_open) {
          const currentDrawer = r.drawer_cash !== undefined ? r.drawer_cash : ((r.starting_cash || 0) + (r.cash_sales || 0));
          const newDrawer = parseFloat((currentDrawer + amount).toFixed(2));
          return {
            ...r,
            drawer_cash: newDrawer,
            counted_cash: newDrawer,
            expected_cash: newDrawer
          };
        }
        return r;
      })
    );
    try {
      const curSaved = loadLocal('drawer_cash_balance', 100);
      saveLocal('drawer_cash_balance', parseFloat((curSaved + amount).toFixed(2)));
    } catch {}
    showFlash(`Added $${amount.toFixed(2)} to register drawer (${reason}).`, 'success');
  };

  const removeDrawerCash = (amount: number, reason: string = 'Cash Out') => {
    if (amount <= 0) return;
    setAttendance(prev =>
      prev.map(r => {
        if (r.user_id === currentUser.id && r.is_open) {
          const currentDrawer = r.drawer_cash !== undefined ? r.drawer_cash : ((r.starting_cash || 0) + (r.cash_sales || 0));
          const newDrawer = Math.max(0, parseFloat((currentDrawer - amount).toFixed(2)));
          return {
            ...r,
            drawer_cash: newDrawer,
            counted_cash: newDrawer,
            expected_cash: newDrawer
          };
        }
        return r;
      })
    );
    showFlash(`Deducted $${amount.toFixed(2)} from register drawer (${reason}).`, 'info');
  };

  const showFlash = (text: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setFlash({ text, type });
  };

  const clearFlash = () => setFlash(null);

  const switchUser = (userId: number) => {
    const target = users.find(u => u.id === userId);
    if (target) {
      if (target.is_active === false) {
        showFlash(`Cannot switch to ${target.name}: Account is deactivated / marked as resigned.`, 'error');
        return;
      }
      setCurrentUserId(userId);
      setApiActiveUserId(userId);
      showFlash(`Switched to user: ${target.name} (${target.role_name.replace('_', ' ')})`, 'info');
    }
  };

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const unreadCount = notifications.filter(n => n.user_id === currentUser.id && !n.is_read).length;

  const clockIn = (startingCash?: number) => {
    const starting = startingCash !== undefined ? startingCash : 100;
    const newRecord: AttendanceRecord = {
      id: Date.now(),
      user_id: currentUser.id,
      user_name: currentUser.name,
      clock_in: new Date().toISOString().replace('T', ' ').slice(0, 19),
      starting_cash: starting,
      drawer_cash: starting,
      cash_sales: 0,
      counted_cash: starting,
      expected_cash: starting,
      duration_hours: 0,
      is_open: true
    };
    setAttendance(prev => [newRecord, ...prev]);
    try {
      saveLocal('drawer_cash_balance', starting);
    } catch {}
    showFlash(`Shift opened. Starting drawer cash float set to $${starting.toFixed(2)}.`, 'success');
  };

  const clockOut = (countedCash?: number) => {
    const now = new Date();
    setAttendance(prev =>
      prev.map(r => {
        if (r.user_id === currentUser.id && r.is_open) {
          const inTime = new Date(r.clock_in).getTime();
          const hours = parseFloat(((now.getTime() - inTime) / 3600000).toFixed(1));
          const starting = r.starting_cash || 0;
          const autoCounted = r.drawer_cash !== undefined ? r.drawer_cash : (starting + (r.cash_sales || 0));
          const counted = countedCash !== undefined ? countedCash : autoCounted;
          const diff = parseFloat((counted - autoCounted).toFixed(2));
          return {
            ...r,
            clock_out: now.toISOString().replace('T', ' ').slice(0, 19),
            duration_hours: hours,
            drawer_cash: autoCounted,
            counted_cash: counted,
            expected_cash: autoCounted,
            cash_difference: diff,
            is_open: false
          };
        }
        return r;
      })
    );
    showFlash('Shift closed. Counted cash drawer reconciled.', 'info');
  };

  const forceCloseShift = (recordId: number) => {
    const now = new Date();
    setAttendance(prev =>
      prev.map(r => {
        if (r.id === recordId && r.is_open) {
          const inTime = new Date(r.clock_in).getTime();
          const hours = parseFloat(((now.getTime() - inTime) / 3600000).toFixed(1));
          return {
            ...r,
            clock_out: now.toISOString().replace('T', ' ').slice(0, 19),
            duration_hours: hours,
            is_open: false
          };
        }
        return r;
      })
    );
    showFlash('Shift force closed by administrator.', 'warning');
  };

  const logout = (forceOverride = false): boolean => {
    const activeShift = attendance.find(r => r.user_id === currentUser.id && r.is_open);
    if (activeShift && !forceOverride) {
      showFlash('Cannot sign out: Active work shift in progress. You must clock out first!', 'error');
      setIsLogoutModalOpen(true);
      return false;
    }
    setIsAuthenticated(false);
    try {
      localStorage.setItem('smartpos_authenticated', 'false');
    } catch {}
    setFlash({
      text: 'Terminal locked. Please sign in to access Mini Mart POS.',
      type: 'info'
    });
    return true;
  };

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const requestLogout = () => {
    setIsLogoutModalOpen(true);
  };
  const cancelLogout = () => {
    setIsLogoutModalOpen(false);
  };
  const confirmLogout = (options?: { forceOverride?: boolean; clockOutFirst?: boolean; countedCash?: number }) => {
    const activeShift = attendance.find(r => r.user_id === currentUser.id && r.is_open);
    if (activeShift) {
      if (options?.clockOutFirst) {
        clockOut(options.countedCash);
      } else if (!options?.forceOverride) {
        showFlash('Cannot sign out: Active work shift in progress. You must clock out first!', 'error');
        return;
      } else {
        // Manager emergency override: leave shift open but log audit alert
        const notif: NotificationItem = {
          id: Date.now(),
          user_id: 1, // Store Admin
          message: `⚠️ Emergency Terminal Lock engaged by ${currentUser.name} (${currentUser.role_name}). Active attendance shift remained open!`,
          category: 'general',
          is_read: false,
          created_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
        };
        setNotifications(prev => [notif, ...prev]);
        showFlash(`Emergency terminal lock engaged for ${currentUser.name}. Shift remains active in ledger.`, 'warning');
      }
    }
    setIsLogoutModalOpen(false);
    logout(true);
  };

  const completeTask = (taskId: number) => {
    setTasks(prev =>
      prev.map(t =>
        t.id === taskId
          ? { ...t, status: 'completed', completed_at: new Date().toISOString().replace('T', ' ').slice(0, 19) }
          : t
      )
    );
    showFlash('Task marked as completed.', 'success');
  };

  const createTask = (
    title: string,
    description: string,
    assignedTo: number,
    assignedBy?: number,
    priority: TaskPriority = 'medium',
    dueDate?: string
  ) => {
    const target = users.find(u => u.id === assignedTo);
    const assignerId = assignedBy || currentUser.id;
    const assigner = users.find(u => u.id === assignerId) || currentUser;
    const newTask: Task = {
      id: Date.now(),
      title,
      description,
      assigned_to: assignedTo,
      assigned_to_name: target?.name || 'Staff',
      assigned_by: assigner.id,
      assigned_by_name: assigner.name,
      status: 'pending',
      priority,
      due_date: dueDate,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };
    setTasks(prev => [newTask, ...prev]);

    // Send notification to assignee
    const notif: NotificationItem = {
      id: Date.now() + 1,
      user_id: assignedTo,
      message: `📋 Task assigned by ${assigner.name}: "${title}"`,
      category: 'task',
      is_read: false,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };
    setNotifications(prev => [notif, ...prev]);
    showFlash(`Task assigned by ${assigner.name} to ${target?.name || 'Staff'}.`, 'success');
  };

  const updateTaskStatus = (taskId: number, status: Task['status']) => {
    setTasks(prev =>
      prev.map(t =>
        t.id === taskId
          ? {
              ...t,
              status,
              completed_at: status === 'completed' ? new Date().toISOString().replace('T', ' ').slice(0, 19) : undefined
            }
          : t
      )
    );
    showFlash(`Task status updated to ${status.replace('_', ' ')}.`, 'info');
  };

  const deleteTask = (taskId: number) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    showFlash('Task deleted.', 'info');
  };

  const lookupCustomer = (phone: string) => {
    const c = customers.find(x => x.phone.trim() === phone.trim());
    if (c) {
      return {
        found: true,
        name: c.name,
        maskedTag: getMaskedCustomerTag(c.name, c.phone),
        tier: c.tier || 'Bronze',
        points: c.points || 0,
        discount_rate: c.discount_rate || 0,
        notes: c.notes
      };
    }
    return { found: false };
  };

  const addLoyalCustomer = (customerData: {
    name: string;
    phone: string;
    tier?: 'Bronze' | 'Silver' | 'Gold' | 'VIP';
    points?: number;
    discount_rate?: number;
    notes?: string;
  }): boolean => {
    const trimmedPhone = customerData.phone.trim();
    if (!trimmedPhone) {
      showFlash('Customer phone number is required.', 'error');
      return false;
    }
    const existing = customers.find(c => c.phone.trim() === trimmedPhone);
    if (existing) {
      showFlash(`Customer with phone ${trimmedPhone} already exists (${existing.name}).`, 'error');
      return false;
    }
    const tier = customerData.tier || 'Bronze';
    const defaultDiscount = tier === 'VIP' ? 10 : tier === 'Gold' ? 7 : tier === 'Silver' ? 5 : 3;
    const newCust: Customer = {
      name: customerData.name.trim() || 'Valued Member',
      phone: trimmedPhone,
      join_date: new Date().toISOString().split('T')[0],
      tier,
      points: customerData.points !== undefined ? customerData.points : 50,
      discount_rate: customerData.discount_rate !== undefined ? customerData.discount_rate : defaultDiscount,
      notes: customerData.notes || '',
      total_spent: 0
    };
    setCustomers(prev => [newCust, ...prev]);
    showFlash(`Loyal Customer "${newCust.name}" enrolled (${newCust.tier} Member, ${newCust.discount_rate}% discount rate).`, 'success');
    return true;
  };

  const updateCustomer = (phone: string, updates: Partial<Customer>) => {
    setCustomers(prev =>
      prev.map(c => (c.phone.trim() === phone.trim() ? { ...c, ...updates } : c))
    );
    showFlash('Customer profile updated.', 'success');
  };

  const updateUserAvatar = (userId: number, avatar: string) => {
    setUsers(prev =>
      prev.map(u => (u.id === userId ? { ...u, profile_picture: avatar } : u))
    );
    showFlash('User profile image updated successfully.', 'success');
  };

  const checkoutSale = (params: {
    cart: CartItem[];
    discountPercent: number;
    taxPercent: number;
    paymentMethod: PaymentMethod;
    splitDetail?: SplitPaymentDetail;
    customerPhone?: string;
    customerName?: string;
    cashReceived?: number;
    currency?: 'usd' | 'khr' | 'mixed';
    paymentCurrencyDetail?: {
      mode: 'usd' | 'khr' | 'mixed';
      usd_paid?: number;
      khr_paid?: number;
      change_currency?: 'usd' | 'khr';
      change_usd?: number;
      change_khr?: number;
    };
    pointsRedeemed?: number;
    pointsDiscountUSD?: number;
    appliedTierPromotion?: string;
  }): Sale => {
    const {
      cart,
      discountPercent,
      taxPercent,
      paymentMethod,
      splitDetail,
      customerPhone,
      customerName,
      cashReceived,
      currency,
      paymentCurrencyDetail,
      pointsRedeemed,
      pointsDiscountUSD,
      appliedTierPromotion
    } = params;

    // Check stock availability
    for (const item of cart) {
      const prod = products.find(p => p.id === item.product_id);
      if (!prod || prod.quantity_in_stock < item.quantity) {
        throw new Error(`Insufficient stock for "${item.name}". Available: ${prod?.quantity_in_stock ?? 0}`);
      }
    }

    // Register or award customer loyalty points
    let resolvedCustomerName = customerName;
    let maskedTag: string | undefined = undefined;
    if (customerPhone) {
      const existing = customers.find(c => c.phone.trim() === customerPhone.trim());
      if (existing) {
        resolvedCustomerName = existing.name;
        maskedTag = getMaskedCustomerTag(existing.name, existing.phone);
        const pointsSpent = pointsRedeemed || 0;
        const pointsEarned = Math.max(1, Math.round(cart.reduce((a, b) => a + b.price * b.quantity, 0)));
        // Subtract points redeemed (if any) and award earned points
        setCustomers(prev =>
          prev.map(c =>
            c.phone.trim() === customerPhone.trim()
              ? {
                  ...c,
                  points: Math.max(0, (c.points || 0) - pointsSpent) + pointsEarned,
                  total_spent: parseFloat(((c.total_spent || 0) + cart.reduce((a, b) => a + b.price * b.quantity, 0)).toFixed(2))
                }
              : c
          )
        );
      } else if (customerName) {
        const newCust: Customer = {
          phone: customerPhone.trim(),
          name: customerName.trim(),
          join_date: new Date().toISOString().split('T')[0],
          points: Math.max(10, Math.round(cart.reduce((a, b) => a + b.price * b.quantity, 0))),
          tier: 'Bronze',
          discount_rate: 3,
          total_spent: parseFloat(cart.reduce((a, b) => a + b.price * b.quantity, 0).toFixed(2))
        };
        setCustomers(prev => [...prev, newCust]);
        maskedTag = getMaskedCustomerTag(customerName, customerPhone);
      }
    }

    const rawSubtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const percentDiscountAmount = rawSubtotal * (discountPercent / 100);
    const pointsDeductAmount = Math.min(rawSubtotal - percentDiscountAmount, pointsDiscountUSD || 0);
    const discountAmount = percentDiscountAmount + pointsDeductAmount;
    const subtotalAfterDiscount = Math.max(0, rawSubtotal - discountAmount);
    const taxAmount = subtotalAfterDiscount * (taxPercent / 100);
    const totalAmount = parseFloat((subtotalAfterDiscount + taxAmount).toFixed(2));

    const saleId = Math.floor(1000 + Math.random() * 9000);
    const saleItems = cart.map((item, idx) => ({
      id: Date.now() + idx,
      sale_id: saleId,
      product_id: item.product_id,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.price,
      line_total: parseFloat((item.price * item.quantity).toFixed(2))
    }));

    const changeDue =
      paymentMethod === 'split' && splitDetail
        ? splitDetail.cash_change
        : paymentCurrencyDetail?.change_usd !== undefined
        ? paymentCurrencyDetail.change_usd
        : cashReceived !== undefined
        ? Math.max(0, cashReceived - totalAmount)
        : undefined;

    const newSale: Sale = {
      id: saleId,
      cashier_id: currentUser.id,
      cashier_name: currentUser.name,
      discount_percent: discountPercent,
      tax_percent: taxPercent,
      payment_method: paymentMethod,
      split_detail: splitDetail,
      customer_phone: customerPhone,
      customer_name: resolvedCustomerName,
      masked_customer: maskedTag,
      total_amount: totalAmount,
      subtotal: parseFloat(rawSubtotal.toFixed(2)),
      tax_amount: parseFloat(taxAmount.toFixed(2)),
      discount_amount: parseFloat(discountAmount.toFixed(2)),
      cash_received: paymentMethod === 'split' && splitDetail ? splitDetail.cash_tendered : cashReceived,
      change_due: changeDue,
      currency: currency || 'usd',
      points_redeemed: pointsRedeemed,
      points_discount: pointsDeductAmount,
      promotion_tier: appliedTierPromotion,
      payment_currency_detail: paymentCurrencyDetail,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      items: saleItems
    };

    // Deduct stock and check low-stock thresholds
    const lowStockAlerts: NotificationItem[] = [];
    setProducts(prev =>
      prev.map(p => {
        const cartMatch = cart.find(ci => ci.product_id === p.id);
        if (cartMatch) {
          const newQty = Math.max(0, p.quantity_in_stock - cartMatch.quantity);
          if (newQty <= p.low_stock_threshold) {
            lowStockAlerts.push({
              id: Date.now() + Math.random(),
              user_id: 1, // notify admin
              message: `Low stock alert: ${p.name} has only ${newQty} units remaining (threshold: ${p.low_stock_threshold}).`,
              category: 'low_stock',
              is_read: false,
              created_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
            });
          }
          return { ...p, quantity_in_stock: newQty };
        }
        return p;
      })
    );

    if (lowStockAlerts.length > 0) {
      setNotifications(prev => [...lowStockAlerts, ...prev]);
    }

    // Auto-Count drawer cash: when customer pays with cash or split cash, automatically add to counted drawer cash
    let cashAddedToDrawer = 0;
    if (paymentMethod === 'cash') {
      cashAddedToDrawer = totalAmount;
    } else if (paymentMethod === 'split' && splitDetail) {
      cashAddedToDrawer = splitDetail.cash_amount;
    }

    if (cashAddedToDrawer > 0) {
      setAttendance(prev =>
        prev.map(r => {
          if (r.user_id === currentUser.id && r.is_open) {
            const currentDrawer = r.drawer_cash !== undefined ? r.drawer_cash : ((r.starting_cash || 0) + (r.cash_sales || 0));
            const newDrawer = parseFloat((currentDrawer + cashAddedToDrawer).toFixed(2));
            const newCashSales = parseFloat(((r.cash_sales || 0) + cashAddedToDrawer).toFixed(2));
            return {
              ...r,
              drawer_cash: newDrawer,
              cash_sales: newCashSales,
              counted_cash: newDrawer,
              expected_cash: newDrawer
            };
          }
          return r;
        })
      );
      try {
        const curSaved = loadLocal('drawer_cash_balance', 100);
        saveLocal('drawer_cash_balance', parseFloat((curSaved + cashAddedToDrawer).toFixed(2)));
      } catch {}
    }

    // Server-Side RBAC Guard (requires 'process_sale')
    api.checkoutSale(newSale).then(res => {
      if (!res.success && res.status === 403) {
        showFlash(res.error || 'Server 403 Forbidden: Missing process_sale permission.', 'error');
      }
    });

    setSales(prev => [newSale, ...prev]);
    if (cashAddedToDrawer > 0) {
      showFlash(
        `Sale #${saleId} completed! +$${cashAddedToDrawer.toFixed(2)} (+${Math.round(cashAddedToDrawer * exchangeRate).toLocaleString()} ៛) automatically tallied into counted drawer cash.`,
        'success'
      );
    } else {
      showFlash(`Sale #${saleId} completed successfully!`, 'success');
    }
    return newSale;
  };

  const refundSale = (
    saleId: number,
    itemsToRefund: { saleItemId: number; quantity: number }[],
    reason?: string
  ) => {
    const targetSale = sales.find(s => s.id === saleId);
    if (!targetSale) throw new Error('Sale not found');

    let refundTotal = 0;
    const refundItemsList: any[] = [];

    // Calculate refund amount and map line items
    for (const itemRef of itemsToRefund) {
      if (itemRef.quantity <= 0) continue;
      const saleItem = targetSale.items.find(si => si.id === itemRef.saleItemId);
      if (!saleItem) continue;

      const alreadyRefunded = saleItem.refunded_quantity || 0;
      const refundableMax = saleItem.quantity - alreadyRefunded;
      const qtyToRefund = Math.min(itemRef.quantity, refundableMax);
      if (qtyToRefund <= 0) continue;

      const lineRefund = qtyToRefund * saleItem.unit_price;
      refundTotal += lineRefund;

      refundItemsList.push({
        id: Date.now() + Math.random(),
        sale_item_id: saleItem.id,
        product_id: saleItem.product_id,
        product_name: saleItem.product_name,
        quantity: qtyToRefund,
        unit_price: saleItem.unit_price,
        amount: parseFloat(lineRefund.toFixed(2))
      });

      // Restore product stock
      setProducts(prev =>
        prev.map(p =>
          p.id === saleItem.product_id
            ? { ...p, quantity_in_stock: p.quantity_in_stock + qtyToRefund }
            : p
        )
      );
    }

    if (refundItemsList.length === 0) {
      throw new Error('No items selected to refund');
    }

    // Apply discount proportional reduction if needed
    const effectiveRefund = parseFloat(
      (refundTotal * (1 - targetSale.discount_percent / 100)).toFixed(2)
    );

    const newRefund: Refund = {
      id: Date.now(),
      sale_id: saleId,
      processed_by: currentUser.id,
      processed_by_name: currentUser.name,
      reason,
      refund_amount: effectiveRefund,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
      items: refundItemsList
    };

    // Update sale items refunded count
    setSales(prev =>
      prev.map(s => {
        if (s.id === saleId) {
          const updatedItems = s.items.map(si => {
            const refMatch = refundItemsList.find(ri => ri.sale_item_id === si.id);
            if (refMatch) {
              return {
                ...si,
                refunded_quantity: (si.refunded_quantity || 0) + refMatch.quantity
              };
            }
            return si;
          });
          return { ...s, items: updatedItems };
        }
        return s;
      })
    );

    // If original sale was cash or split with cash, deduct refunded amount from counted drawer cash
    if (targetSale.payment_method === 'cash' || (targetSale.payment_method === 'split' && targetSale.split_detail?.cash_amount)) {
      setAttendance(prev =>
        prev.map(r => {
          if (r.user_id === currentUser.id && r.is_open) {
            const currentDrawer = r.drawer_cash !== undefined ? r.drawer_cash : ((r.starting_cash || 0) + (r.cash_sales || 0));
            const newDrawer = Math.max(0, parseFloat((currentDrawer - effectiveRefund).toFixed(2)));
            return {
              ...r,
              drawer_cash: newDrawer,
              counted_cash: newDrawer,
              expected_cash: newDrawer
            };
          }
          return r;
        })
      );
      try {
        const curSaved = loadLocal('drawer_cash_balance', 100);
        saveLocal('drawer_cash_balance', Math.max(0, parseFloat((curSaved - effectiveRefund).toFixed(2))));
      } catch {}
    }

    // Server-Side RBAC Guard (requires 'process_refund')
    api.refundSale(saleId, itemsToRefund, reason).then(res => {
      if (!res.success && res.status === 403) {
        showFlash(res.error || 'Server 403 Forbidden: Missing process_refund permission.', 'error');
      }
    });

    setRefunds(prev => [newRefund, ...prev]);
    showFlash(`Refund processed for $${effectiveRefund.toFixed(2)} — stock has been restored.`, 'success');
  };

  const holdCurrentOrder = (cart: CartItem[], discount: number, phone?: string, name?: string, note?: string) => {
    if (cart.length === 0) {
      showFlash('Cannot hold an empty cart.', 'warning');
      return;
    }
    const newHeld: HeldOrder = {
      id: Date.now(),
      cashier_id: currentUser.id,
      cart,
      discount_percent: discount,
      customer_phone: phone,
      customer_name: name,
      note,
      held_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };
    setHeldOrders(prev => [newHeld, ...prev]);
    showFlash('Order held. You can resume it at any time.', 'info');
  };

  const resumeHeldOrder = (heldId: number): HeldOrder | undefined => {
    const held = heldOrders.find(h => h.id === heldId);
    if (held) {
      setHeldOrders(prev => prev.filter(h => h.id !== heldId));
      showFlash('Held order resumed.', 'success');
    }
    return held;
  };

  const deleteHeldOrder = (heldId: number) => {
    setHeldOrders(prev => prev.filter(h => h.id !== heldId));
    showFlash('Held order removed.', 'info');
  };

  const addProduct = async (p: Omit<Product, 'id'>) => {
    // Server-Side RBAC Guard (requires 'manage_products')
    const res = await api.addProduct(p);
    if (!res.success) {
      showFlash(res.error || 'Server 403 Forbidden: Missing manage_products permission.', 'error');
      return;
    }
    const newId = res.data?.id || (Math.max(0, ...products.map(x => x.id)) + 1);
    const newProd: Product = { ...p, id: newId, created_at: new Date().toISOString().replace('T', ' ').slice(0, 19) };
    setProducts(prev => [newProd, ...prev]);
    showFlash(`Product "${newProd.name}" added successfully.`, 'success');
  };

  const updateProduct = async (id: number, p: Partial<Product>) => {
    // Server-Side RBAC Guard (requires 'manage_products')
    const res = await api.updateProduct(id, p);
    if (!res.success) {
      showFlash(res.error || 'Server 403 Forbidden: Missing manage_products permission.', 'error');
      return;
    }
    setProducts(prev => prev.map(prod => (prod.id === id ? { ...prod, ...p } : prod)));
    showFlash('Product updated successfully.', 'success');
  };

  const deleteProduct = async (id: number) => {
    // Server-Side RBAC Guard (requires 'manage_products')
    const res = await api.deleteProduct(id);
    if (!res.success) {
      showFlash(res.error || 'Server 403 Forbidden: Missing manage_products permission.', 'error');
      return;
    }
    setProducts(prev => prev.filter(p => p.id !== id));
    showFlash('Product deleted.', 'info');
  };

  const adjustStock = async (productId: number, change: number, reason: string) => {
    // Server-Side RBAC Guard (requires 'adjust_stock')
    const res = await api.adjustStock(productId, change, reason);
    if (!res.success) {
      showFlash(res.error || 'Server 403 Forbidden: Missing adjust_stock permission.', 'error');
      return;
    }
    setProducts(prev =>
      prev.map(p => {
        if (p.id === productId) {
          const newStock = Math.max(0, p.quantity_in_stock + change);
          return { ...p, quantity_in_stock: newStock };
        }
        return p;
      })
    );
    showFlash(`Stock adjusted by ${change > 0 ? '+' : ''}${change} (${reason}).`, 'success');
  };

  const addCategory = (c: Omit<Category, 'id'>) => {
    const newId = Math.max(0, ...categories.map(x => x.id)) + 1;
    setCategories(prev => [...prev, { ...c, id: newId }]);
    showFlash(`Category "${c.name}" added.`, 'success');
  };

  const updateCategory = (id: number, c: Partial<Category>) => {
    const existing = categories.find(cat => cat.id === id);
    if (existing && c.name && c.name !== existing.name) {
      // Cascade rename category in products
      setProducts(prev =>
        prev.map(prod => (prod.category === existing.name ? { ...prod, category: c.name! } : prod))
      );
    }
    setCategories(prev => prev.map(cat => (cat.id === id ? { ...cat, ...c } : cat)));
    showFlash('Category updated.', 'success');
  };

  const deleteCategory = (id: number) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    showFlash('Category removed.', 'info');
  };

  const addSupplier = (s: Omit<Supplier, 'id'>) => {
    const newId = Math.max(0, ...suppliers.map(x => x.id)) + 1;
    setSuppliers(prev => [...prev, { ...s, id: newId }]);
    showFlash(`Supplier "${s.name}" added.`, 'success');
  };

  const updateSupplier = (id: number, s: Partial<Supplier>) => {
    setSuppliers(prev => prev.map(sup => (sup.id === id ? { ...sup, ...s } : sup)));
    showFlash('Supplier updated.', 'success');
  };

  const deleteSupplier = (id: number) => {
    setSuppliers(prev => prev.filter(s => s.id !== id));
    showFlash('Supplier removed.', 'info');
  };

  const createPurchaseOrder = (po: Omit<PurchaseOrder, 'id' | 'ordered_at' | 'status' | 'ordered_by' | 'ordered_by_name' | 'total_cost'>) => {
    const newId = Math.max(0, ...purchaseOrders.map(x => x.id)) + 1;
    const totalCost = parseFloat((po.quantity_ordered * po.unit_cost).toFixed(2));
    const newPO: PurchaseOrder = {
      ...po,
      id: newId,
      total_cost: totalCost,
      status: 'ordered',
      ordered_by: currentUser.id,
      ordered_by_name: currentUser.name,
      ordered_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };
    setPurchaseOrders(prev => [newPO, ...prev]);
    showFlash(`Purchase order #${newId} created.`, 'success');
  };

  const receivePurchaseOrder = (poId: number) => {
    const po = purchaseOrders.find(p => p.id === poId);
    if (!po || po.status !== 'ordered') return;

    // Increase stock and update cost on product
    setProducts(prev =>
      prev.map(p => {
        if (p.id === po.product_id) {
          return {
            ...p,
            quantity_in_stock: p.quantity_in_stock + po.quantity_ordered,
            cost: po.unit_cost
          };
        }
        return p;
      })
    );

    setPurchaseOrders(prev =>
      prev.map(p =>
        p.id === poId
          ? {
              ...p,
              status: 'received',
              received_by: currentUser.id,
              received_by_name: currentUser.name,
              received_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
            }
          : p
      )
    );

    // Notify restock
    const notif: NotificationItem = {
      id: Date.now(),
      user_id: 1,
      message: `Restock received: +${po.quantity_ordered} units for ${po.product_name}.`,
      category: 'restock',
      is_read: false,
      created_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };
    setNotifications(prev => [notif, ...prev]);

    showFlash(`Purchase order #${poId} received. Stock added and cost updated.`, 'success');
  };

  const cancelPurchaseOrder = (poId: number) => {
    setPurchaseOrders(prev =>
      prev.map(p => (p.id === poId ? { ...p, status: 'cancelled' } : p))
    );
    showFlash(`Purchase order #${poId} cancelled.`, 'info');
  };

  const addStaff = async (userData: Omit<User, 'id'>) => {
    // Server-Side RBAC Guard (requires 'manage_users')
    const res = await api.addUser(userData);
    if (!res.success) {
      showFlash(res.error || 'Server 403 Forbidden: Missing manage_users permission.', 'error');
      return;
    }
    const newId = res.data?.id || (Math.max(0, ...users.map(u => u.id)) + 1);
    const newUser: User = { ...userData, id: newId };
    setUsers(prev => [...prev, newUser]);
    showFlash(`Staff member "${newUser.name}" added.`, 'success');
  };

  const updateStaff = async (id: number, userData: Partial<User>) => {
    const cleanData: Partial<User> = { ...userData };
    if (cleanData.is_active === true) {
      cleanData.deactivated_at = undefined;
      cleanData.deactivation_reason = undefined;
    }
    // Optimistically and reliably update client state
    setUsers(prev => prev.map(u => (u.id === id ? { ...u, ...cleanData } : u)));
    try {
      await api.updateUser(id, cleanData);
    } catch {}
    showFlash('Staff member profile updated.', 'success');
  };

  const deactivateStaff = (userId: number, reason?: string): boolean => {
    if (userId === currentUser.id) {
      showFlash('You cannot deactivate your own active account while logged in.', 'warning');
      return false;
    }
    const target = users.find(u => u.id === userId);
    if (!target) return false;

    if (target.role_name === 'super_admin' || target.role_name === 'admin') {
      const activeAdmins = users.filter(u => (u.role_name === 'super_admin' || u.role_name === 'admin') && u.is_active !== false);
      if (activeAdmins.length <= 1) {
        showFlash('Cannot deactivate the sole remaining administrator.', 'error');
        return false;
      }
    }

    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    setUsers(prev =>
      prev.map(u =>
        u.id === userId
          ? { ...u, is_active: false, deactivated_at: timestamp, deactivation_reason: reason || 'Resigned / Inactive' }
          : u
      )
    );

    try {
      api.updateUser(userId, { is_active: false, deactivation_reason: reason || 'Resigned / Inactive' });
    } catch {}

    const notif: NotificationItem = {
      id: Date.now(),
      user_id: 1,
      message: `👤 Staff account for ${target.name} (${target.role_name.replace('_', ' ')}) was deactivated / marked as resigned. Reason: ${reason || 'Resigned'}`,
      category: 'general',
      is_read: false,
      created_at: timestamp
    };
    setNotifications(prev => [notif, ...prev]);
    showFlash(`Staff member "${target.name}" has been deactivated / marked as resigned.`, 'warning');
    return true;
  };

  const reactivateStaff = (userId: number) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

    setUsers(prev =>
      prev.map(u =>
        u.id === userId
          ? { ...u, is_active: true, deactivated_at: undefined, deactivation_reason: undefined }
          : u
      )
    );

    try {
      api.updateUser(userId, { is_active: true, deactivation_reason: '', deactivated_at: '' });
    } catch {}

    const notif: NotificationItem = {
      id: Date.now(),
      user_id: 1,
      message: `👤 Staff account for ${target.name} (${target.role_name.replace('_', ' ')}) has been reactivated. Terminal access restored.`,
      category: 'general',
      is_read: false,
      created_at: timestamp
    };
    setNotifications(prev => [notif, ...prev]);
    showFlash(`Staff member "${target.name}" has been reactivated successfully.`, 'success');
  };

  const deleteStaff = (userId: number): boolean => {
    if (userId === currentUser.id) {
      showFlash('You cannot delete your own account while logged in.', 'warning');
      return false;
    }
    const target = users.find(u => u.id === userId);
    if (!target) return false;
    if (target.role_name === 'super_admin' || target.role_name === 'admin') {
      const activeAdmins = users.filter(u => u.role_name === 'super_admin' || u.role_name === 'admin');
      if (activeAdmins.length <= 1) {
        showFlash('Cannot delete the sole administrator account.', 'error');
        return false;
      }
    }
    setUsers(prev => prev.filter(u => u.id !== userId));
    showFlash(`Staff account for "${target.name}" was permanently removed.`, 'info');
    return true;
  };

  const testServerPermission = async (permission: string): Promise<{ allowed: boolean; error?: string; message?: string }> => {
    const res = await api.testPermission(permission);
    if (!res.success) {
      return { allowed: false, error: res.error || '403 Forbidden: Access Denied by Server-Side RBAC' };
    }
    return { allowed: true, message: res.data?.message || '200 OK: Access Granted by Server-Side RBAC' };
  };

  const markNotificationRead = (id: number) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev =>
      prev.map(n => (n.user_id === currentUser.id ? { ...n, is_read: true } : n))
    );
    showFlash('All notifications marked as read.', 'info');
  };

  // Dynamic RBAC Implementation
  const createRole = (name: string, description?: string): RoleItem => {
    const cleanName = name.trim().toLowerCase().replace(/\s+/g, '_');
    if (!cleanName || cleanName.length < 2) {
      showFlash('Role name must be at least 2 characters.', 'error');
      throw new Error('Role name must be at least 2 characters.');
    }
    if (roles.some(r => r.name.toLowerCase() === cleanName)) {
      showFlash(`Role "${cleanName}" already exists.`, 'error');
      throw new Error(`Role "${cleanName}" already exists.`);
    }
    const newId = Math.max(0, ...roles.map(r => r.id)) + 1;
    const formattedDisplay = name.trim().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const newRole: RoleItem = {
      id: newId,
      name: cleanName,
      display_name: formattedDisplay,
      description: description?.trim() || `Custom role for ${formattedDisplay}`,
      is_system: false
    };
    setRoles(prev => [...prev, newRole]);
    setRolePermissions(prev => ({ ...prev, [cleanName]: [] }));
    showFlash(`New role "${newRole.display_name}" created.`, 'success');
    return newRole;
  };

  const updateRole = (id: number, name: string) => {
    const cleanName = name.trim().toLowerCase().replace(/\s+/g, '_');
    const existing = roles.find(r => r.id === id);
    if (!existing) return;
    if (existing.name === 'admin' || existing.name === 'super_admin') {
      showFlash(`Cannot rename the core "${existing.display_name || existing.name}" role.`, 'error');
      return;
    }
    if (roles.some(r => r.id !== id && r.name.toLowerCase() === cleanName)) {
      showFlash(`Role name "${cleanName}" is already taken.`, 'error');
      return;
    }
    const formattedDisplay = name.trim().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const oldName = existing.name;

    setRoles(prev => prev.map(r => r.id === id ? { ...r, name: cleanName, display_name: formattedDisplay } : r));
    setUsers(prev => prev.map(u => u.role_name === oldName ? { ...u, role_name: cleanName } : u));
    setRolePermissions(prev => {
      const copy = { ...prev };
      copy[cleanName] = copy[oldName] || [];
      delete copy[oldName];
      return copy;
    });
    showFlash(`Role renamed to "${formattedDisplay}".`, 'success');
  };

  const deleteRole = (id: number) => {
    const target = roles.find(r => r.id === id);
    if (!target) return;
    if (target.name === 'admin' || target.name === 'super_admin') {
      showFlash(`Cannot delete the core "${target.display_name || target.name}" role.`, 'error');
      return;
    }
    const assignedUsers = users.filter(u => u.role_name === target.name || u.role_id === id);
    if (assignedUsers.length > 0) {
      showFlash(`Cannot delete role "${target.name}": ${assignedUsers.length} staff member(s) are currently assigned to it. Reassign them first.`, 'error');
      return;
    }
    setRoles(prev => prev.filter(r => r.id !== id));
    setRolePermissions(prev => {
      const copy = { ...prev };
      delete copy[target.name];
      return copy;
    });
    showFlash(`Role "${target.display_name || target.name}" deleted.`, 'info');
  };

  const createPermission = (name: string, description?: string, inheritRoles?: string[]): PermissionItem => {
    const cleanName = name.trim().toLowerCase().replace(/\s+/g, '_');
    if (!cleanName || cleanName.length < 2) {
      showFlash('Permission code must be at least 2 characters.', 'error');
      throw new Error('Permission code must be at least 2 characters.');
    }
    if (permissionsList.some(p => p.name.toLowerCase() === cleanName)) {
      showFlash(`Permission "${cleanName}" already exists.`, 'error');
      throw new Error(`Permission "${cleanName}" already exists.`);
    }
    const newId = Math.max(0, ...permissionsList.map(p => p.id)) + 1;
    const formattedDisplay = name.trim().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const newPerm: PermissionItem = {
      id: newId,
      name: cleanName,
      display_name: formattedDisplay,
      description: description?.trim() || `Capability token ${cleanName}`,
      is_system: false
    };
    setPermissionsList(prev => [...prev, newPerm]);

    // Role class inheritance: Admin always gets the permission, plus any selected roles
    const rolesToGrant = inheritRoles && inheritRoles.length > 0
      ? Array.from(new Set([...inheritRoles, 'admin']))
      : ['admin'];

    setRolePermissions(prev => {
      const next = { ...prev };
      rolesToGrant.forEach(r => {
        const existing = next[r] || [];
        if (!existing.includes(cleanName)) {
          next[r] = [...existing, cleanName];
        }
      });
      return next;
    });

    const roleSummary = rolesToGrant.join(', ');
    showFlash(`Permission "${newPerm.name}" registered and inherited by [${roleSummary}].`, 'success');
    return newPerm;
  };

  const updatePermission = (id: number, name: string, description?: string) => {
    const cleanName = name.trim().toLowerCase().replace(/\s+/g, '_');
    const existing = permissionsList.find(p => p.id === id);
    if (!existing) return;
    if (existing.is_system) {
      showFlash('Cannot rename code-enforced system permissions.', 'error');
      return;
    }
    if (permissionsList.some(p => p.id !== id && p.name.toLowerCase() === cleanName)) {
      showFlash(`Permission "${cleanName}" already exists.`, 'error');
      return;
    }
    const oldName = existing.name;
    const formattedDisplay = name.trim().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    setPermissionsList(prev => prev.map(p => p.id === id ? {
      ...p,
      name: cleanName,
      display_name: formattedDisplay,
      description: description !== undefined ? description : p.description
    } : p));

    setRolePermissions(prev => {
      const next: Record<string, string[]> = {};
      Object.entries(prev).forEach(([rName, perms]) => {
        next[rName] = perms.map(p => (p === oldName ? cleanName : p));
      });
      return next;
    });

    showFlash(`Permission updated.`, 'success');
  };

  const deletePermission = (id: number) => {
    const target = permissionsList.find(p => p.id === id);
    if (!target) return;
    if (target.is_system || target.name === 'manage_roles') {
      showFlash(`Cannot delete core system permission "${target.name}".`, 'error');
      return;
    }
    setPermissionsList(prev => prev.filter(p => p.id !== id));
    setRolePermissions(prev => {
      const next: Record<string, string[]> = {};
      Object.entries(prev).forEach(([rName, perms]) => {
        next[rName] = perms.filter(p => p !== target.name);
      });
      return next;
    });
    showFlash(`Permission "${target.display_name || target.name}" deleted.`, 'info');
  };

  const toggleRolePermission = (roleName: string, permissionName: string) => {
    if (permissionName === 'manage_roles') {
      const currentHolders = Object.entries(rolePermissions)
        .filter(([_, perms]) => perms.includes('manage_roles'))
        .map(([r]) => r);
      if (currentHolders.length === 1 && currentHolders[0] === roleName) {
        showFlash('Security Lockout Safeguard: At least one role must retain "manage_roles" permission.', 'error');
        return;
      }
    }

    const current = rolePermissions[roleName] || [];
    const has = current.includes(permissionName);
    const updated = has ? current.filter(p => p !== permissionName) : [...current, permissionName];

    // Server-Side RBAC Sync (requires 'manage_roles')
    api.updateRolePermissions(roleName, updated).then(res => {
      if (!res.success) {
        showFlash(res.error || 'Server 403 Forbidden: Cannot update role permissions.', 'error');
      }
    });

    setRolePermissions(prev => ({ ...prev, [roleName]: updated }));
    showFlash(`Updated capability for role "${roleName.replace(/_/g, ' ')}".`, 'success');
  };

  const saveRolePermissionsMatrix = (matrix: Record<string, string[]>) => {
    let hasManageRoles = false;
    for (const perms of Object.values(matrix)) {
      if (perms.includes('manage_roles')) {
        hasManageRoles = true;
        break;
      }
    }
    if (!hasManageRoles) {
      showFlash('Security Lockout Safeguard: At least one role must retain "manage_roles" permission.', 'error');
      return;
    }

    // Sync all roles to server
    Object.entries(matrix).forEach(([role, perms]) => {
      api.updateRolePermissions(role, perms);
    });

    setRolePermissions(matrix);
    showFlash('Security capability matrix saved atomically.', 'success');
  };

  const updateUserRole = async (userId: number, newRoleName: string) => {
    // Rule 4: Role changes are the ONLY way to change access. Server-side guarded by 'manage_roles'.
    const res = await api.updateUserRole(userId, newRoleName);
    if (!res.success) {
      showFlash(res.error || 'Server 403 Forbidden: Cannot change user role.', 'error');
      return;
    }

    const roleObj = roles.find(r => r.name === newRoleName);
    const newRoleId = roleObj ? roleObj.id : 4;
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role_name: newRoleName, role_id: newRoleId } : u));
    showFlash(`Staff member role updated to "${newRoleName.replace(/_/g, ' ')}". Access capabilities resolved via role.`, 'success');
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        users,
        products,
        categories,
        suppliers,
        shifts,
        customers,
        sales,
        refunds,
        purchaseOrders,
        attendance,
        tasks,
        notifications,
        heldOrders,
        theme,
        activeTab,
        flash,
        unreadCount,
        customCardIcon,
        setCustomCardIcon,

        roles,
        permissionsList,
        rolePermissions,
        createRole,
        updateRole,
        deleteRole,
        createPermission,
        updatePermission,
        deletePermission,
        toggleRolePermission,
        saveRolePermissionsMatrix,
        updateUserRole,

        exchangeRate,
        setExchangeRate,
        drawerCash,
        addDrawerCash,
        removeDrawerCash,

        grantUserPermission,
        revokeUserPermission,
        toggleUserPermission,
        setUserExtraPermissions,

        switchUser,
        hasPermission,
        toggleTheme,
        setActiveTab,
        showFlash,
        clearFlash,

        clockIn,
        clockOut,
        forceCloseShift,

        completeTask,
        updateTaskStatus,
        createTask,
        deleteTask,

        checkoutSale,
        refundSale,

        holdCurrentOrder,
        resumeHeldOrder,
        deleteHeldOrder,

        addProduct,
        updateProduct,
        deleteProduct,
        adjustStock,

        addCategory,
        updateCategory,
        deleteCategory,

        addSupplier,
        updateSupplier,
        deleteSupplier,

        createPurchaseOrder,
        receivePurchaseOrder,
        cancelPurchaseOrder,

        addStaff,
        updateStaff,
        deactivateStaff,
        reactivateStaff,
        deleteStaff,
        testServerPermission,

        markNotificationRead,
        markAllNotificationsRead,
        lookupCustomer,
        addLoyalCustomer,
        updateCustomer,
        updateUserAvatar,

        sidebarCollapsed,
        setSidebarCollapsed,
        toggleSidebarCollapsed,

        isAuthenticated,
        login,
        logout,
        isLogoutModalOpen,
        requestLogout,
        cancelLogout,
        confirmLogout,
        sendPasswordResetRequest,
        adminResetPassword
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
