import { Router } from "express";
import { body, handler, param } from "../helpers.js";
import { RUNNERS, getRunner } from "../../providers/registry.js";
import { probeCli } from "../../providers/cli-runner.js";
import { listHttpModels } from "../../providers/http-runner.js";
import {
  deleteCredential,
  listCredentials,
  resolveCredential,
  saveCredential,
} from "../../domain/credentials.js";
import { isKeyManaged } from "../../core/crypto.js";
import { badRequest } from "../../core/errors.js";
import { env } from "../../env.js";

export const providerRouter = Router();

providerRouter.get(
  "/runners",
  handler(() => ({
    runners: RUNNERS.map((runner) => ({
      id: runner.id,
      kind: runner.kind,
      label: runner.label,
      note: runner.note,
      defaultBaseUrl: runner.http?.defaultBaseUrl ?? "",
      defaultModel: runner.http?.defaultModel ?? "",
      bin: runner.cli?.bin ?? "",
    })),
    executionEnabled: env.executionEnabled,
    secretKeyManaged: isKeyManaged(),
  })),
);

/** Reports which terminal agents are actually installed on this machine. */
providerRouter.get(
  "/runners/probe",
  handler(async () => {
    const results = await Promise.all(
      RUNNERS.filter((runner) => runner.kind === "cli" && runner.cli).map(async (runner) => ({
        id: runner.id,
        label: runner.label,
        bin: runner.cli!.bin,
        ...(await probeCli(runner.cli!)),
      })),
    );
    return { probes: results };
  }),
);

providerRouter.get("/credentials", handler(() => ({ credentials: listCredentials() })));
providerRouter.post("/credentials", handler((req) => saveCredential(body(req) as never)));
providerRouter.patch(
  "/credentials/:id",
  handler((req) => saveCredential({ ...body(req), id: param(req, "id") } as never)),
);
providerRouter.delete(
  "/credentials/:id",
  handler((req) => {
    deleteCredential(param(req, "id"));
    return { ok: true };
  }),
);

providerRouter.get(
  "/credentials/:id/models",
  handler(async (req) => {
    const view = listCredentials().find((entry) => entry.id === param(req, "id"));
    if (!view) throw badRequest("unknown_credential", "no such credential");
    const runner = getRunner(view.runnerId);
    if (!runner?.http) throw badRequest("not_http", "this runner does not expose a model list");
    const resolved = resolveCredential(param(req, "id"))!;
    return { models: await listHttpModels(runner.http, resolved) };
  }),
);
