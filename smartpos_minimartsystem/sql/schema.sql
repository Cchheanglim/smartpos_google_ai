-- ============================================================================
-- SmartPOS Mini-Mart Management System Database Schema (MySQL 8.0+ / MariaDB)
-- Compatible with XAMPP MySQL & phpMyAdmin
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `smartpos_minimart` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `smartpos_minimart`;

-- 1. Roles Table
CREATE TABLE IF NOT EXISTS `roles` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(50) NOT NULL UNIQUE,
    `display_name` VARCHAR(100) NOT NULL,
    `is_system` BOOLEAN DEFAULT TRUE,
    `description` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Permissions Table
CREATE TABLE IF NOT EXISTS `permissions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(80) NOT NULL UNIQUE,
    `display_name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(255) NULL,
    `is_system` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Role Permissions Join Table
CREATE TABLE IF NOT EXISTS `role_permissions` (
    `role_id` INT NOT NULL,
    `permission_id` INT NOT NULL,
    PRIMARY KEY (`role_id`, `permission_id`),
    CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_rp_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Users (Staff Members) Table
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(120) NOT NULL UNIQUE,
    `phone` VARCHAR(30) NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role_id` INT NOT NULL,
    `shift_name` VARCHAR(50) DEFAULT 'Morning',
    `shift_start` TIME DEFAULT '06:00:00',
    `shift_end` TIME DEFAULT '14:00:00',
    `is_active` BOOLEAN DEFAULT TRUE,
    `profile_picture` VARCHAR(255) DEFAULT 'f86e67858910489ba513eae41ad5b941.png',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_user_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. User Direct Permissions Overrides Table
CREATE TABLE IF NOT EXISTS `user_permissions` (
    `user_id` INT NOT NULL,
    `permission_name` VARCHAR(80) NOT NULL,
    PRIMARY KEY (`user_id`, `permission_name`),
    CONSTRAINT `fk_up_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Product Categories Table
CREATE TABLE IF NOT EXISTS `categories` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL UNIQUE,
    `description` VARCHAR(255) NULL,
    `icon` VARCHAR(50) DEFAULT 'fa-box',
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Suppliers Table
CREATE TABLE IF NOT EXISTS `suppliers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(120) NOT NULL,
    `contact_person` VARCHAR(100) NULL,
    `phone` VARCHAR(30) NULL,
    `email` VARCHAR(120) NULL,
    `address` VARCHAR(255) NULL,
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Products Inventory Table
CREATE TABLE IF NOT EXISTS `products` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL,
    `sku` VARCHAR(50) NOT NULL UNIQUE,
    `barcode` VARCHAR(50) NOT NULL UNIQUE,
    `category_id` INT NOT NULL,
    `supplier_id` INT NULL,
    `price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `cost_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `quantity_in_stock` INT NOT NULL DEFAULT 0,
    `low_stock_threshold` INT NOT NULL DEFAULT 10,
    `unit` VARCHAR(20) DEFAULT 'piece',
    `image_url` VARCHAR(255) NULL,
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_product_sku` (`sku`),
    INDEX `idx_product_barcode` (`barcode`),
    CONSTRAINT `fk_prod_cat` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`),
    CONSTRAINT `fk_prod_sup` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Stock Adjustment Audit Trail
CREATE TABLE IF NOT EXISTS `stock_adjustments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `product_id` INT NOT NULL,
    `user_id` INT NOT NULL,
    `change_quantity` INT NOT NULL,
    `previous_quantity` INT NOT NULL,
    `new_quantity` INT NOT NULL,
    `reason` VARCHAR(100) NOT NULL,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_sa_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_sa_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Customers & CRM Loyalty Table
CREATE TABLE IF NOT EXISTS `customers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(30) NOT NULL UNIQUE,
    `email` VARCHAR(120) NULL,
    `tier` ENUM('Bronze', 'Silver', 'Gold', 'VIP') DEFAULT 'Bronze',
    `points` INT DEFAULT 0,
    `discount_rate` DECIMAL(5, 2) DEFAULT 0.00,
    `total_spent` DECIMAL(12, 2) DEFAULT 0.00,
    `notes` TEXT NULL,
    `is_active` BOOLEAN DEFAULT TRUE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_customer_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. Work Shifts Template Table
CREATE TABLE IF NOT EXISTS `shifts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(50) NOT NULL,
    `start_time` TIME NOT NULL,
    `end_time` TIME NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. Staff Attendance & Punch Clock Table
CREATE TABLE IF NOT EXISTS `attendance` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `clock_in` DATETIME NOT NULL,
    `clock_out` DATETIME NULL,
    `status` ENUM('present', 'late', 'left_early', 'absent') DEFAULT 'present',
    `starting_cash` DECIMAL(10, 2) DEFAULT 0.00,
    `counted_cash` DECIMAL(10, 2) NULL,
    `cash_discrepancy` DECIMAL(10, 2) DEFAULT 0.00,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_att_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. Sales Transactions Table
CREATE TABLE IF NOT EXISTS `sales` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `transaction_code` VARCHAR(50) NOT NULL UNIQUE,
    `cashier_id` INT NOT NULL,
    `customer_id` INT NULL,
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `discount_percent` DECIMAL(5, 2) DEFAULT 0.00,
    `discount_amount` DECIMAL(10, 2) DEFAULT 0.00,
    `tax_percent` DECIMAL(5, 2) DEFAULT 0.00,
    `tax_amount` DECIMAL(10, 2) DEFAULT 0.00,
    `total_amount` DECIMAL(10, 2) NOT NULL,
    `payment_method` VARCHAR(30) NOT NULL DEFAULT 'Cash',
    `currency_mode` ENUM('usd', 'khr', 'mixed') DEFAULT 'usd',
    `exchange_rate` DECIMAL(10, 2) DEFAULT 4100.00,
    `amount_paid_usd` DECIMAL(10, 2) DEFAULT 0.00,
    `amount_paid_khr` DECIMAL(12, 2) DEFAULT 0.00,
    `change_usd` DECIMAL(10, 2) DEFAULT 0.00,
    `change_khr` DECIMAL(12, 2) DEFAULT 0.00,
    `points_redeemed` INT DEFAULT 0,
    `points_discount_usd` DECIMAL(10, 2) DEFAULT 0.00,
    `points_earned` INT DEFAULT 0,
    `status` ENUM('completed', 'partially_refunded', 'refunded', 'cancelled') DEFAULT 'completed',
    `notes` TEXT NULL,
    `completed_at` DATETIME NOT NULL,
    INDEX `idx_sales_code` (`transaction_code`),
    INDEX `idx_sales_completed` (`completed_at`),
    CONSTRAINT `fk_sale_cashier` FOREIGN KEY (`cashier_id`) REFERENCES `users` (`id`),
    CONSTRAINT `fk_sale_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 14. Sale Line Items Table
CREATE TABLE IF NOT EXISTS `sale_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `sale_id` INT NOT NULL,
    `product_id` INT NOT NULL,
    `product_name` VARCHAR(150) NOT NULL,
    `sku` VARCHAR(50) NOT NULL,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `cost_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `quantity` INT NOT NULL,
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `discount` DECIMAL(10, 2) DEFAULT 0.00,
    `total` DECIMAL(10, 2) NOT NULL,
    CONSTRAINT `fk_si_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_si_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 15. Refunds Table
CREATE TABLE IF NOT EXISTS `refunds` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `sale_id` INT NOT NULL,
    `processed_by` INT NOT NULL,
    `total_amount` DECIMAL(10, 2) NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `notes` TEXT NULL,
    `refunded_at` DATETIME NOT NULL,
    CONSTRAINT `fk_ref_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ref_user` FOREIGN KEY (`processed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 16. Refund Line Items Table
CREATE TABLE IF NOT EXISTS `refund_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `refund_id` INT NOT NULL,
    `sale_item_id` INT NOT NULL,
    `product_id` INT NOT NULL,
    `quantity` INT NOT NULL,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `subtotal` DECIMAL(10, 2) NOT NULL,
    CONSTRAINT `fk_ri_refund` FOREIGN KEY (`refund_id`) REFERENCES `refunds` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ri_sale_item` FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items` (`id`),
    CONSTRAINT `fk_ri_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 17. Operational Tasks Board Table
CREATE TABLE IF NOT EXISTS `tasks` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `title` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `assigned_to` INT NOT NULL,
    `assigned_by` INT NOT NULL,
    `priority` ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    `status` ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
    `due_date` DATE NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `completed_at` DATETIME NULL,
    CONSTRAINT `fk_task_assignee` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_task_assigner` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 18. Cash Drawer Operations Audit
CREATE TABLE IF NOT EXISTS `cash_drawer_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `operation_type` ENUM('float_in', 'pay_in', 'pay_out', 'drop', 'reconciliation') NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `balance_after` DECIMAL(10, 2) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_cd_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
