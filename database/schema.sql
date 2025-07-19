-- IT Equipment Tracking Database Schema
-- SQLite Database

-- Admin users table
CREATE TABLE admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    active BOOLEAN DEFAULT 1
);

-- Employees table (imported from Entra ID)
CREATE TABLE employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT UNIQUE NOT NULL, -- Entra ID
    email TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    department TEXT,
    job_title TEXT,
    phone TEXT,
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Equipment categories/types
CREATE TABLE equipment_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Equipment table
CREATE TABLE equipment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_tag TEXT UNIQUE NOT NULL, -- Auto-generated unique ID
    category_id INTEGER,
    manufacturer TEXT NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    serial_number TEXT UNIQUE NOT NULL,
    purchase_date DATE,
    purchase_cost DECIMAL(10,2),
    job_code TEXT, -- For PO tracking (24.0024/012020.E format)
    cost_code TEXT,
    condition TEXT CHECK(condition IN ('New', 'Good', 'Fair', 'Poor', 'Damaged', 'Retired')),
    warranty_start_date DATE,
    warranty_end_date DATE,
    warranty_provider TEXT,
    notes TEXT,
    qr_code_generated BOOLEAN DEFAULT 0,
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES equipment_categories(id)
);

-- Equipment tags (for flexible categorization)
CREATE TABLE equipment_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#3B82F6', -- Hex color for UI
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Junction table for equipment-tag relationships
CREATE TABLE equipment_tag_assignments (
    equipment_id INTEGER,
    tag_id INTEGER,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (equipment_id, tag_id),
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES equipment_tags(id) ON DELETE CASCADE
);

-- Bundles/Kits table
CREATE TABLE bundles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    bundle_type TEXT, -- 'mobile_networking_kit', 'laptop_package', etc.
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bundle contents (equipment in bundles)
CREATE TABLE bundle_contents (
    bundle_id INTEGER,
    equipment_id INTEGER,
    quantity INTEGER DEFAULT 1,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (bundle_id, equipment_id),
    FOREIGN KEY (bundle_id) REFERENCES bundles(id) ON DELETE CASCADE,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE
);

-- Equipment files (warranty docs, receipts, manuals, photos)
CREATE TABLE equipment_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'warranty', 'receipt', 'manual', 'photo', 'other'
    file_size INTEGER,
    mime_type TEXT,
    uploaded_by INTEGER, -- admin_id
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES admins(id)
);

-- Equipment checkout/checkin tracking
CREATE TABLE equipment_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    transaction_type TEXT CHECK(transaction_type IN ('checkout', 'checkin')) NOT NULL,
    location TEXT, -- Where equipment was issued to
    due_date DATE,
    returned_date DATE,
    condition_out TEXT, -- Condition when checked out
    condition_in TEXT, -- Condition when returned
    notes TEXT,
    processed_by INTEGER, -- admin_id who processed the transaction
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id),
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (processed_by) REFERENCES admins(id)
);

-- Bundle checkout/checkin tracking
CREATE TABLE bundle_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bundle_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    transaction_type TEXT CHECK(transaction_type IN ('checkout', 'checkin')) NOT NULL,
    location TEXT,
    due_date DATE,
    returned_date DATE,
    notes TEXT,
    processed_by INTEGER,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bundle_id) REFERENCES bundles(id),
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (processed_by) REFERENCES admins(id)
);

-- Audit/Activity log
CREATE TABLE activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    employee_id INTEGER,
    action TEXT NOT NULL, -- 'login', 'logout', 'equipment_added', 'equipment_updated', etc.
    entity_type TEXT, -- 'equipment', 'employee', 'bundle', etc.
    entity_id INTEGER,
    old_values TEXT, -- JSON string of old values
    new_values TEXT, -- JSON string of new values
    ip_address TEXT,
    user_agent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admins(id),
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Indexes for performance
CREATE INDEX idx_equipment_asset_tag ON equipment(asset_tag);
CREATE INDEX idx_equipment_serial ON equipment(serial_number);
CREATE INDEX idx_equipment_category ON equipment(category_id);
CREATE INDEX idx_equipment_active ON equipment(active);
CREATE INDEX idx_transactions_equipment ON equipment_transactions(equipment_id);
CREATE INDEX idx_transactions_employee ON equipment_transactions(employee_id);
CREATE INDEX idx_transactions_type ON equipment_transactions(transaction_type);
CREATE INDEX idx_activity_log_timestamp ON activity_log(timestamp);
CREATE INDEX idx_employees_employee_id ON employees(employee_id);
CREATE INDEX idx_employees_email ON employees(email);

-- Initial data
INSERT INTO equipment_categories (name, description) VALUES 
('Laptops', 'Portable computers and notebooks'),
('Monitors', 'Display screens and monitors'),
('Keyboards & Mice', 'Input devices'),
('Mobile Routers', 'Portable internet connectivity devices'),
('Switches', 'Network switching equipment'),
('Chargers', 'Power adapters and charging cables'),
('Docks', 'Laptop docking stations'),
('Cameras', '360-degree cameras and recording equipment'),
('Tripods', 'Camera mounting and support equipment'),
('Phones', 'Mobile phones and smartphones'),
('Tablets', 'iPads and other tablet devices'),
('Accessories', 'Various equipment accessories');

INSERT INTO equipment_tags (name, color, description) VALUES
('Critical', '#DC2626', 'Critical business equipment'),
('Portable', '#059669', 'Portable/mobile equipment'),
('Fragile', '#D97706', 'Requires careful handling'),
('High-Value', '#7C3AED', 'Expensive equipment requiring extra security'),
('Temporary', '#6B7280', 'Temporary or short-term use equipment');