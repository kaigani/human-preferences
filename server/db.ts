import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

export const DB_PATH = resolve(ROOT, process.env.DATABASE_PATH ?? './data/preferences.db');
const MIGRATIONS_DIR = join(ROOT, 'schema', 'migrations');

let _db: Database.Database | null = null;

/** Open (or create) the shared SQLite connection in WAL mode. */
export function getDb(): Database.Database {
  if (_db) return _db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  _db = db;
  return db;
}

/**
 * Apply any migration .sql files not yet recorded in schema_migrations.
 * Runs on boot (server + worker) so the DB is always current.
 */
export function migrate(db: Database.Database = getDb()): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name       TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`);

  const applied = new Set(
    db.prepare('SELECT name FROM schema_migrations').all().map((r: any) => r.name as string),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const ran: string[] = [];
  const record = db.prepare('INSERT INTO schema_migrations (name) VALUES (?)');

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    // Each migration runs in its own transaction; PRAGMAs inside are harmless.
    db.exec('BEGIN');
    try {
      db.exec(sql);
      record.run(file);
      db.exec('COMMIT');
      ran.push(file);
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    }
  }

  // Ensure meta.schema_version reflects the current code constant.
  db.prepare(
    `INSERT INTO meta (key, value) VALUES ('schema_version', '1')
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run();

  return ran;
}

/** True if the DB file already exists on disk (before getDb creates it). */
export function dbExists(): boolean {
  return existsSync(DB_PATH);
}
