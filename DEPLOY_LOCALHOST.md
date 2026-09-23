# SmartPOS — Localhost Deployment Guide

SmartPOS can be deployed and run on your local machine (`localhost`). The project provides a modern **Full-Stack Application (React 19 + Express Server-Side RBAC)** as well as the **Python Flask & MySQL backend**.

---

## Option 1: Full-Stack Web App (React + Express Server-Side RBAC)
*(Recommended for instant evaluation, POS cash register, barcode scanner, and RBAC matrix)*

### Prerequisites
- **Node.js** v18 or higher (v20+ recommended)
- **npm** or **bun**

### Step 1: Install Dependencies
Open your terminal in the root project folder and run:
```bash
npm install
```

### Step 2: Configure Environment Variables
Copy the example environment file:
```bash
cp .env.example .env
```
*(Default development settings are pre-configured out of the box).*

### Step 3: Run Development Server
```bash
npm run dev
```
The server will boot on **`http://localhost:3000`** with live backend RBAC endpoints and hot reload.

### Step 4: Build for Production (Standalone Node.js Server)
```bash
npm run build
npm start
```
This compiles the client into `dist/` and bundles the backend server into `dist/server.cjs`, serving the full app on port 3000.

---

## Option 2: Python / Flask Backend (with MySQL)

### Prerequisites
- **Python 3.10+**
- **MySQL 8.0+**

### Step 1: Create the MySQL Database
```bash
mysql -u root -p -e "CREATE DATABASE smartpos CHARACTER SET utf8mb4;"
mysql -u root -p smartpos < SmartPOS/sql/schema.sql
```

### Step 2: Set Up Virtual Environment & Dependencies
```bash
cd SmartPOS
python -m venv venv
source venv/bin/activate       # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Step 3: Configure Environment (.env)
```bash
cp .env.example .env
```
Edit `.env` with your MySQL credentials:
```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=smartpos
SECRET_KEY=local-dev-secret-key
```

### Step 4: Seed Default Roles & Users
```bash
python scripts/seed_users.py
```

Default credentials:
- **Admin**: `admin@smartpos.local` (Password: `password123`)
- **Cashier**: `cashier@smartpos.local` (Password: `password123`)
- **Inventory Manager**: `inventory@smartpos.local` (Password: `password123`)
- **Admin Assistant**: `assistant@smartpos.local` (Password: `password123`)

### Step 5: Start the Flask Server
```bash
python run.py
```
Open **`http://localhost:5000`** in your browser.

---

## Server-Side RBAC Architecture Summary

Access control strictly follows the 6 enterprise principles:
1. **Server-Side Enforcement**: API routes guard every action using `requirePermission(...)`. The UI is for convenience only; the server rejects unauthorized requests with HTTP `403 Forbidden`.
2. **Explicit Role-to-Permission Mapping**: Permissions map exclusively to roles (`admin`, `cashier`, `inventory_manager`, `assistant`).
3. **Users Map Only to Roles**: Users hold a `role_name` / `role_id`. No individual permission overrides exist on users (`user → role → permissions`).
4. **Role Changes Are the Only Way to Alter Access**: Promoting or reassigning a user's role is the sole mechanism to update permissions.
5. **UI Is Convenience Only**: Buttons may be hidden or disabled client-side, but the server is the single authoritative source of truth.
6. **Hardcoded / Controlled Permissions**: Fixed capability definitions prevent unauthorized privilege escalations.
