import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'restrovico.db');
const db = new Database(dbPath);

// Enable WAL mode and foreign key constraints
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'OWNER',
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      mobile TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      email_verified_at DATETIME,
      status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
      last_login_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS restaurants (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      restaurant_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      business_type TEXT NOT NULL DEFAULT 'Restaurant',
      mobile TEXT NOT NULL,
      email TEXT,
      address_line TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'IN',
      pincode TEXT NOT NULL,
      gstin TEXT,
      fssai_no TEXT,
      opening_time TEXT,
      closing_time TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (updated_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS email_verifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      device_info TEXT,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      metadata TEXT,
      ip TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_restaurants_tenant_status ON restaurants(tenant_id, status);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at);
  `);
}

export default db;
