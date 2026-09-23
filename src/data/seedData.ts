import {
  User,
  Product,
  Category,
  Supplier,
  Customer,
  Sale,
  PurchaseOrder,
  AttendanceRecord,
  Task,
  NotificationItem,
  ShiftTemplate,
  PermissionName,
  RoleName,
  RoleItem,
  PermissionItem
} from '../types';

export const INITIAL_ROLES: RoleItem[] = [
  { id: 1, name: 'super_admin', display_name: 'Super Admin', is_system: true, description: 'Supreme authority with complete system governance and security administration' },
  { id: 2, name: 'admin', display_name: 'Admin', is_system: true, description: 'Full store operations, staff management, catalog, and reporting' },
  { id: 3, name: 'inventory_manager', display_name: 'Inventory Manager', is_system: true, description: 'Product catalog, stock adjustments, purchase orders, and supplier management' },
  { id: 4, name: 'cashier', display_name: 'Cashier', is_system: true, description: 'Point of Sale checkout register, customer loyalty CRM, and cash drawer transactions' }
];

export const INITIAL_PERMISSIONS: PermissionItem[] = [
  { id: 1, name: 'manage_users', display_name: 'Manage Staff', description: 'Create and update staff member profiles', is_system: true },
  { id: 2, name: 'delete_staff', display_name: 'Delete Staff', description: 'Deactivate and delete employee accounts', is_system: true },
  { id: 3, name: 'admin_reset_password', display_name: 'Reset Employee Passwords', description: 'Perform direct administrative password resets for staff members', is_system: true },
  { id: 4, name: 'manage_roles', display_name: 'Manage Roles & RBAC', description: 'Configure dynamic roles and permission matrices', is_system: true },
  { id: 5, name: 'manage_shifts', display_name: 'Manage Work Shifts', description: 'Configure and assign operational shift schedules', is_system: true },
  { id: 6, name: 'manage_tasks', display_name: 'Assign Staff Tasks', description: 'Create and assign operational duties to team members', is_system: true },
  { id: 7, name: 'manage_products', display_name: 'Manage Products', description: 'Add and edit inventory catalog products and pricing', is_system: true },
  { id: 8, name: 'delete_products', display_name: 'Delete Products', description: 'Remove catalog items permanently from inventory', is_system: true },
  { id: 9, name: 'adjust_stock', display_name: 'Adjust Stock Counts', description: 'Modify inventory on-hand counts, reconciliations and write-offs', is_system: true },
  { id: 10, name: 'manage_categories', display_name: 'Manage Categories', description: 'Create, update, and remove product merchandise categories', is_system: true },
  { id: 11, name: 'print_barcodes', display_name: 'Print Barcodes', description: 'Generate and print SKU barcode label stickers', is_system: true },
  { id: 12, name: 'view_cost_prices', display_name: 'View Cost & Profit Margins', description: 'Inspect wholesale supplier unit costs and item profit margins', is_system: true },
  { id: 13, name: 'process_sale', display_name: 'Process POS Sales', description: 'Operate checkout POS register, scan items, and finalize transactions', is_system: true },
  { id: 14, name: 'apply_discounts', display_name: 'Apply Custom Discounts', description: 'Authorize manual cart discount percentages at checkout', is_system: true },
  { id: 15, name: 'hold_orders', display_name: 'Park & Hold Orders', description: 'Hold active shopping carts and resume parked tickets', is_system: true },
  { id: 16, name: 'manage_currency', display_name: 'Change Exchange Rate', description: 'Modify USD ($) to KHR (៛) exchange conversion rates', is_system: true },
  { id: 17, name: 'adjust_drawer_cash', display_name: 'Adjust Drawer Cash', description: 'Open drawer, count floats, and reconcile shift end balances', is_system: true },
  { id: 18, name: 'view_reports', display_name: 'View Analytics & Reports', description: 'Access financial executive summaries and sales reporting views', is_system: true },
  { id: 19, name: 'export_reports', display_name: 'Export CSV/Excel Reports', description: 'Download analytical audit spreadsheets and sales data', is_system: true },
  { id: 20, name: 'view_profit_loss', display_name: 'View Profit & Loss Margins', description: 'View net income profit margins, revenue vs. cost breakdown', is_system: true },
  { id: 21, name: 'manage_cashier_accounts', display_name: 'Audit Cashier Accounts', description: 'Monitor cashier shift attendances and cash drawer reconciliations', is_system: true },
  { id: 22, name: 'process_refund', display_name: 'Process Refunds', description: 'Authorize return transactions, refunds and return restockings', is_system: true },
  { id: 23, name: 'manage_loyalty_customers', display_name: 'Manage CRM Customers', description: 'Lookup member profiles and register new loyalty members', is_system: true },
  { id: 24, name: 'adjust_loyalty_points', display_name: 'Adjust Loyalty Points', description: 'Manually edit customer tier ranks and reward points balances', is_system: true },
  { id: 25, name: 'delete_customers', display_name: 'Delete Customer Records', description: 'Permanently remove customer profiles from CRM records', is_system: true }
];

export const ROLE_PERMISSIONS: Record<RoleName, PermissionName[]> = {
  super_admin: [
    'manage_users',
    'delete_staff',
    'admin_reset_password',
    'manage_roles',
    'manage_shifts',
    'manage_tasks',
    'manage_products',
    'delete_products',
    'adjust_stock',
    'manage_categories',
    'print_barcodes',
    'view_cost_prices',
    'process_sale',
    'apply_discounts',
    'hold_orders',
    'manage_currency',
    'adjust_drawer_cash',
    'view_reports',
    'export_reports',
    'view_profit_loss',
    'manage_cashier_accounts',
    'process_refund',
    'manage_loyalty_customers',
    'adjust_loyalty_points',
    'delete_customers'
  ],
  admin: [
    'manage_users',
    'delete_staff',
    'admin_reset_password',
    'manage_roles',
    'manage_shifts',
    'manage_tasks',
    'manage_products',
    'delete_products',
    'adjust_stock',
    'manage_categories',
    'print_barcodes',
    'view_cost_prices',
    'process_sale',
    'apply_discounts',
    'hold_orders',
    'manage_currency',
    'adjust_drawer_cash',
    'view_reports',
    'export_reports',
    'view_profit_loss',
    'manage_cashier_accounts',
    'process_refund',
    'manage_loyalty_customers',
    'adjust_loyalty_points',
    'delete_customers'
  ],
  inventory_manager: [
    'manage_products',
    'adjust_stock',
    'manage_categories',
    'print_barcodes',
    'view_cost_prices',
    'view_reports'
  ],
  cashier: [
    'process_sale',
    'hold_orders',
    'manage_loyalty_customers',
    'adjust_drawer_cash'
  ]
};

export const INITIAL_USERS: User[] = [
  {
    id: 1,
    name: 'Super Admin',
    email: 'superadmin@smartpos.local',
    phone: '012345000',
    role_id: 1,
    role_name: 'super_admin',
    shift_name: 'Morning',
    shift_start: '06:00:00',
    shift_end: '14:00:00',
    profile_picture: '73cad91d621142b1b46d3aac4a1d3770.jpg',
    password_hash: 'password',
    is_active: true
  },
  {
    id: 2,
    name: 'Admin Manager',
    email: 'admin@smartpos.local',
    phone: '012345001',
    role_id: 2,
    role_name: 'admin',
    shift_name: 'Morning',
    shift_start: '06:00:00',
    shift_end: '14:00:00',
    profile_picture: '109d0bba2885419aa36f1cf95552b8ee.png',
    password_hash: 'password',
    is_active: true
  },
  {
    id: 3,
    name: 'Vibol Inventory',
    email: 'inventory@smartpos.local',
    phone: '012345003',
    role_id: 3,
    role_name: 'inventory_manager',
    shift_name: 'Afternoon',
    shift_start: '10:00:00',
    shift_end: '18:00:00',
    profile_picture: '64b7647b32ed4d23bebd67b77aad3d11.jpg',
    password_hash: 'password',
    is_active: true
  },
  {
    id: 4,
    name: 'Channa Cashier',
    email: 'cashier@smartpos.local',
    phone: '012345004',
    role_id: 4,
    role_name: 'cashier',
    shift_name: 'Evening',
    shift_start: '14:00:00',
    shift_end: '22:00:00',
    profile_picture: 'f86e67858910489ba513eae41ad5b941.png',
    password_hash: 'password',
    is_active: true
  }
];

export const INITIAL_CATEGORIES: Category[] = [
  { id: 1, name: 'Snacks', description: 'Chips, cookies, candy, and other snack foods', icon: 'fa-cookie-bite' },
  { id: 2, name: 'Beverages', description: 'Soft drinks, juices, water, and other drinks', icon: 'fa-bottle-water' },
  { id: 3, name: 'Dairy', description: 'Milk, cheese, yogurt, and other dairy products', icon: 'fa-cheese' },
  { id: 4, name: 'Household', description: 'Cleaning supplies and household essentials', icon: 'fa-broom' },
  { id: 5, name: 'Personal Care', description: 'Soap, shampoo, and other personal care items', icon: 'fa-pump-soap' },
  { id: 6, name: 'Pantry', description: 'Cooking oil, canned goods, sauces, and dry goods', icon: 'fa-jar' }
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  { id: 1, name: 'Mekong Distribution Co.', contact_name: 'Sok Dara', phone: '012 345 678', email: 'sales@mekongdist.com', address: 'Phnom Penh, Cambodia' },
  { id: 2, name: 'Golden Rice Trading', contact_name: 'Chan Vibol', phone: '098 765 432', email: 'orders@goldenrice.com', address: 'Battambang, Cambodia' },
  { id: 3, name: 'Angkor Fresh Supplies', contact_name: 'Ly Sophea', phone: '077 111 222', email: 'contact@angkorfresh.com', address: 'Siem Reap, Cambodia' }
];

export const INITIAL_SHIFTS: ShiftTemplate[] = [
  { id: 1, name: 'Morning', start_time: '06:00:00', end_time: '14:00:00' },
  { id: 2, name: 'Afternoon', start_time: '10:00:00', end_time: '18:00:00' },
  { id: 3, name: 'Evening', start_time: '14:00:00', end_time: '22:00:00' },
  { id: 4, name: 'Night', start_time: '22:00:00', end_time: '06:00:00' }
];

export const INITIAL_CUSTOMERS: Customer[] = [
  { phone: '012345678', name: 'Sara Heng', join_date: '2026-01-10', points: 340, tier: 'Gold', discount_rate: 5, notes: 'Prefers snacks and vital water' },
  { phone: '098765432', name: 'Dara Kong', join_date: '2026-02-14', points: 180, tier: 'Silver', discount_rate: 3, notes: 'Daily afternoon visitor' },
  { phone: '077111222', name: 'Bopha Pich', join_date: '2026-03-01', points: 520, tier: 'VIP', discount_rate: 10, notes: 'Pantry wholesale buyer' }
];

export const INITIAL_PRODUCTS: Product[] = [
  { id: 1, sku: 'PRD-001', name: "Cheetos Crunchy Flamin' Hot (28g)", category: 'Snacks', price: 4.00, cost: 2.40, quantity_in_stock: 67, low_stock_threshold: 20, supplier_name: 'Mekong Distribution Co.', image_filename: '7f2260fe2eba469e8659426789ffb6e4.jpg' },
  { id: 2, sku: 'PRD-002', name: 'Doritos Tortilla Chips', category: 'Snacks', price: 5.00, cost: 3.00, quantity_in_stock: 50, low_stock_threshold: 15, supplier_name: 'Mekong Distribution Co.', image_filename: '2d0802d1c82f42039606e68be5f7b9d9.webp' },
  { id: 3, sku: 'PRD-003', name: 'Oreo Cookies Original', category: 'Snacks', price: 2.00, cost: 1.20, quantity_in_stock: 40, low_stock_threshold: 15, supplier_name: 'Mekong Distribution Co.' },
  { id: 4, sku: 'PRD-004', name: 'Takis Fuego', category: 'Snacks', price: 4.00, cost: 2.40, quantity_in_stock: 40, low_stock_threshold: 15, supplier_name: 'Mekong Distribution Co.' },
  { id: 5, sku: 'PRD-005', name: 'Pringles Original', category: 'Snacks', price: 2.50, cost: 1.50, quantity_in_stock: 50, low_stock_threshold: 15, supplier_name: 'Mekong Distribution Co.' },
  { id: 6, sku: 'PRD-006', name: 'Lays Classic Potato Chips', category: 'Snacks', price: 1.50, cost: 0.90, quantity_in_stock: 45, low_stock_threshold: 15, supplier_name: 'Mekong Distribution Co.' },
  { id: 7, sku: 'PRD-007', name: 'Lays Nori Seaweed Flavor', category: 'Snacks', price: 1.50, cost: 0.90, quantity_in_stock: 55, low_stock_threshold: 15, supplier_name: 'Mekong Distribution Co.' },
  { id: 8, sku: 'PRD-008', name: 'Samyang Buldak Hot Chicken Snack', category: 'Snacks', price: 1.20, cost: 0.72, quantity_in_stock: 80, low_stock_threshold: 25, supplier_name: 'Mekong Distribution Co.' },
  { id: 9, sku: 'PRD-009', name: 'Lyly Rice Crackers', category: 'Snacks', price: 0.80, cost: 0.48, quantity_in_stock: 60, low_stock_threshold: 20, supplier_name: 'Golden Rice Trading' },
  { id: 10, sku: 'PRD-010', name: 'Dongwon Yangban Seaweed', category: 'Snacks', price: 1.50, cost: 0.90, quantity_in_stock: 40, low_stock_threshold: 15, supplier_name: 'Mekong Distribution Co.' },
  { id: 11, sku: 'PRD-011', name: 'Pocky Chocolate', category: 'Snacks', price: 1.00, cost: 0.60, quantity_in_stock: 50, low_stock_threshold: 15, supplier_name: 'Mekong Distribution Co.' },
  { id: 12, sku: 'PRD-012', name: 'Pocky Strawberry', category: 'Snacks', price: 1.00, cost: 0.60, quantity_in_stock: 45, low_stock_threshold: 15, supplier_name: 'Mekong Distribution Co.' },
  { id: 13, sku: 'PRD-013', name: 'Hello Panda Chocolate', category: 'Snacks', price: 0.90, cost: 0.54, quantity_in_stock: 35, low_stock_threshold: 10, supplier_name: 'Mekong Distribution Co.' },
  { id: 14, sku: 'PRD-014', name: 'Snickers Bar', category: 'Snacks', price: 1.20, cost: 0.72, quantity_in_stock: 40, low_stock_threshold: 15, supplier_name: 'Mekong Distribution Co.' },
  { id: 15, sku: 'PRD-015', name: "M&M's Peanut", category: 'Snacks', price: 1.50, cost: 0.90, quantity_in_stock: 30, low_stock_threshold: 10, supplier_name: 'Mekong Distribution Co.' },
  { id: 16, sku: 'PRD-016', name: 'Skittles Original', category: 'Snacks', price: 1.20, cost: 0.72, quantity_in_stock: 25, low_stock_threshold: 10, supplier_name: 'Mekong Distribution Co.' },
  { id: 17, sku: 'PRD-017', name: 'KitKat 4-Finger', category: 'Snacks', price: 1.00, cost: 0.60, quantity_in_stock: 50, low_stock_threshold: 15, supplier_name: 'Mekong Distribution Co.' },
  { id: 18, sku: 'PRD-018', name: 'Toblerone Milk Chocolate', category: 'Snacks', price: 2.50, cost: 1.50, quantity_in_stock: 4, low_stock_threshold: 5, supplier_name: 'Mekong Distribution Co.' },
  { id: 19, sku: 'PRD-019', name: 'Ferrero Rocher (3-piece)', category: 'Snacks', price: 2.00, cost: 1.20, quantity_in_stock: 30, low_stock_threshold: 10, supplier_name: 'Mekong Distribution Co.' },
  { id: 20, sku: 'PRD-020', name: 'Kinder Joy', category: 'Snacks', price: 1.50, cost: 0.90, quantity_in_stock: 25, low_stock_threshold: 10, supplier_name: 'Mekong Distribution Co.' },
  { id: 21, sku: 'PRD-021', name: 'LOTTE Choco Pie (Single)', category: 'Snacks', price: 0.50, cost: 0.30, quantity_in_stock: 60, low_stock_threshold: 20, supplier_name: 'Mekong Distribution Co.' },
  { id: 22, sku: 'PRD-022', name: 'LOTTE Pepero', category: 'Snacks', price: 1.20, cost: 0.72, quantity_in_stock: 40, low_stock_threshold: 15, supplier_name: 'Mekong Distribution Co.' },
  { id: 23, sku: 'PRD-023', name: 'Roller Coaster Potato Rings', category: 'Snacks', price: 0.80, cost: 0.48, quantity_in_stock: 45, low_stock_threshold: 15, supplier_name: 'Mekong Distribution Co.' },
  { id: 24, sku: 'PRD-024', name: 'Planters Salted Peanuts', category: 'Snacks', price: 1.50, cost: 0.90, quantity_in_stock: 35, low_stock_threshold: 10, supplier_name: 'Mekong Distribution Co.' },
  { id: 25, sku: 'PRD-025', name: 'Mentos Mint Roll', category: 'Snacks', price: 0.60, cost: 0.36, quantity_in_stock: 55, low_stock_threshold: 20, supplier_name: 'Mekong Distribution Co.' },
  { id: 26, sku: 'PRD-026', name: 'Halls Mentholyptus Candy (Stick)', category: 'Snacks', price: 0.50, cost: 0.30, quantity_in_stock: 60, low_stock_threshold: 20, supplier_name: 'Mekong Distribution Co.' },
  { id: 27, sku: 'PRD-027', name: 'Kopiko Coffee Candies (Pack)', category: 'Snacks', price: 1.00, cost: 0.60, quantity_in_stock: 40, low_stock_threshold: 15, supplier_name: 'Mekong Distribution Co.' },
  { id: 28, sku: 'PRD-028', name: 'Haribo Goldbears', category: 'Snacks', price: 1.50, cost: 0.90, quantity_in_stock: 30, low_stock_threshold: 10, supplier_name: 'Mekong Distribution Co.' },
  { id: 29, sku: 'PRD-029', name: 'Yupi Gummy Bears', category: 'Snacks', price: 1.00, cost: 0.60, quantity_in_stock: 40, low_stock_threshold: 15, supplier_name: 'Mekong Distribution Co.' },
  { id: 30, sku: 'PRD-030', name: 'Sugus Fruit Chews', category: 'Snacks', price: 0.80, cost: 0.48, quantity_in_stock: 35, low_stock_threshold: 10, supplier_name: 'Mekong Distribution Co.' },
  { id: 31, sku: 'PRD-031', name: 'Vital Premium Water (500ml)', category: 'Beverages', price: 0.25, cost: 0.15, quantity_in_stock: 100, low_stock_threshold: 30, supplier_name: 'Angkor Fresh Supplies' },
  { id: 32, sku: 'PRD-032', name: 'Dasani Purified Water (500ml)', category: 'Beverages', price: 0.30, cost: 0.18, quantity_in_stock: 80, low_stock_threshold: 25, supplier_name: 'Angkor Fresh Supplies' },
  { id: 33, sku: 'PRD-033', name: 'Coca-Cola Can (330ml)', category: 'Beverages', price: 0.60, cost: 0.36, quantity_in_stock: 90, low_stock_threshold: 30, supplier_name: 'Angkor Fresh Supplies' },
  { id: 34, sku: 'PRD-034', name: 'Sprite Can (330ml)', category: 'Beverages', price: 0.60, cost: 0.36, quantity_in_stock: 70, low_stock_threshold: 20, supplier_name: 'Angkor Fresh Supplies' },
  { id: 35, sku: 'PRD-035', name: 'Fanta Orange Can (330ml)', category: 'Beverages', price: 0.60, cost: 0.36, quantity_in_stock: 60, low_stock_threshold: 20, supplier_name: 'Angkor Fresh Supplies' },
  { id: 36, sku: 'PRD-036', name: 'Bacchus Energy Drink', category: 'Beverages', price: 0.70, cost: 0.42, quantity_in_stock: 120, low_stock_threshold: 40, supplier_name: 'Angkor Fresh Supplies' },
  { id: 37, sku: 'PRD-037', name: 'Sting Energy Drink (Strawberry)', category: 'Beverages', price: 0.50, cost: 0.30, quantity_in_stock: 100, low_stock_threshold: 30, supplier_name: 'Angkor Fresh Supplies' },
  { id: 38, sku: 'PRD-038', name: 'Champion Energy Drink', category: 'Beverages', price: 0.60, cost: 0.36, quantity_in_stock: 85, low_stock_threshold: 25, supplier_name: 'Angkor Fresh Supplies' },
  { id: 39, sku: 'PRD-039', name: 'Wurkz Energy Drink', category: 'Beverages', price: 0.70, cost: 0.42, quantity_in_stock: 90, low_stock_threshold: 30, supplier_name: 'Angkor Fresh Supplies' },
  { id: 40, sku: 'PRD-040', name: "Yeo's Chrysanthemum Tea", category: 'Beverages', price: 0.80, cost: 0.48, quantity_in_stock: 50, low_stock_threshold: 15, supplier_name: 'Angkor Fresh Supplies' },
  { id: 41, sku: 'PRD-041', name: 'Pokka Melon Milk', category: 'Beverages', price: 1.00, cost: 0.60, quantity_in_stock: 40, low_stock_threshold: 15, supplier_name: 'Angkor Fresh Supplies' },
  { id: 42, sku: 'PRD-042', name: 'Nescafe Iced Coffee Can', category: 'Beverages', price: 0.80, cost: 0.48, quantity_in_stock: 60, low_stock_threshold: 20, supplier_name: 'Angkor Fresh Supplies' },
  { id: 43, sku: 'PRD-043', name: 'Angkor Beer Can (330ml)', category: 'Beverages', price: 0.80, cost: 0.48, quantity_in_stock: 150, low_stock_threshold: 50, supplier_name: 'Angkor Fresh Supplies' },
  { id: 44, sku: 'PRD-044', name: 'Hanuman Beer Can (330ml)', category: 'Beverages', price: 0.85, cost: 0.51, quantity_in_stock: 120, low_stock_threshold: 40, supplier_name: 'Angkor Fresh Supplies' },
  { id: 45, sku: 'PRD-045', name: 'V-Active Isotonic Drink', category: 'Beverages', price: 0.60, cost: 0.36, quantity_in_stock: 45, low_stock_threshold: 15, supplier_name: 'Angkor Fresh Supplies' },
  { id: 46, sku: 'PRD-046', name: 'Paseo Facial Tissue (Box)', category: 'Household', price: 1.50, cost: 0.90, quantity_in_stock: 30, low_stock_threshold: 10, supplier_name: 'Mekong Distribution Co.' },
  { id: 47, sku: 'PRD-047', name: 'Vinda Tissue Paper (3-ply pack)', category: 'Household', price: 1.20, cost: 0.72, quantity_in_stock: 40, low_stock_threshold: 15, supplier_name: 'Mekong Distribution Co.' },
  { id: 48, sku: 'PRD-048', name: 'Scott Toilet Paper (4 Rolls)', category: 'Household', price: 2.50, cost: 1.50, quantity_in_stock: 25, low_stock_threshold: 10, supplier_name: 'Mekong Distribution Co.' },
  { id: 49, sku: 'PRD-049', name: 'Omo Laundry Detergent Powder', category: 'Household', price: 2.00, cost: 1.20, quantity_in_stock: 35, low_stock_threshold: 10, supplier_name: 'Mekong Distribution Co.' },
  { id: 50, sku: 'PRD-050', name: 'Sunlight Lemon Dishwashing Liquid', category: 'Household', price: 1.50, cost: 0.90, quantity_in_stock: 40, low_stock_threshold: 15, supplier_name: 'Mekong Distribution Co.' },
  { id: 51, sku: 'PRD-051', name: 'Downy Fabric Softener', category: 'Household', price: 1.80, cost: 1.08, quantity_in_stock: 45, low_stock_threshold: 15, supplier_name: 'Mekong Distribution Co.' },
  { id: 52, sku: 'PRD-052', name: 'Vim Floor Cleaner', category: 'Household', price: 2.50, cost: 1.50, quantity_in_stock: 20, low_stock_threshold: 5, supplier_name: 'Mekong Distribution Co.' },
  { id: 53, sku: 'PRD-053', name: 'Duck Toilet Bowl Cleaner', category: 'Household', price: 2.00, cost: 1.20, quantity_in_stock: 25, low_stock_threshold: 10, supplier_name: 'Mekong Distribution Co.' },
  { id: 54, sku: 'PRD-054', name: 'Scotch-Brite Dish Sponge', category: 'Household', price: 0.80, cost: 0.48, quantity_in_stock: 50, low_stock_threshold: 15, supplier_name: 'Mekong Distribution Co.' },
  { id: 55, sku: 'PRD-055', name: 'Baygon Mosquito Repellent Spray', category: 'Household', price: 3.50, cost: 2.10, quantity_in_stock: 15, low_stock_threshold: 5, supplier_name: 'Mekong Distribution Co.' },
  { id: 56, sku: 'PRD-056', name: 'Medium Trash Bags (Roll)', category: 'Household', price: 1.50, cost: 0.90, quantity_in_stock: 40, low_stock_threshold: 10, supplier_name: 'Mekong Distribution Co.' },
  { id: 57, sku: 'PRD-057', name: 'Mr. Muscle Glass Cleaner', category: 'Household', price: 2.50, cost: 1.50, quantity_in_stock: 20, low_stock_threshold: 5, supplier_name: 'Mekong Distribution Co.' },
  { id: 58, sku: 'PRD-058', name: 'Green Cross Rubbing Alcohol', category: 'Household', price: 1.50, cost: 0.90, quantity_in_stock: 30, low_stock_threshold: 10, supplier_name: 'Mekong Distribution Co.' },
  { id: 59, sku: 'PRD-059', name: 'Febreze Air Freshener', category: 'Household', price: 3.00, cost: 1.80, quantity_in_stock: 15, low_stock_threshold: 5, supplier_name: 'Mekong Distribution Co.' },
  { id: 60, sku: 'PRD-060', name: 'Kitchen Paper Towel (Roll)', category: 'Household', price: 1.20, cost: 0.72, quantity_in_stock: 35, low_stock_threshold: 10, supplier_name: 'Mekong Distribution Co.' },
  { id: 61, sku: 'PRD-061', name: 'Colgate Cavity Protection Toothpaste', category: 'Personal Care', price: 1.80, cost: 1.08, quantity_in_stock: 40, low_stock_threshold: 15, supplier_name: 'Mekong Distribution Co.' },
  { id: 62, sku: 'PRD-062', name: 'Sensodyne Repair & Protect', category: 'Personal Care', price: 4.50, cost: 2.70, quantity_in_stock: 15, low_stock_threshold: 5, supplier_name: 'Mekong Distribution Co.' },
  { id: 63, sku: 'PRD-063', name: 'Oral-B Soft Toothbrush', category: 'Personal Care', price: 1.50, cost: 0.90, quantity_in_stock: 50, low_stock_threshold: 15, supplier_name: 'Mekong Distribution Co.' },
  { id: 64, sku: 'PRD-064', name: 'Sunsilk Smooth & Manageable Shampoo', category: 'Personal Care', price: 3.00, cost: 1.80, quantity_in_stock: 25, low_stock_threshold: 10, supplier_name: 'Mekong Distribution Co.' },
  { id: 65, sku: 'PRD-065', name: 'Clear Men Anti-Dandruff Shampoo', category: 'Personal Care', price: 3.50, cost: 2.10, quantity_in_stock: 20, low_stock_threshold: 5, supplier_name: 'Mekong Distribution Co.' },
  { id: 66, sku: 'PRD-066', name: 'Dove Beauty Moisture Body Wash', category: 'Personal Care', price: 4.00, cost: 2.40, quantity_in_stock: 20, low_stock_threshold: 5, supplier_name: 'Mekong Distribution Co.' },
  { id: 67, sku: 'PRD-067', name: 'Lux Botanical Bar Soap', category: 'Personal Care', price: 1.00, cost: 0.60, quantity_in_stock: 60, low_stock_threshold: 20, supplier_name: 'Mekong Distribution Co.' },
  { id: 68, sku: 'PRD-068', name: 'Protex Antibacterial Talcum Powder', category: 'Personal Care', price: 2.00, cost: 1.20, quantity_in_stock: 30, low_stock_threshold: 10, supplier_name: 'Mekong Distribution Co.' },
  { id: 69, sku: 'PRD-069', name: 'Nivea Pearl & Beauty Roll-On', category: 'Personal Care', price: 2.50, cost: 1.50, quantity_in_stock: 35, low_stock_threshold: 10, supplier_name: 'Mekong Distribution Co.' },
  { id: 70, sku: 'PRD-070', name: 'Vaseline Healthy Bright Lotion', category: 'Personal Care', price: 3.50, cost: 2.10, quantity_in_stock: 25, low_stock_threshold: 10, supplier_name: 'Mekong Distribution Co.' },
  { id: 71, sku: 'PRD-071', name: 'Kotex Maxi Pads (Pack)', category: 'Personal Care', price: 1.80, cost: 1.08, quantity_in_stock: 40, low_stock_threshold: 15, supplier_name: 'Mekong Distribution Co.' },
  { id: 72, sku: 'PRD-072', name: 'Carefree Panty Liners', category: 'Personal Care', price: 1.50, cost: 0.90, quantity_in_stock: 35, low_stock_threshold: 10, supplier_name: 'Mekong Distribution Co.' },
  { id: 73, sku: 'PRD-073', name: 'Gillette Blue 3 Disposable Razors', category: 'Personal Care', price: 2.50, cost: 1.50, quantity_in_stock: 30, low_stock_threshold: 10, supplier_name: 'Mekong Distribution Co.' },
  { id: 74, sku: 'PRD-074', name: 'Panadol Extra (Strip of 10)', category: 'Personal Care', price: 1.20, cost: 0.72, quantity_in_stock: 50, low_stock_threshold: 15, supplier_name: 'Mekong Distribution Co.' },
  { id: 75, sku: 'PRD-075', name: 'Tiger Balm (Red, Small)', category: 'Personal Care', price: 1.50, cost: 0.90, quantity_in_stock: 40, low_stock_threshold: 10, supplier_name: 'Mekong Distribution Co.' },
  { id: 76, sku: 'PRD-076', name: 'Mee Chiet Instant Noodles (Pork)', category: 'Pantry', price: 0.40, cost: 0.24, quantity_in_stock: 120, low_stock_threshold: 40, supplier_name: 'Golden Rice Trading' },
  { id: 77, sku: 'PRD-077', name: 'Hao Hao Instant Noodles', category: 'Pantry', price: 0.40, cost: 0.24, quantity_in_stock: 120, low_stock_threshold: 40, supplier_name: 'Golden Rice Trading' },
  { id: 78, sku: 'PRD-078', name: 'Indomie Mi Goreng', category: 'Pantry', price: 0.50, cost: 0.30, quantity_in_stock: 100, low_stock_threshold: 30, supplier_name: 'Golden Rice Trading' },
  { id: 79, sku: 'PRD-079', name: 'Nongshim Shin Ramyun', category: 'Pantry', price: 1.20, cost: 0.72, quantity_in_stock: 60, low_stock_threshold: 20, supplier_name: 'Golden Rice Trading' },
  { id: 80, sku: 'PRD-080', name: 'Phka Rumduol Jasmine Rice (5kg)', category: 'Pantry', price: 5.50, cost: 3.30, quantity_in_stock: 15, low_stock_threshold: 5, supplier_name: 'Golden Rice Trading' },
  { id: 81, sku: 'PRD-081', name: 'Kampot Pepper (50g)', category: 'Pantry', price: 3.00, cost: 1.80, quantity_in_stock: 25, low_stock_threshold: 10, supplier_name: 'Golden Rice Trading' },
  { id: 82, sku: 'PRD-082', name: 'Lee Kum Kee Soy Sauce', category: 'Pantry', price: 1.80, cost: 1.08, quantity_in_stock: 30, low_stock_threshold: 10, supplier_name: 'Golden Rice Trading' },
  { id: 83, sku: 'PRD-083', name: 'Maggi Seasoning Sauce', category: 'Pantry', price: 1.50, cost: 0.90, quantity_in_stock: 35, low_stock_threshold: 10, supplier_name: 'Golden Rice Trading' },
  { id: 84, sku: 'PRD-084', name: 'Heinz Tomato Ketchup', category: 'Pantry', price: 2.50, cost: 1.50, quantity_in_stock: 20, low_stock_threshold: 5, supplier_name: 'Golden Rice Trading' },
  { id: 85, sku: 'PRD-085', name: 'Cholimex Chili Sauce', category: 'Pantry', price: 1.20, cost: 0.72, quantity_in_stock: 40, low_stock_threshold: 15, supplier_name: 'Golden Rice Trading' },
  { id: 86, sku: 'PRD-086', name: 'Knorr Chicken Flavor Bouillon', category: 'Pantry', price: 1.50, cost: 0.90, quantity_in_stock: 45, low_stock_threshold: 15, supplier_name: 'Golden Rice Trading' },
  { id: 87, sku: 'PRD-087', name: 'Ajinomoto MSG (Small Bag)', category: 'Pantry', price: 0.80, cost: 0.48, quantity_in_stock: 60, low_stock_threshold: 20, supplier_name: 'Golden Rice Trading' },
  { id: 88, sku: 'PRD-088', name: 'Ayam Brand Canned Sardines', category: 'Pantry', price: 1.80, cost: 1.08, quantity_in_stock: 50, low_stock_threshold: 15, supplier_name: 'Golden Rice Trading' },
  { id: 89, sku: 'PRD-089', name: 'Century Tuna Flakes in Oil', category: 'Pantry', price: 1.50, cost: 0.90, quantity_in_stock: 45, low_stock_threshold: 15, supplier_name: 'Golden Rice Trading' },
  { id: 90, sku: 'PRD-090', name: 'Meizan Vegetable Cooking Oil (1L)', category: 'Pantry', price: 2.50, cost: 1.50, quantity_in_stock: 30, low_stock_threshold: 10, supplier_name: 'Golden Rice Trading' },
  { id: 91, sku: 'PRD-091', name: 'Meiji Fresh Milk (830ml)', category: 'Dairy', price: 2.80, cost: 1.68, quantity_in_stock: 15, low_stock_threshold: 5, supplier_name: 'Angkor Fresh Supplies' },
  { id: 92, sku: 'PRD-092', name: 'Meiji Chocolate Milk (830ml)', category: 'Dairy', price: 2.80, cost: 1.68, quantity_in_stock: 15, low_stock_threshold: 5, supplier_name: 'Angkor Fresh Supplies' },
  { id: 93, sku: 'PRD-093', name: 'Yakult Probiotic Drink (5-Pack)', category: 'Dairy', price: 1.50, cost: 0.90, quantity_in_stock: 40, low_stock_threshold: 15, supplier_name: 'Angkor Fresh Supplies' },
  { id: 94, sku: 'PRD-094', name: 'Meiji Paigen Cultured Milk', category: 'Dairy', price: 0.80, cost: 0.48, quantity_in_stock: 40, low_stock_threshold: 15, supplier_name: 'Angkor Fresh Supplies' },
  { id: 95, sku: 'PRD-095', name: 'Vinamilk Drinking Yogurt', category: 'Dairy', price: 0.60, cost: 0.36, quantity_in_stock: 60, low_stock_threshold: 20, supplier_name: 'Angkor Fresh Supplies' },
  { id: 96, sku: 'PRD-096', name: 'Anchor Cheddar Cheese Slices', category: 'Dairy', price: 3.50, cost: 2.10, quantity_in_stock: 20, low_stock_threshold: 5, supplier_name: 'Angkor Fresh Supplies' },
  { id: 97, sku: 'PRD-097', name: 'La Vache Qui Rit (8 Portions)', category: 'Dairy', price: 2.50, cost: 1.50, quantity_in_stock: 25, low_stock_threshold: 10, supplier_name: 'Angkor Fresh Supplies' },
  { id: 98, sku: 'PRD-098', name: 'Carnation Evaporated Milk', category: 'Dairy', price: 1.20, cost: 0.72, quantity_in_stock: 35, low_stock_threshold: 10, supplier_name: 'Angkor Fresh Supplies' },
  { id: 99, sku: 'PRD-099', name: 'Milkmaid Condensed Milk', category: 'Dairy', price: 1.50, cost: 0.90, quantity_in_stock: 40, low_stock_threshold: 10, supplier_name: 'Angkor Fresh Supplies' },
  { id: 100, sku: 'PRD-100', name: 'Anchor Unsalted Butter (227g)', category: 'Dairy', price: 4.00, cost: 2.40, quantity_in_stock: 3, low_stock_threshold: 5, supplier_name: 'Angkor Fresh Supplies' }
];

export const INITIAL_SALES: Sale[] = [
  {
    id: 1001,
    cashier_id: 4,
    cashier_name: 'Channa Cashier',
    discount_percent: 0,
    tax_percent: 0,
    payment_method: 'cash',
    customer_phone: '012345678',
    customer_name: 'Sara Heng',
    masked_customer: 'Sara012',
    total_amount: 11.50,
    subtotal: 11.50,
    tax_amount: 0,
    discount_amount: 0,
    created_at: new Date(Date.now() - 3600000 * 4).toISOString().replace('T', ' ').slice(0, 19),
    items: [
      { id: 1, sale_id: 1001, product_id: 1, product_name: "Cheetos Crunchy Flamin' Hot (28g)", quantity: 2, unit_price: 4.00, line_total: 8.00 },
      { id: 2, sale_id: 1001, product_id: 5, product_name: 'Pringles Original', quantity: 1, unit_price: 2.50, line_total: 2.50 },
      { id: 3, sale_id: 1001, product_id: 31, product_name: 'Vital Premium Water (500ml)', quantity: 4, unit_price: 0.25, line_total: 1.00 }
    ]
  },
  {
    id: 1002,
    cashier_id: 4,
    cashier_name: 'Channa Cashier',
    discount_percent: 5,
    tax_percent: 0,
    payment_method: 'qr',
    customer_phone: '098765432',
    customer_name: 'Dara Kong',
    masked_customer: 'Dara098',
    total_amount: 8.55,
    subtotal: 9.00,
    tax_amount: 0,
    discount_amount: 0.45,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString().replace('T', ' ').slice(0, 19),
    items: [
      { id: 4, sale_id: 1002, product_id: 2, product_name: 'Doritos Tortilla Chips', quantity: 1, unit_price: 5.00, line_total: 5.00 },
      { id: 5, sale_id: 1002, product_id: 33, product_name: 'Coca-Cola Can (330ml)', quantity: 2, unit_price: 0.60, line_total: 1.20 },
      { id: 6, sale_id: 1002, product_id: 91, product_name: 'Meiji Fresh Milk (830ml)', quantity: 1, unit_price: 2.80, line_total: 2.80 }
    ]
  },
  {
    id: 1003,
    cashier_id: 1,
    cashier_name: 'Super Admin',
    discount_percent: 0,
    tax_percent: 0,
    payment_method: 'credit_card',
    customer_phone: '077111222',
    customer_name: 'Bopha Pich',
    masked_customer: 'Bopha077',
    total_amount: 14.50,
    subtotal: 14.50,
    tax_amount: 0,
    discount_amount: 0,
    created_at: new Date(Date.now() - 3600000).toISOString().replace('T', ' ').slice(0, 19),
    items: [
      { id: 7, sale_id: 1003, product_id: 80, product_name: 'Phka Rumduol Jasmine Rice (5kg)', quantity: 2, unit_price: 5.50, line_total: 11.00 },
      { id: 8, sale_id: 1003, product_id: 90, product_name: 'Meizan Vegetable Cooking Oil (1L)', quantity: 1, unit_price: 2.50, line_total: 2.50 },
      { id: 9, sale_id: 1003, product_id: 87, product_name: 'Ajinomoto MSG (Small Bag)', quantity: 1, unit_price: 0.80, line_total: 0.80 },
      { id: 10, sale_id: 1003, product_id: 31, product_name: 'Vital Premium Water (500ml)', quantity: 1, unit_price: 0.25, line_total: 0.25 }
    ]
  }
];

export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: 1,
    product_id: 18,
    product_name: 'Toblerone Milk Chocolate',
    supplier_name: 'Mekong Distribution Co.',
    supplier_contact: '012 345 678',
    quantity_ordered: 30,
    unit_cost: 1.50,
    total_cost: 45.00,
    status: 'ordered',
    ordered_by: 3,
    ordered_by_name: 'Vibol Inventory',
    ordered_at: new Date(Date.now() - 86400000 * 2).toISOString().replace('T', ' ').slice(0, 19),
    notes: 'Low stock restock for chocolates section'
  },
  {
    id: 2,
    product_id: 100,
    product_name: 'Anchor Unsalted Butter (227g)',
    supplier_name: 'Angkor Fresh Supplies',
    supplier_contact: '077 111 222',
    quantity_ordered: 25,
    unit_cost: 2.40,
    total_cost: 60.00,
    status: 'ordered',
    ordered_by: 2,
    ordered_by_name: 'Admin Manager',
    ordered_at: new Date(Date.now() - 86400000).toISOString().replace('T', ' ').slice(0, 19),
    notes: 'Dairy fridge replenishing'
  },
  {
    id: 3,
    product_id: 31,
    product_name: 'Vital Premium Water (500ml)',
    supplier_name: 'Angkor Fresh Supplies',
    supplier_contact: '077 111 222',
    quantity_ordered: 100,
    unit_cost: 0.15,
    total_cost: 15.00,
    status: 'received',
    ordered_by: 3,
    ordered_by_name: 'Vibol Inventory',
    received_by: 3,
    received_by_name: 'Vibol Inventory',
    ordered_at: new Date(Date.now() - 86400000 * 5).toISOString().replace('T', ' ').slice(0, 19),
    received_at: new Date(Date.now() - 86400000 * 3).toISOString().replace('T', ' ').slice(0, 19),
    notes: 'Bulk beverage delivery'
  }
];

export const INITIAL_TASKS: Task[] = [
  {
    id: 1,
    title: 'Restock shelf 3 (Snacks & Candies)',
    description: 'Move 2 boxes of Cheetos and Pocky from back storage to front shelves.',
    assigned_to: 4,
    assigned_to_name: 'Channa Cashier',
    assigned_by: 1,
    assigned_by_name: 'Super Admin',
    status: 'pending',
    priority: 'high',
    due_date: 'Today by 18:00',
    created_at: new Date(Date.now() - 3600000 * 6).toISOString().replace('T', ' ').slice(0, 19)
  },
  {
    id: 2,
    title: 'Audit dairy expiry dates',
    description: 'Check Meiji milk batches in the display chiller.',
    assigned_to: 3,
    assigned_to_name: 'Vibol Inventory',
    assigned_by: 2,
    assigned_by_name: 'Admin Manager',
    status: 'pending',
    priority: 'medium',
    due_date: 'Tomorrow morning',
    created_at: new Date(Date.now() - 3600000 * 12).toISOString().replace('T', ' ').slice(0, 19)
  }
];

export const INITIAL_ATTENDANCE: AttendanceRecord[] = [
  {
    id: 1,
    user_id: 1,
    user_name: 'Super Admin',
    clock_in: new Date(Date.now() - 3600000 * 7).toISOString().replace('T', ' ').slice(0, 19),
    starting_cash: 100.00,
    duration_hours: 7.0,
    is_open: true
  },
  {
    id: 2,
    user_id: 4,
    user_name: 'Channa Cashier',
    clock_in: new Date(Date.now() - 3600000 * 5).toISOString().replace('T', ' ').slice(0, 19),
    starting_cash: 50.00,
    duration_hours: 5.0,
    is_open: true
  },
  {
    id: 3,
    user_id: 3,
    user_name: 'Vibol Inventory',
    clock_in: new Date(Date.now() - 86400000 - 3600000 * 8).toISOString().replace('T', ' ').slice(0, 19),
    clock_out: new Date(Date.now() - 86400000).toISOString().replace('T', ' ').slice(0, 19),
    starting_cash: 0,
    counted_cash: 0,
    expected_cash: 0,
    cash_difference: 0,
    duration_hours: 8.0,
    is_open: false
  }
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 1,
    user_id: 1,
    message: 'Low stock warning: Toblerone Milk Chocolate has only 4 units left (threshold 5).',
    category: 'low_stock',
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 3).toISOString().replace('T', ' ').slice(0, 19)
  },
  {
    id: 2,
    user_id: 1,
    message: 'Low stock warning: Anchor Unsalted Butter (227g) has only 3 units left (threshold 5).',
    category: 'low_stock',
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString().replace('T', ' ').slice(0, 19)
  },
  {
    id: 3,
    user_id: 4,
    message: 'New task assigned: Restock shelf 3 (Snacks & Candies)',
    category: 'task',
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 6).toISOString().replace('T', ' ').slice(0, 19)
  }
];
