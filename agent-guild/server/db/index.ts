import { DatabaseSync } from "node:sqlite";
import { env, ensureRuntimeDirs } from "../env.js";
import { createLogger } from "../core/logger.js";
import { migrations } from "./schema.js";

const log = createLogger("db");

export type Row = Record<string, unknown>;

let handle: DatabaseSync | null = null;

export function db(): DatabaseSync {
  if (!handle) throw new Error("database not initialised — call openDatabase() first");
  return handle;
}

export function openDatabase(): DatabaseSync {
  if (handle) return handle;
  ensureRuntimeDirs();
  const connection = new DatabaseSync(env.dbPath);
  connection.exec("PRAGMA journal_mode = WAL;");
  connection.exec("PRAGMA foreign_keys = ON;");
  connection.exec("PRAGMA busy_timeout = 5000;");
  connection.exec(
    `CREATE TABLE IF NOT EXISTS applied_migrations (
       id TEXT PRIMARY KEY,
       applied_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
     );`,
  );
  handle = connection;
  runMigrations();
  return connection;
}

function runMigrations(): void {
  const connection = db();
  const applied = new Set(
    connection.prepare("SELECT id FROM applied_migrations").all().map((row) => String(row.id)),
  );
  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    log.info(`applying migration ${migration.id}`);
    connection.exec("BEGIN");
    try {
      connection.exec(migration.sql);
      connection.prepare("INSERT INTO applied_migrations (id) VALUES (?)").run(migration.id);
      connection.exec("COMMIT");
    } catch (error) {
      connection.exec("ROLLBACK");
      throw error;
    }
  }
}

export function closeDatabase(): void {
  handle?.close();
  handle = null;
}

/** `all` / `one` / `run` keep call sites free of prepare/finalize noise. */
export function all<T = Row>(sql: string, ...params: unknown[]): T[] {
  return db().prepare(sql).all(...(params as never[])) as T[];
}

export function one<T = Row>(sql: string, ...params: unknown[]): T | undefined {
  return db().prepare(sql).get(...(params as never[])) as T | undefined;
}

export function run(sql: string, ...params: unknown[]): { changes: number } {
  const result = db().prepare(sql).run(...(params as never[]));
  return { changes: Number(result.changes ?? 0) };
}

export function transact<T>(work: () => T): T {
  const connection = db();
  connection.exec("BEGIN");
  try {
    const result = work();
    connection.exec("COMMIT");
    return result;
  } catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  }
}

export function audit(action: string, subject: string, detail: unknown = {}): void {
  run("INSERT INTO audit_log (action, subject, detail) VALUES (?, ?, ?)", action, subject, JSON.stringify(detail));
}
