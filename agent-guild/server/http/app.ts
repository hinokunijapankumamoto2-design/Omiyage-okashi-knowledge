import { existsSync } from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import { errorMiddleware, handler } from "./helpers.js";
import { officeRouter } from "./routes/office.js";
import { workRouter } from "./routes/work.js";
import { commsRouter } from "./routes/comms.js";
import { providerRouter } from "./routes/providers.js";
import { exportRouter } from "./routes/exports.js";
import { env } from "../env.js";
import { queueDepth, runningTaskIds } from "../engine/dispatcher.js";

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "4mb" }));
  // The API is local-first; CORS stays open only in development.
  app.use(cors({ origin: env.isProduction ? false : true }));

  app.get(
    "/api/health",
    handler(() => ({
      ok: true,
      version: "0.1.0",
      mode: env.nodeEnv,
      executionEnabled: env.executionEnabled,
      queue: { depth: queueDepth(), running: runningTaskIds().length },
    })),
  );

  app.use("/api", officeRouter);
  app.use("/api", workRouter);
  app.use("/api", commsRouter);
  app.use("/api", providerRouter);
  app.use("/api/export", exportRouter);

  // In production the built SPA is served from the same origin as the API.
  const dist = path.resolve(process.cwd(), "dist");
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api|events).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }

  app.use(errorMiddleware);
  return app;
}
