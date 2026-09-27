-- =====================================================================
-- SmartPOS Mini-Mart System — MySQL 8 / MariaDB 10.6+ (XAMPP) schema
--   Import order:  schema.sql  ->  seed.sql
--   phpMyAdmin: Import tab -> choose sql/schema.sql, then sql/seed.sql
--   CLI:        mysql -u root < sql/schema.sql
--               mysql -u root smartpos_minimart < sql/seed.sql
-- =====================================================================
CREATE DATABASE IF NOT EXISTS smartpos_minimart CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smartpos_minimart;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS audit_log, tasks, cash_movements, attendance, held_orders,
                     purchase_order_items, purchase_orders,
                     refund_items, refunds, sale_items, sales, customers,
                     stock_movements, products, suppliers, categories,
                     user_permissions, role_permissions, users, shifts,
                     permissions, roles, settings;
SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------ Settings
CREATE TABLE settings (
    setting_key   VARCHAR(60)  PRIMARY KEY,
    setting_value VARCHAR(255) NOT NULL,
    updated_by    INT          NULL,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------- RBAC
CREATE TABLE roles (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(40)  NOT NULL UNIQUE,
    display_name  VARCHAR(60)  NOT NULL,
    description   VARCHAR(255) NULL,
    is_system     TINYINT(1)   NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE permissions (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(60)  NOT NULL UNIQUE,
    display_name  VARCHAR(80)  NOT NULL,
    description   VARCHAR(255) NULL,
    group_name    VARCHAR(40)  NOT NULL DEFAULT 'General'
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
    role_id       INT NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_rp_perm FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE shifts (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(40) NOT NULL UNIQUE,
    start_time  TIME        NOT NULL,
    end_time    TIME        NOT NULL
) ENGINE=InnoDB;

CREATE TABLE users (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,
    email               VARCHAR(120) NOT NULL UNIQUE,
    phone               VARCHAR(20)  NULL,
    password_hash       VARCHAR(255) NOT NULL,
    role_id             INT          NOT NULL,
    shift_id            INT          NULL,
    avatar_filename     VARCHAR(255) NULL,
    is_active           TINYINT(1)   NOT NULL DEFAULT 1,
    deactivated_at      DATETIME     NULL,
    deactivation_reason VARCHAR(255) NULL,
    created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_role  FOREIGN KEY (role_id)  REFERENCES roles(id)  ON DELETE RESTRICT,
    CONSTRAINT fk_users_shift FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Individual permission overrides granted to one person on top of their role.
CREATE TABLE user_permissions (
    user_id       INT NOT NULL,
    permission_id INT NOT NULL,
    granted_by    INT NULL,
    granted_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, permission_id),
    CONSTRAINT fk_up_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_up_perm FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------- Inventory
CREATE TABLE categories (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(60)  NOT NULL UNIQUE,
    description VARCHAR(255) NULL,
    icon        VARCHAR(40)  NOT NULL DEFAULT 'fa-box'
) ENGINE=InnoDB;

CREATE TABLE suppliers (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(120) NOT NULL UNIQUE,
    contact_name VARCHAR(100) NULL,
    phone        VARCHAR(30)  NULL,
    email        VARCHAR(120) NULL,
    address      VARCHAR(255) NULL
) ENGINE=InnoDB;

CREATE TABLE products (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    sku                 VARCHAR(30)   NOT NULL UNIQUE,
    barcode             VARCHAR(32)   NULL UNIQUE,
    name                VARCHAR(150)  NOT NULL,
    category_id         INT           NULL,
    supplier_id         INT           NULL,
    price               DECIMAL(10,2) NOT NULL,
    cost                DECIMAL(10,2) NOT NULL DEFAULT 0,
    quantity_in_stock   INT           NOT NULL DEFAULT 0,
    low_stock_threshold INT           NOT NULL DEFAULT 5,
    image_filename      VARCHAR(255)  NULL,
    created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    CONSTRAINT fk_products_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
    CONSTRAINT chk_products_price CHECK (price > 0),
    CONSTRAINT chk_products_cost  CHECK (cost >= 0),
    CONSTRAINT chk_products_stock CHECK (quantity_in_stock >= 0),
    CONSTRAINT chk_products_threshold CHECK (low_stock_threshold >= 0),
    INDEX idx_products_name (name)
) ENGINE=InnoDB;

-- Append-only stock ledger: every change to quantity_in_stock writes one row.
CREATE TABLE stock_movements (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    product_id    INT NOT NULL,
    change_amount INT NOT NULL,
    reason        ENUM('initial','restock','sale','refund','damaged','breakage','count_adjustment',
                       'supplier_return','internal_use','purchase_order') NOT NULL,
    note          VARCHAR(255) NULL,
    created_by    INT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sm_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_sm_user    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_sm_nonzero CHECK (change_amount <> 0),
    INDEX idx_sm_product_date (product_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE purchase_orders (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id    INT          NOT NULL,
    status         ENUM('draft','ordered','received','cancelled') NOT NULL DEFAULT 'draft',
    expected_date  DATE         NULL,
    notes          VARCHAR(255) NULL,
    created_by     INT          NOT NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ordered_at     DATETIME     NULL,
    received_by    INT          NULL,
    received_at    DATETIME     NULL,
    cancelled_at   DATETIME     NULL,
    CONSTRAINT fk_po_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_po_creator  FOREIGN KEY (created_by)  REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_po_receiver FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_po_status (status)
) ENGINE=InnoDB;

CREATE TABLE purchase_order_items (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    po_id       INT           NOT NULL,
    product_id  INT           NOT NULL,
    quantity    INT           NOT NULL,
    unit_cost   DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_poi_po      FOREIGN KEY (po_id)      REFERENCES purchase_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_poi_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    CONSTRAINT chk_poi_qty  CHECK (quantity > 0),
    CONSTRAINT chk_poi_cost CHECK (unit_cost >= 0),
    UNIQUE KEY uq_poi_line (po_id, product_id)
) ENGINE=InnoDB;

-- --------------------------------------------------------------- Sales
CREATE TABLE customers (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    phone       VARCHAR(20)   NOT NULL UNIQUE,
    name        VARCHAR(100)  NOT NULL,
    points      INT           NOT NULL DEFAULT 0,
    total_spent DECIMAL(12,2) NOT NULL DEFAULT 0,
    notes       VARCHAR(255)  NULL,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_customers_points CHECK (points >= 0)
) ENGINE=InnoDB;

-- One cashier "shift session": opened with a counted float, closed with a
-- counted drawer. Closed rows are never edited again (see AttendanceRepository).
CREATE TABLE attendance (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT           NOT NULL,
    clock_in       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    clock_out      DATETIME      NULL,
    opening_float  DECIMAL(12,2) NOT NULL DEFAULT 0,
    expected_cash  DECIMAL(12,2) NULL,
    counted_cash   DECIMAL(12,2) NULL,
    cash_difference DECIMAL(12,2) NULL,
    notes          VARCHAR(255)  NULL,
    closed_by      INT           NULL,
    CONSTRAINT fk_att_user   FOREIGN KEY (user_id)   REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_att_closer FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_att_float CHECK (opening_float >= 0),
    INDEX idx_att_user_open (user_id, clock_out)
) ENGINE=InnoDB;

CREATE TABLE sales (
    id                     INT AUTO_INCREMENT PRIMARY KEY,
    cashier_id             INT           NOT NULL,
    customer_id            INT           NULL,
    attendance_id          INT           NULL,
    subtotal               DECIMAL(12,2) NOT NULL,
    discount_type          ENUM('percent','fixed') NOT NULL DEFAULT 'percent',
    discount_value         DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_amount        DECIMAL(12,2) NOT NULL DEFAULT 0,
    member_discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    points_redeemed        INT           NOT NULL DEFAULT 0,
    points_discount        DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_percent            DECIMAL(5,2)  NOT NULL DEFAULT 0,
    tax_amount             DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_amount           DECIMAL(12,2) NOT NULL,
    payment_method         ENUM('cash','khqr','card','split') NOT NULL,
    currency_mode          ENUM('usd','khr','mixed') NULL,
    cash_usd               DECIMAL(12,2) NULL,
    cash_khr               INT           NULL,
    change_currency        ENUM('usd','khr') NULL,
    change_usd             DECIMAL(12,2) NULL,
    change_khr             INT           NULL,
    exchange_rate          INT           NOT NULL DEFAULT 4100,
    qr_bank                VARCHAR(20)   NULL,
    card_brand             VARCHAR(20)   NULL,
    split_card_amount      DECIMAL(12,2) NULL,        -- card portion when payment_method = 'split'
    split_qr_amount        DECIMAL(12,2) NULL,        -- KHQR portion when payment_method = 'split'
    points_earned          INT           NOT NULL DEFAULT 0,
    created_at             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sales_cashier    FOREIGN KEY (cashier_id)    REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_sales_customer   FOREIGN KEY (customer_id)   REFERENCES customers(id) ON DELETE SET NULL,
    CONSTRAINT fk_sales_attendance FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE SET NULL,
    CONSTRAINT chk_sales_total CHECK (total_amount >= 0),
    INDEX idx_sales_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE sale_items (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    sale_id           INT           NOT NULL,
    product_id        INT           NOT NULL,
    product_name      VARCHAR(150)  NOT NULL,   -- snapshot at time of sale
    quantity          INT           NOT NULL,
    unit_price        DECIMAL(10,2) NOT NULL,   -- snapshot at time of sale
    unit_cost         DECIMAL(10,2) NOT NULL DEFAULT 0,
    note              VARCHAR(120)  NULL,       -- line-item note ("no ice", "gift wrap")
    refunded_quantity INT           NOT NULL DEFAULT 0,
    CONSTRAINT fk_si_sale    FOREIGN KEY (sale_id)    REFERENCES sales(id) ON DELETE CASCADE,
    CONSTRAINT fk_si_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    CONSTRAINT chk_si_qty CHECK (quantity > 0),
    CONSTRAINT chk_si_refunded CHECK (refunded_quantity BETWEEN 0 AND quantity)
) ENGINE=InnoDB;

CREATE TABLE refunds (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    sale_id       INT           NOT NULL,
    processed_by  INT           NOT NULL,
    attendance_id INT           NULL,
    reason        VARCHAR(255)  NULL,
    refund_amount DECIMAL(12,2) NOT NULL,
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_refunds_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    CONSTRAINT fk_refunds_user FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_refunds_att  FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE refund_items (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    refund_id    INT           NOT NULL,
    sale_item_id INT           NOT NULL,
    quantity     INT           NOT NULL,
    amount       DECIMAL(12,2) NOT NULL,
    CONSTRAINT fk_ri_refund FOREIGN KEY (refund_id) REFERENCES refunds(id) ON DELETE CASCADE,
    CONSTRAINT fk_ri_item   FOREIGN KEY (sale_item_id) REFERENCES sale_items(id) ON DELETE CASCADE,
    CONSTRAINT chk_ri_qty CHECK (quantity > 0)
) ENGINE=InnoDB;

-- Parked carts ("hold order") that a cashier can resume later.
CREATE TABLE held_orders (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    cashier_id     INT          NOT NULL,
    label          VARCHAR(80)  NOT NULL,
    customer_phone VARCHAR(20)  NULL,
    cart_json      TEXT         NOT NULL,
    item_count     INT          NOT NULL DEFAULT 0,
    held_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_held_cashier FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Every cash movement in a drawer during a shift (append-only).
CREATE TABLE cash_movements (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    attendance_id INT           NOT NULL,
    kind          ENUM('float','sale','refund','cash_in','cash_out') NOT NULL,
    amount        DECIMAL(12,2) NOT NULL,          -- signed, USD equivalent
    reference     VARCHAR(80)   NULL,
    created_by    INT           NULL,
    created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cm_att  FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE,
    CONSTRAINT fk_cm_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_cm_att (attendance_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------ Teamwork
CREATE TABLE tasks (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    title        VARCHAR(150) NOT NULL,
    description  VARCHAR(500) NULL,
    assigned_to  INT          NOT NULL,
    assigned_by  INT          NOT NULL,
    priority     ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
    status       ENUM('pending','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
    due_date     DATE         NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME     NULL,
    CONSTRAINT fk_tasks_to FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_tasks_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_tasks_status (status)
) ENGINE=InnoDB;

-- Append-only security & operations audit trail (no UPDATE/DELETE in the app).
CREATE TABLE audit_log (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT          NULL,
    action      VARCHAR(60)  NOT NULL,
    details     VARCHAR(500) NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_action (action, created_at)
) ENGINE=InnoDB;

-- Optional least-privilege application account (XAMPP: run in phpMyAdmin > SQL):
-- CREATE USER IF NOT EXISTS 'smartpos_app'@'localhost' IDENTIFIED BY 'change-me';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON smartpos_minimart.* TO 'smartpos_app'@'localhost';
