// eslint-disable-next-line @typescript-eslint/no-var-requires
const initSqlJs = require('sql.js');
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = process.env.SQLITE_PATH || path.join(DATA_DIR, 'audit.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Global database reference (set after async init)
let _db: any = null;

export function getDb(): any {
  if (!_db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return _db;
}

// Save database to disk
function saveToDisk() {
  if (_db) {
    const data = _db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Wrapper: run a statement (INSERT, UPDATE, DELETE)
export function dbRun(sql: string, params: any[] = []): { changes: number } {
  const db = getDb();
  db.run(sql, params);
  const changes = db.getRowsModified();
  saveToDisk();
  return { changes };
}

// Wrapper: get all rows
export function dbAll(sql: string, params: any[] = []): any[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Wrapper: get single row
export function dbGet(sql: string, params: any[] = []): any | undefined {
  const rows = dbAll(sql, params);
  return rows.length > 0 ? rows[0] : undefined;
}

export async function initDb() {
  console.log(`Initializing SQLite database at: ${DB_PATH}`);

  const SQL = await initSqlJs();

  // Load existing DB or create new
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(fileBuffer);
    console.log('Loaded existing database from disk.');
  } else {
    _db = new SQL.Database();
    console.log('Created new database.');
  }

  // Enable foreign keys
  _db.run('PRAGMA foreign_keys = ON;');

  // Create audits table
  _db.run(`
    CREATE TABLE IF NOT EXISTS audits (
      id TEXT PRIMARY KEY,
      created_at TEXT DEFAULT (datetime('now')),
      status TEXT NOT NULL,
      total_urls INTEGER NOT NULL,
      completed_urls INTEGER DEFAULT 0
    );
  `);

  // Create reports table
  _db.run(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      audit_id TEXT REFERENCES audits(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      status TEXT NOT NULL,
      load_time_ms INTEGER,
      response_time_ms INTEGER,
      dom_ready_ms INTEGER,

      desktop_perf_score REAL,
      desktop_acc_score REAL,
      desktop_best_prac_score REAL,
      desktop_seo_score REAL,
      desktop_fcp_ms INTEGER,
      desktop_lcp_ms INTEGER,
      desktop_cls REAL,
      desktop_tbt_ms INTEGER,
      desktop_speed_index_ms INTEGER,
      desktop_inp_ms INTEGER,

      mobile_perf_score REAL,
      mobile_acc_score REAL,
      mobile_best_prac_score REAL,
      mobile_seo_score REAL,
      mobile_fcp_ms INTEGER,
      mobile_lcp_ms INTEGER,
      mobile_cls REAL,
      mobile_tbt_ms INTEGER,
      mobile_speed_index_ms INTEGER,
      mobile_inp_ms INTEGER,

      screenshot_desktop_full TEXT,
      screenshot_mobile_full TEXT,
      screenshot_desktop_above TEXT,

      recommendations TEXT,
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  saveToDisk();
  console.log('Database tables successfully initialized.');
}
