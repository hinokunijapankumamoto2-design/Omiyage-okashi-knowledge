import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../env.js";

const ALGO = "aes-256-gcm";

/**
 * Credentials are stored encrypted at rest. When AG_SECRET_KEY is absent we
 * derive a machine-local key so a fresh checkout still works, but we mark the
 * payload so the UI can warn that the key is not operator-managed.
 */
function masterKey(): { key: Buffer; managed: boolean } {
  if (env.secretKey) {
    return { key: createHash("sha256").update(env.secretKey).digest(), managed: true };
  }
  const fallback = `agent-guild:${env.dbPath}`;
  return { key: createHash("sha256").update(fallback).digest(), managed: false };
}

export function isKeyManaged(): boolean {
  return masterKey().managed;
}

export function encryptSecret(plain: string): string {
  const { key } = masterKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), body.toString("base64")].join(".");
}

export function decryptSecret(packed: string): string {
  const [version, iv, tag, body] = packed.split(".");
  if (version !== "v1" || !iv || !tag || !body) throw new Error("malformed_secret");
  const { key } = masterKey();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
}

/** Never echo a stored credential back to a browser — show a shape hint instead. */
export function maskSecret(plain: string): string {
  if (plain.length <= 8) return "*".repeat(plain.length);
  return `${plain.slice(0, 4)}${"*".repeat(Math.min(12, plain.length - 8))}${plain.slice(-4)}`;
}
