export type RoleName = 'super_admin' | 'admin' | 'inventory_manager' | 'cashier' | string;

export type PermissionName =
  | 'manage_users'
  | 'delete_staff'
  | 'admin_reset_password'
  | 'manage_roles'
  | 'manage_shifts'
  | 'manage_tasks'
  | 'manage_products'
  | 'delete_products'
  | 'adjust_stock'
  | 'manage_categories'
  | 'print_barcodes'
  | 'view_cost_prices'
  | 'process_sale'
  | 'apply_discounts'
  | 'hold_orders'
  | 'manage_currency'
  | 'adjust_drawer_cash'
  | 'view_reports'
  | 'export_reports'
  | 'view_profit_loss'
  | 'manage_cashier_accounts'
  | 'process_refund'
  | 'manage_loyalty_customers'
  | 'adjust_loyalty_points'
  | 'delete_customers'
  | string;

export interface RoleItem {
  id: number;
  name: string;
  display_name?: string;
  description?: string;
  is_system?: boolean;
}

export interface PermissionItem {
  id: number;
  name: string;
  display_name?: string;
  description?: string;
  is_system?: boolean;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role_id: number;
  role_name: RoleName;
  profile_picture?: string;
  avatar_url?: string;
  shift_name?: string;
  shift_start?: string;
  shift_end?: string;
  is_active: boolean;
  deactivated_at?: string;
  deactivation_reason?: string;
  password_hash?: string;
  extra_permissions?: string[];
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  quantity_in_stock: number;
  low_stock_threshold: number;
  supplier_name?: string;
  supplier_contact?: string;
  image_filename?: string;
  image_url?: string;
  created_at?: string;
}

export interface Category {
  id: number;
  name: string;
  description: string;
  icon: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
}

export interface Customer {
  phone: string;
  name: string;
  join_date: string;
  points?: number;
  tier?: 'Bronze' | 'Silver' | 'Gold' | 'VIP';
  discount_rate?: number; // e.g. 5 = 5% discount
  notes?: string;
  total_spent?: number;
}

export interface CartItem {
  product_id: number;
  name: string;
  price: number;
  quantity: number;
  sku?: string;
  max_stock: number;
}

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  refunded_quantity?: number;
}

export type PaymentMethod = 'cash' | 'qr' | 'credit_card' | 'split';

export interface SplitPaymentDetail {
  cash_amount: number;
  second_method: 'qr' | 'credit_card';
  second_amount: number;
  cash_tendered?: number;
  cash_change?: number;
}

export interface Sale {
  id: number;
  cashier_id: number;
  cashier_name: string;
  discount_percent: number;
  tax_percent: number;
  payment_method: PaymentMethod;
  split_detail?: SplitPaymentDetail;
  customer_phone?: string;
  customer_name?: string;
  masked_customer?: string;
  total_amount: number;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  cash_received?: number;
  change_due?: number;
  currency?: 'usd' | 'khr' | 'mixed';
  points_redeemed?: number;
  points_discount?: number;
  promotion_tier?: string;
  payment_currency_detail?: {
    mode: 'usd' | 'khr' | 'mixed';
    usd_paid?: number;
    khr_paid?: number;
    change_currency?: 'usd' | 'khr';
    change_usd?: number;
    change_khr?: number;
  };
  created_at: string;
  items: SaleItem[];
}

export interface RefundItem {
  id: number;
  sale_item_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface Refund {
  id: number;
  sale_id: number;
  processed_by: number;
  processed_by_name: string;
  reason?: string;
  refund_amount: number;
  created_at: string;
  items: RefundItem[];
}

export interface PurchaseOrder {
  id: number;
  product_id: number;
  product_name: string;
  supplier_name: string;
  supplier_contact?: string;
  quantity_ordered: number;
  unit_cost: number;
  total_cost: number;
  status: 'ordered' | 'received' | 'cancelled';
  ordered_by: number;
  ordered_by_name: string;
  received_by?: number;
  received_by_name?: string;
  ordered_at: string;
  received_at?: string;
  notes?: string;
}

export interface AttendanceRecord {
  id: number;
  user_id: number;
  user_name: string;
  clock_in: string;
  clock_out?: string;
  starting_cash?: number;
  counted_cash?: number;
  expected_cash?: number;
  cash_difference?: number;
  drawer_cash?: number;
  cash_sales?: number;
  drawer_cash_khr?: number;
  duration_hours: number;
  is_open: boolean;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: number;
  title: string;
  description?: string;
  assigned_to: number;
  assigned_to_name: string;
  assigned_by: number;
  assigned_by_name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  completed_at?: string;
  priority?: TaskPriority;
  due_date?: string;
  notes?: string;
}

export interface HeldOrder {
  id: number;
  cashier_id: number;
  cart: CartItem[];
  discount_percent: number;
  customer_phone?: string;
  customer_name?: string;
  note?: string;
  held_at: string;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  message: string;
  category: 'low_stock' | 'restock' | 'task' | 'general';
  is_read: boolean;
  created_at: string;
}

export interface ShiftTemplate {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
}

export interface StockMovement {
  id: number;
  product_id: number;
  product_name: string;
  change_amount: number;
  reason: string;
  created_at: string;
}
