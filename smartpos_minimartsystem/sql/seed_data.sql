-- ============================================================================
-- SmartPOS Mini-Mart Management System Seed Data
-- ============================================================================

USE `smartpos_minimart`;

-- 1. Insert Roles
INSERT INTO `roles` (`id`, `name`, `display_name`, `is_system`, `description`) VALUES
(1, 'super_admin', 'Super Admin', 1, 'Supreme authority with complete system governance and security administration'),
(2, 'admin', 'Admin', 1, 'Full store operations, staff management, catalog, and reporting'),
(3, 'inventory_manager', 'Inventory Manager', 1, 'Product catalog, stock adjustments, purchase orders, and supplier management'),
(4, 'cashier', 'Cashier', 1, 'Point of Sale checkout register, customer loyalty CRM, and cash drawer transactions')
ON DUPLICATE KEY UPDATE `display_name`=VALUES(`display_name`);

-- 2. Insert 25 Granular System Permissions
INSERT INTO `permissions` (`id`, `name`, `display_name`, `description`, `is_system`) VALUES
(1, 'manage_users', 'Manage Staff', 'Create and update staff member profiles', 1),
(2, 'delete_staff', 'Delete Staff', 'Deactivate and delete employee accounts', 1),
(3, 'admin_reset_password', 'Reset Employee Passwords', 'Perform direct administrative password resets for staff members', 1),
(4, 'manage_roles', 'Manage Roles & RBAC', 'Configure dynamic roles and permission matrices', 1),
(5, 'manage_shifts', 'Manage Work Shifts', 'Configure and assign operational shift schedules', 1),
(6, 'manage_tasks', 'Assign Staff Tasks', 'Create and assign operational duties to team members', 1),
(7, 'manage_products', 'Manage Products', 'Add and edit inventory catalog products and pricing', 1),
(8, 'delete_products', 'Delete Products', 'Remove catalog items permanently from inventory', 1),
(9, 'adjust_stock', 'Adjust Stock Counts', 'Modify inventory on-hand counts, reconciliations and write-offs', 1),
(10, 'manage_categories', 'Manage Categories', 'Create, update, and remove product merchandise categories', 1),
(11, 'print_barcodes', 'Print Barcodes', 'Generate and print SKU barcode label stickers', 1),
(12, 'view_cost_prices', 'View Cost & Profit Margins', 'Inspect wholesale supplier unit costs and item profit margins', 1),
(13, 'process_sale', 'Process POS Sales', 'Operate checkout POS register, scan items, and finalize transactions', 1),
(14, 'apply_discounts', 'Apply Custom Discounts', 'Authorize manual cart discount percentages at checkout', 1),
(15, 'hold_orders', 'Park & Hold Orders', 'Hold active shopping carts and resume parked tickets', 1),
(16, 'manage_currency', 'Change Exchange Rate', 'Modify USD to KHR exchange conversion rates', 1),
(17, 'adjust_drawer_cash', 'Adjust Drawer Cash', 'Open drawer, count floats, and reconcile shift end balances', 1),
(18, 'view_reports', 'View Analytics & Reports', 'Access financial executive summaries and sales reporting views', 1),
(19, 'export_reports', 'Export CSV/Excel Reports', 'Download analytical audit spreadsheets and sales data', 1),
(20, 'view_profit_loss', 'View Profit & Loss Margins', 'View net income profit margins, revenue vs. cost breakdown', 1),
(21, 'manage_cashier_accounts', 'Audit Cashier Accounts', 'Monitor cashier shift attendances and cash drawer reconciliations', 1),
(22, 'process_refund', 'Process Refunds', 'Authorize return transactions, refunds and return restockings', 1),
(23, 'manage_loyalty_customers', 'Manage CRM Customers', 'Lookup member profiles and register new loyalty members', 1),
(24, 'adjust_loyalty_points', 'Adjust Loyalty Points', 'Manually edit customer tier ranks and reward points balances', 1),
(25, 'delete_customers', 'Delete Customer Records', 'Permanently remove customer profiles from CRM records', 1)
ON DUPLICATE KEY UPDATE `display_name`=VALUES(`display_name`);

-- 3. Role Permissions Mapping
-- Super Admin (All Permissions 1 to 25)
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 1, id FROM `permissions`;

-- Admin (Permissions 1 to 25)
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 2, id FROM `permissions`;

-- Inventory Manager (Products, stock, categories, barcodes, cost prices, reports)
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
VALUES 
(3, 7), (3, 8), (3, 9), (3, 10), (3, 11), (3, 12), (3, 18);

-- Cashier (POS, discounts, park orders, refund, loyalty customers)
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
VALUES 
(4, 13), (4, 14), (4, 15), (4, 22), (4, 23);

-- 4. Initial Users
-- Password for all seed users is: password123
-- Stored as werkzeug / bcrypt pbkdf2 sha256 hash
INSERT INTO `users` (`id`, `name`, `email`, `phone`, `password_hash`, `role_id`, `shift_name`, `shift_start`, `shift_end`, `is_active`, `profile_picture`) VALUES
(1, 'Chheanglim Chhum', 'admin@smartpos.local', '012345678', 'pbkdf2:sha256:600000$WvQY8rK9k0xVzYl4$98f0957998e70032757b32e0977e263cd8dbdf3cba68ded4e164ba41956a6dbe', 1, 'Full Day', '08:00:00', '17:00:00', 1, '109d0bba2885419aa36f1cf95552b8ee.png'),
(2, 'Dara Sok', 'cashier@smartpos.local', '098765432', 'pbkdf2:sha256:600000$WvQY8rK9k0xVzYl4$98f0957998e70032757b32e0977e263cd8dbdf3cba68ded4e164ba41956a6dbe', 4, 'Morning', '06:00:00', '14:00:00', 1, '64b7647b32ed4d23bebd67b77aad3d11.jpg'),
(3, 'Bopha Meas', 'inventory@smartpos.local', '077889900', 'pbkdf2:sha256:600000$WvQY8rK9k0xVzYl4$98f0957998e70032757b32e0977e263cd8dbdf3cba68ded4e164ba41956a6dbe', 3, 'Afternoon', '14:00:00', '22:00:00', 1, '73cad91d621142b1b46d3aac4a1d3770.jpg'),
(4, 'Vannak Heng', 'cashier2@smartpos.local', '011223344', 'pbkdf2:sha256:600000$WvQY8rK9k0xVzYl4$98f0957998e70032757b32e0977e263cd8dbdf3cba68ded4e164ba41956a6dbe', 4, 'Night', '22:00:00', '06:00:00', 1, 'f86e67858910489ba513eae41ad5b941.png')
ON DUPLICATE KEY UPDATE `email`=VALUES(`email`), `password_hash`=VALUES(`password_hash`);

-- 5. Categories
INSERT INTO `categories` (`id`, `name`, `description`, `icon`, `is_active`) VALUES
(1, 'Beverages', 'Soft drinks, mineral water, energy drinks, tea and coffee', 'fa-mug-hot', 1),
(2, 'Snacks & Confectionery', 'Crisps, chips, nuts, chocolates, candies and biscuits', 'fa-cookie-bite', 1),
(3, 'Dairy & Eggs', 'Milk, yogurt, cheeses, butter and fresh farm eggs', 'fa-egg', 1),
(4, 'Pantry Essentials', 'Noodles, rice, cooking oils, sauces and seasonings', 'fa-wheat-awn', 1),
(5, 'Bakery', 'Fresh bread, buns, pastries and cakes', 'fa-bread-slice', 1),
(6, 'Personal Care', 'Soaps, shampoos, oral care and hygiene products', 'fa-pump-soap', 1),
(7, 'Household Supplies', 'Detergents, tissue paper, cleaners and batteries', 'fa-spray-can', 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- 6. Suppliers
INSERT INTO `suppliers` (`id`, `name`, `contact_person`, `phone`, `email`, `address`, `is_active`) VALUES
(1, 'Angkor Distributing Co., Ltd.', 'Sovan Rath', '023889900', 'orders@angkordist.com', 'Russian Blvd, Phnom Penh', 1),
(2, 'Khmer Food & Beverage Supply', 'Channary Kim', '012998877', 'sales@kfb-supply.com', 'St. 271, Phnom Penh', 1),
(3, 'Phnom Penh Daily Essentials', 'Kosal Leng', '092554433', 'contact@ppdaily.com', 'Boeung Keng Kang 1, Phnom Penh', 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- 7. Products
INSERT INTO `products` (`id`, `name`, `sku`, `barcode`, `category_id`, `supplier_id`, `price`, `cost_price`, `quantity_in_stock`, `low_stock_threshold`, `unit`, `image_url`, `is_active`) VALUES
(1, 'Coca Cola 330ml Can', 'BEV-COC-330', '8851959141013', 1, 1, 0.65, 0.40, 142, 24, 'can', '7f2260fe2eba469e8659426789ffb6e4.jpg', 1),
(2, 'Red Bull Energy Drink 250ml', 'BEV-RED-250', '8850228000151', 1, 1, 0.85, 0.55, 88, 20, 'can', NULL, 1),
(3, 'Vital Premium Water 500ml', 'BEV-VIT-500', '8841020000018', 1, 2, 0.35, 0.18, 210, 48, 'bottle', NULL, 1),
(4, 'Lay''s Classic Potato Chips 50g', 'SNK-LAY-050', '8850718800100', 2, 2, 1.20, 0.75, 45, 15, 'pack', '2d0802d1c82f42039606e68be5f7b9d9.webp', 1),
(5, 'Oreo Cookies Original 133g', 'SNK-ORE-133', '8992760221016', 2, 2, 1.10, 0.70, 60, 12, 'pack', NULL, 1),
(6, 'Meiji Fresh Milk 946ml', 'DAI-MEI-946', '8850329101112', 3, 3, 2.50, 1.85, 18, 10, 'carton', NULL, 1),
(7, 'Mama Instant Noodles Shrimp 60g', 'PAN-MAM-060', '8851876000011', 4, 2, 0.40, 0.22, 320, 50, 'pack', NULL, 1),
(8, 'Whole Wheat Sandwich Bread', 'BAK-WHT-400', '8841928001290', 5, 3, 1.80, 1.15, 14, 8, 'loaf', NULL, 1),
(9, 'Colgate Total Toothpaste 150g', 'PER-COL-150', '8850006320141', 6, 3, 2.20, 1.40, 32, 10, 'tube', NULL, 1),
(10, 'Puffs Ultra Soft Facial Tissues 2-Ply', 'HOU-PUF-200', '8850987110022', 7, 3, 1.50, 0.90, 48, 15, 'box', NULL, 1)
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- 8. Customers & Loyalty CRM
INSERT INTO `customers` (`id`, `name`, `phone`, `email`, `tier`, `points`, `discount_rate`, `total_spent`, `notes`) VALUES
(1, 'Somnang Pich', '012990011', 'somnang.p@gmail.com', 'VIP', 680, 10.00, 745.50, 'Loyal regular customer. Prefers whole milk and coffee.'),
(2, 'Sreymom Chan', '098112233', 'sreymom.c@gmail.com', 'Gold', 320, 5.00, 340.20, 'Visits weekdays during afternoon shift.'),
(3, 'Piseth Keo', '077445566', 'piseth.keo@gmail.com', 'Silver', 150, 2.00, 165.00, 'Registered during Grand Opening promotion.'),
(4, 'Theara Vuthy', '086778899', 'theara.v@gmail.com', 'Bronze', 45, 0.00, 45.80, 'New customer enrolled this month.')
ON DUPLICATE KEY UPDATE `phone`=VALUES(`phone`);

-- 9. Work Shifts
INSERT INTO `shifts` (`id`, `name`, `start_time`, `end_time`) VALUES
(1, 'Morning Shift', '06:00:00', '14:00:00'),
(2, 'Afternoon Shift', '14:00:00', '22:00:00'),
(3, 'Night Shift', '22:00:00', '06:00:00'),
(4, 'Admin Full Day', '08:00:00', '17:00:00')
ON DUPLICATE KEY UPDATE `name`=VALUES(`name`);

-- 10. Sample Sales & Line Items
INSERT INTO `sales` (`id`, `transaction_code`, `cashier_id`, `customer_id`, `subtotal`, `discount_percent`, `discount_amount`, `tax_percent`, `tax_amount`, `total_amount`, `payment_method`, `currency_mode`, `exchange_rate`, `amount_paid_usd`, `amount_paid_khr`, `change_usd`, `change_khr`, `points_redeemed`, `points_discount_usd`, `points_earned`, `status`, `notes`, `completed_at`) VALUES
(1, 'TXN-20260920-001', 2, 1, 15.40, 10.00, 1.54, 10.00, 1.39, 15.25, 'Cash', 'mixed', 4100.00, 10.00, 25000.00, 0.85, 3500.00, 0, 0.00, 15, 'completed', 'Customer paid $10 USD + 25,000 KHR', '2026-09-20 09:30:15'),
(2, 'TXN-20260921-002', 2, 2, 8.50, 5.00, 0.43, 10.00, 0.81, 8.88, 'KHQR', 'usd', 4100.00, 8.88, 0.00, 0.00, 0.00, 0, 0.00, 9, 'completed', 'Bakong KHQR scanned successfully', '2026-09-21 14:12:40'),
(3, 'TXN-20260922-003', 4, 3, 24.30, 2.00, 0.49, 10.00, 2.38, 26.19, 'Card', 'usd', 4100.00, 26.19, 0.00, 0.00, 0.00, 0, 0.00, 26, 'completed', 'Visa contactless payment', '2026-09-22 18:45:10')
ON DUPLICATE KEY UPDATE `transaction_code`=VALUES(`transaction_code`);

INSERT INTO `sale_items` (`id`, `sale_id`, `product_id`, `product_name`, `sku`, `unit_price`, `cost_price`, `quantity`, `subtotal`, `discount`, `total`) VALUES
(1, 1, 1, 'Coca Cola 330ml Can', 'BEV-COC-330', 0.65, 0.40, 4, 2.60, 0.26, 2.34),
(2, 1, 4, 'Lay''s Classic Potato Chips 50g', 'SNK-LAY-050', 1.20, 0.75, 4, 4.80, 0.48, 4.32),
(3, 1, 6, 'Meiji Fresh Milk 946ml', 'DAI-MEI-946', 2.50, 1.85, 2, 5.00, 0.50, 4.50),
(4, 1, 8, 'Whole Wheat Sandwich Bread', 'BAK-WHT-400', 1.80, 1.15, 1, 1.80, 0.18, 1.62),
(5, 1, 3, 'Vital Premium Water 500ml', 'BEV-VIT-500', 0.35, 0.18, 2, 0.70, 0.07, 0.63),
(6, 2, 2, 'Red Bull Energy Drink 250ml', 'BEV-RED-250', 0.85, 0.55, 4, 3.40, 0.17, 3.23),
(7, 2, 5, 'Oreo Cookies Original 133g', 'SNK-ORE-133', 1.10, 0.70, 2, 2.20, 0.11, 2.09),
(8, 2, 7, 'Mama Instant Noodles Shrimp 60g', 'PAN-MAM-060', 0.40, 0.22, 5, 2.00, 0.10, 1.90),
(9, 3, 9, 'Colgate Total Toothpaste 150g', 'PER-COL-150', 2.20, 1.40, 2, 4.40, 0.09, 4.31),
(10, 3, 10, 'Puffs Ultra Soft Facial Tissues 2-Ply', 'HOU-PUF-200', 1.50, 0.90, 4, 6.00, 0.12, 5.88),
(11, 3, 6, 'Meiji Fresh Milk 946ml', 'DAI-MEI-946', 2.50, 1.85, 4, 10.00, 0.20, 9.80)
ON DUPLICATE KEY UPDATE `id`=VALUES(`id`);

-- 11. Operational Tasks
INSERT INTO `tasks` (`id`, `title`, `description`, `assigned_to`, `assigned_by`, `priority`, `status`, `due_date`, `created_at`) VALUES
(1, 'Audit Beverage Refrigerators', 'Check expiry dates on Meiji milks and yogurts; restock Coca Cola from warehouse.', 2, 1, 'high', 'in_progress', '2026-09-24', NOW()),
(2, 'Restock Instant Noodle Shelves', 'Replenish Mama noodles row and arrange stock using FIFO principle.', 3, 1, 'medium', 'completed', '2026-09-23', NOW()),
(3, 'Weekly Cash Drawer Reconciliation', 'Audit shift starting floats and compare POS receipt summaries with physical cash count.', 2, 1, 'urgent', 'pending', '2026-09-25', NOW())
ON DUPLICATE KEY UPDATE `title`=VALUES(`title`);

-- 12. Attendance Sample
INSERT INTO `attendance` (`id`, `user_id`, `clock_in`, `clock_out`, `status`, `starting_cash`, `counted_cash`, `cash_discrepancy`, `notes`) VALUES
(1, 2, '2026-09-23 06:00:00', NULL, 'present', 100.00, NULL, 0.00, 'Morning shift drawer opened with $100 starting cash float.'),
(2, 3, '2026-09-22 14:00:00', '2026-09-22 22:05:00', 'present', 100.00, 100.00, 0.00, 'Completed warehouse inventory audit.')
ON DUPLICATE KEY UPDATE `id`=VALUES(`id`);
