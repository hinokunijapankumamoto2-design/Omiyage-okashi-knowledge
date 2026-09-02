import { all, one, run } from "../db/index.js";
import { ids } from "../core/ids.js";
import { decryptSecret, encryptSecret, maskSecret } from "../core/crypto.js";
import { badRequest, notFound } from "../core/errors.js";
import { getRunner } from "../providers/registry.js";

export interface CredentialView {
  id: string;
  label: string;
  runnerKind: "cli" | "http";
  runnerId: string;
  baseUrl: string;
  secretHint: string;
  defaultModel: string;
  hasSecret: boolean;
  createdAt: number;
}

const SELECT = `
  SELECT id, label, runner_kind AS runnerKind, runner_id AS runnerId, base_url AS baseUrl,
         secret_hint AS secretHint, default_model AS defaultModel,
         CASE WHEN secret_enc = '' THEN 0 ELSE 1 END AS hasSecret, created_at AS createdAt
  FROM credentials`;

export function listCredentials(): CredentialView[] {
  return all<CredentialView>(`${SELECT} ORDER BY created_at DESC`);
}

export function getCredentialView(id: string): CredentialView {
  const row = one<CredentialView>(`${SELECT} WHERE id = ?`, id);
  if (!row) throw notFound("credential");
  return row;
}

/** Only the engine calls this; the plaintext never leaves the process. */
export function resolveCredential(id: string | null | undefined): {
  baseUrl: string;
  secret: string;
  extra: Record<string, unknown>;
} | undefined {
  if (!id) return undefined;
  const row = one<{ base_url: string; secret_enc: string; extra: string }>(
    "SELECT base_url, secret_enc, extra FROM credentials WHERE id = ?",
    id,
  );
  if (!row) return undefined;
  return {
    baseUrl: row.base_url,
    secret: row.secret_enc ? decryptSecret(row.secret_enc) : "",
    extra: JSON.parse(row.extra || "{}"),
  };
}

export function saveCredential(input: {
  id?: string;
  label: string;
  runnerId: string;
  baseUrl?: string;
  secret?: string;
  defaultModel?: string;
  extra?: Record<string, unknown>;
}): CredentialView {
  const runner = getRunner(input.runnerId);
  if (!runner || runner.kind === "manual") {
    throw badRequest("unknown_runner", `no credential-bearing runner with id "${input.runnerId}"`);
  }
  const baseUrl = input.baseUrl ?? runner.http?.defaultBaseUrl ?? "";
  const id = input.id ?? ids.credential();
  const existing = input.id ? one("SELECT id FROM credentials WHERE id = ?", input.id) : undefined;

  const secretFields = input.secret
    ? { enc: encryptSecret(input.secret), hint: maskSecret(input.secret) }
    : null;

  if (existing) {
    run(
      `UPDATE credentials
          SET label = ?, runner_kind = ?, runner_id = ?, base_url = ?, default_model = ?, extra = ?,
              secret_enc = COALESCE(?, secret_enc), secret_hint = COALESCE(?, secret_hint),
              updated_at = unixepoch() * 1000
        WHERE id = ?`,
      input.label,
      runner.kind,
      input.runnerId,
      baseUrl,
      input.defaultModel ?? "",
      JSON.stringify(input.extra ?? {}),
      secretFields?.enc ?? null,
      secretFields?.hint ?? null,
      id,
    );
  } else {
    run(
      `INSERT INTO credentials (id, label, runner_kind, runner_id, base_url, secret_enc, secret_hint,
                                default_model, extra)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.label,
      runner.kind,
      input.runnerId,
      baseUrl,
      secretFields?.enc ?? "",
      secretFields?.hint ?? "",
      input.defaultModel ?? "",
      JSON.stringify(input.extra ?? {}),
    );
  }
  return getCredentialView(id);
}

export function deleteCredential(id: string): void {
  getCredentialView(id);
  run("UPDATE staff SET credential_id = NULL WHERE credential_id = ?", id);
  run("DELETE FROM credentials WHERE id = ?", id);
}
