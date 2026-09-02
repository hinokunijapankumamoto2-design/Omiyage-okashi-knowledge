import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** Minimal .env reader — avoids a dependency and keeps startup synchronous. */
function loadDotEnv(file: string): void {
  if (!existsSync(file)) return;
  for (const rawLine of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    if (key in process.env) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotEnv(path.resolve(process.cwd(), ".env"));

const num = (raw: string | undefined, fallback: number): number => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const bool = (raw: string | undefined, fallback: boolean): boolean => {
  if (raw === undefined || raw === "") return fallback;
  return !["0", "false", "off", "no"].includes(raw.trim().toLowerCase());
};

const dataDir = path.resolve(process.cwd(), process.env.AG_DATA_DIR ?? ".data");

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",
  host: process.env.AG_HOST ?? "127.0.0.1",
  port: num(process.env.AG_PORT, 5311),
  dataDir,
  dbPath: path.resolve(process.cwd(), process.env.AG_DB_PATH ?? path.join(dataDir, "agent-guild.sqlite")),
  logDir: path.resolve(process.cwd(), process.env.AG_LOG_DIR ?? path.join(dataDir, "logs")),
  secretKey: process.env.AG_SECRET_KEY ?? "",
  maxConcurrentRuns: num(process.env.AG_MAX_CONCURRENT_RUNS, 3),
  runTimeoutMs: num(process.env.AG_RUN_TIMEOUT_MS, 30 * 60 * 1000),
  executionEnabled: bool(process.env.AG_ENABLE_EXECUTION, true),
  allowedRoots: (process.env.AG_ALLOWED_ROOTS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => path.resolve(entry)),
} as const;

export function ensureRuntimeDirs(): void {
  for (const dir of [env.dataDir, env.logDir, path.dirname(env.dbPath)]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}
