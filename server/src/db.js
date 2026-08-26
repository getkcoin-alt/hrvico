import Database from 'better-sqlite3';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databaseUrl = process.env.DATABASE_URL;
let isPg = false;
let pgPool = null;
let sqliteDb = null;

if (databaseUrl) {
  isPg = true;
  pgPool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('railway.internal') ? false : { rejectUnauthorized: false }
  });
} else {
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'restrovico.db');
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');
}

function convertSqlToPg(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

export async function initDb() {
  if (isPg) {
    const client = await pgPool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS tenants (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(255) PRIMARY KEY,
          tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          role VARCHAR(50) NOT NULL DEFAULT 'OWNER',
          full_name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          mobile VARCHAR(50) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          email_verified_at TIMESTAMP,
          status VARCHAR(50) NOT NULL DEFAULT 'PENDING_VERIFICATION',
          last_login_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS restaurants (
          id VARCHAR(255) PRIMARY KEY,
          tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          restaurant_code VARCHAR(100) NOT NULL UNIQUE,
          name VARCHAR(255) NOT NULL,
          business_type VARCHAR(100) NOT NULL DEFAULT 'Restaurant',
          mobile VARCHAR(50) NOT NULL,
          email VARCHAR(255),
          address_line TEXT NOT NULL,
          city VARCHAR(100) NOT NULL,
          state VARCHAR(100) NOT NULL,
          country VARCHAR(100) NOT NULL DEFAULT 'IN',
          pincode VARCHAR(20) NOT NULL,
          gstin VARCHAR(50),
          fssai_no VARCHAR(50),
          opening_time VARCHAR(20),
          closing_time VARCHAR(20),
          status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
          created_by VARCHAR(255) NOT NULL REFERENCES users(id),
          updated_by VARCHAR(255) NOT NULL REFERENCES users(id),
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS email_verifications (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          used_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS password_resets (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          used_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS auth_sessions (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash VARCHAR(255) NOT NULL,
          device_info TEXT,
          expires_at TIMESTAMP NOT NULL,
          revoked_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
          id VARCHAR(255) PRIMARY KEY,
          tenant_id VARCHAR(255),
          user_id VARCHAR(255),
          action VARCHAR(255) NOT NULL,
          entity_type VARCHAR(100),
          entity_id VARCHAR(255),
          metadata TEXT,
          ip VARCHAR(100),
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_restaurants_tenant_status ON restaurants(tenant_id, status);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at);
      `);
      console.log('PostgreSQL database initialized successfully.');
    } finally {
      client.release();
    }
  } else {
    sqliteDb.exec(`
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
    console.log('SQLite database initialized successfully.');
  }
}

const db = {
  prepare(sql) {
    return {
      async get(...params) {
        if (isPg) {
          const pgSql = convertSqlToPg(sql);
          const res = await pgPool.query(pgSql, params);
          return res.rows[0] || undefined;
        } else {
          return sqliteDb.prepare(sql).get(...params);
        }
      },

      async all(...params) {
        if (isPg) {
          const pgSql = convertSqlToPg(sql);
          const res = await pgPool.query(pgSql, params);
          return res.rows;
        } else {
          return sqliteDb.prepare(sql).all(...params);
        }
      },

      async run(...params) {
        if (isPg) {
          const pgSql = convertSqlToPg(sql);
          const res = await pgPool.query(pgSql, params);
          return { changes: res.rowCount };
        } else {
          return sqliteDb.prepare(sql).run(...params);
        }
      }
    };
  },

  transaction(fn) {
    return async (...args) => {
      if (isPg) {
        const client = await pgPool.connect();
        try {
          await client.query('BEGIN');
          // Override db.prepare temporarily for tx client if needed or run in transaction
          const result = await fn(...args);
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      } else {
        return sqliteDb.transaction(fn)(...args);
      }
    };
  }
};

export default db;
