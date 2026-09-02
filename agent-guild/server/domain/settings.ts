import { all, run } from "../db/index.js";
import { bus } from "../core/events.js";

export function readSettings(): Record<string, unknown> {
  const rows = all<{ key: string; value: string }>("SELECT key, value FROM settings");
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      result[row.key] = JSON.parse(row.value);
    } catch {
      result[row.key] = row.value;
    }
  }
  return result;
}

export function readSetting<T>(key: string, fallback: T): T {
  const value = readSettings()[key];
  return value === undefined ? fallback : (value as T);
}

export function writeSettings(patch: Record<string, unknown>): Record<string, unknown> {
  for (const [key, value] of Object.entries(patch)) {
    run(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, unixepoch() * 1000)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      key,
      JSON.stringify(value),
    );
  }
  bus.publish({ type: "settings.updated" });
  return readSettings();
}
