'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/inventory.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let _db = null;

function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    _db.pragma('synchronous = NORMAL');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db) {
  db.exec(`
    -- ─── Users (coordinators / staff) ───────────────────────────────────────
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      username    TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name   TEXT NOT NULL,
      role        TEXT NOT NULL CHECK(role IN ('coordinator','staff')),
      email       TEXT,
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Storage locations ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS locations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE,
      type        TEXT NOT NULL CHECK(type IN ('department','laboratory','room','cupboard','other')),
      description TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Inventory items (quantity-based and asset-based) ────────────────────
    CREATE TABLE IF NOT EXISTS items (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      item_code     TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      category      TEXT NOT NULL,
      description   TEXT,
      make_model    TEXT,
      item_type     TEXT NOT NULL CHECK(item_type IN ('quantity','asset')),
      total_qty     INTEGER NOT NULL DEFAULT 0,
      available_qty INTEGER NOT NULL DEFAULT 0,
      issued_qty    INTEGER NOT NULL DEFAULT 0,
      damaged_qty   INTEGER NOT NULL DEFAULT 0,
      lost_qty      INTEGER NOT NULL DEFAULT 0,
      maintenance_qty INTEGER NOT NULL DEFAULT 0,
      issue_limit   INTEGER NOT NULL DEFAULT 1,
      renewal_limit INTEGER NOT NULL DEFAULT 2,
      is_active     INTEGER NOT NULL DEFAULT 1,
      location_id   INTEGER REFERENCES locations(id),
      created_by    INTEGER REFERENCES users(id),
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Individual assets (tracked by serial/asset ID) ──────────────────────
    CREATE TABLE IF NOT EXISTS assets (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id      TEXT NOT NULL UNIQUE,
      serial_no     TEXT,
      item_id       INTEGER NOT NULL REFERENCES items(id),
      location_id   INTEGER REFERENCES locations(id),
      condition     TEXT NOT NULL DEFAULT 'good' CHECK(condition IN ('good','fair','damaged','lost','maintenance')),
      status        TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','issued','maintenance','retired')),
      notes         TEXT,
      created_by    INTEGER REFERENCES users(id),
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Students ────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS students (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      enrollment_no   TEXT NOT NULL UNIQUE,
      full_name       TEXT NOT NULL,
      programme       TEXT NOT NULL,
      semester        INTEGER NOT NULL,
      email           TEXT,
      phone           TEXT,
      password_hash   TEXT NOT NULL,
      is_active       INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Issue transactions ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS issues (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_no      TEXT NOT NULL UNIQUE,
      student_id    INTEGER NOT NULL REFERENCES students(id),
      item_id       INTEGER NOT NULL REFERENCES items(id),
      asset_id      INTEGER REFERENCES assets(id),
      qty_issued    INTEGER NOT NULL DEFAULT 1,
      qty_returned  INTEGER NOT NULL DEFAULT 0,
      purpose       TEXT,
      issue_date    TEXT NOT NULL,
      due_date      TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'active'
                    CHECK(status IN ('active','returned','overdue','partial','renewed')),
      issued_by     INTEGER NOT NULL REFERENCES users(id),
      notes         TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Return records ───────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS returns (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_id        INTEGER NOT NULL REFERENCES issues(id),
      qty_returned    INTEGER NOT NULL DEFAULT 1,
      return_date     TEXT NOT NULL,
      condition       TEXT NOT NULL DEFAULT 'good'
                      CHECK(condition IN ('good','fair','damaged','lost')),
      received_by     INTEGER NOT NULL REFERENCES users(id),
      notes           TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Renewal records ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS renewals (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_id        INTEGER NOT NULL REFERENCES issues(id),
      request_date    TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pending'
                      CHECK(status IN ('pending','approved','rejected')),
      old_due_date    TEXT NOT NULL,
      new_due_date    TEXT,
      requested_by    INTEGER NOT NULL REFERENCES students(id),
      approved_by     INTEGER REFERENCES users(id),
      remarks         TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Stock adjustment log ─────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id     INTEGER NOT NULL REFERENCES items(id),
      type        TEXT NOT NULL CHECK(type IN ('addition','correction','retirement','condition_change')),
      qty_before  INTEGER NOT NULL,
      qty_after   INTEGER NOT NULL,
      reason      TEXT NOT NULL,
      adjusted_by INTEGER NOT NULL REFERENCES users(id),
      adjusted_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Audit log ───────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS audit_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name  TEXT NOT NULL,
      record_id   INTEGER NOT NULL,
      action      TEXT NOT NULL CHECK(action IN ('INSERT','UPDATE','DELETE')),
      performed_by_role TEXT NOT NULL,
      performed_by_id   INTEGER NOT NULL,
      description TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ─── Indexes ─────────────────────────────────────────────────────────────
    CREATE INDEX IF NOT EXISTS idx_issues_student  ON issues(student_id);
    CREATE INDEX IF NOT EXISTS idx_issues_item     ON issues(item_id);
    CREATE INDEX IF NOT EXISTS idx_issues_status   ON issues(status);
    CREATE INDEX IF NOT EXISTS idx_issues_due_date ON issues(due_date);
    CREATE INDEX IF NOT EXISTS idx_assets_item     ON assets(item_id);
    CREATE INDEX IF NOT EXISTS idx_assets_status   ON assets(status);
    CREATE INDEX IF NOT EXISTS idx_renewals_issue  ON renewals(issue_id);
    CREATE INDEX IF NOT EXISTS idx_returns_issue   ON returns(issue_id);
  `);
}

module.exports = { getDb };
