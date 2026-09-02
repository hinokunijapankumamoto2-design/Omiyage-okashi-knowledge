import { createServer } from "node:http";
import { env, ensureRuntimeDirs } from "./env.js";
import { createLogger } from "./core/logger.js";
import { closeDatabase, openDatabase } from "./db/index.js";
import { seedIfEmpty } from "./db/seed.js";
import { createApp } from "./http/app.js";
import { attachEventSocket } from "./ws/hub.js";
import { reconcileOrphanRuns } from "./engine/runs.js";
import { listStaff, setStatus } from "./domain/staff.js";

const log = createLogger("boot");

function main(): void {
  ensureRuntimeDirs();
  openDatabase();
  seedIfEmpty();

  // A restart leaves rows claiming work that no longer has a process.
  const orphans = reconcileOrphanRuns();
  if (orphans) log.warn(`cancelled ${orphans} run(s) orphaned by a previous shutdown`);
  for (const member of listStaff({ status: "working" })) setStatus(member.id, "idle", null);

  const app = createApp();
  const server = createServer(app);
  attachEventSocket(server);

  server.listen(env.port, env.host, () => {
    log.info(`AgentGuild API on http://${env.host}:${env.port}`);
    log.info(`database: ${env.dbPath}`);
    if (!env.executionEnabled) log.warn("AG_ENABLE_EXECUTION is off — runs are simulated");
  });

  const shutdown = (signal: string) => {
    log.info(`${signal} received, shutting down`);
    server.close(() => {
      closeDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 8_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main();
