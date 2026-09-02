import type { HttpRunnerSpec, RunContext, RunOutcome } from "./types.js";

function headers(spec: HttpRunnerSpec, secret: string): Record<string, string> {
  const base: Record<string, string> = {
    "content-type": "application/json",
    ...(spec.auth.extraHeaders ?? {}),
  };
  if (secret) base[spec.auth.header] = `${spec.auth.prefix}${secret}`;
  return base;
}

function endpoint(spec: HttpRunnerSpec, baseUrl: string): string {
  const root = (baseUrl || spec.defaultBaseUrl).replace(/\/+$/, "");
  switch (spec.dialect) {
    case "openai-chat":
      return `${root}/chat/completions`;
    case "anthropic-messages":
      return `${root}/messages`;
    case "ollama-chat":
      return `${root}/api/chat`;
  }
}

function body(spec: HttpRunnerSpec, model: string, prompt: string): unknown {
  switch (spec.dialect) {
    case "openai-chat":
      return { model, messages: [{ role: "user", content: prompt }], stream: false };
    case "anthropic-messages":
      return { model, max_tokens: 8192, messages: [{ role: "user", content: prompt }] };
    case "ollama-chat":
      return { model, messages: [{ role: "user", content: prompt }], stream: false };
  }
}

function extractText(spec: HttpRunnerSpec, payload: any): string {
  switch (spec.dialect) {
    case "openai-chat":
      return String(payload?.choices?.[0]?.message?.content ?? "");
    case "anthropic-messages":
      return (payload?.content ?? [])
        .filter((block: any) => block?.type === "text")
        .map((block: any) => String(block.text ?? ""))
        .join("\n");
    case "ollama-chat":
      return String(payload?.message?.content ?? "");
  }
}

export async function runHttp(spec: HttpRunnerSpec, context: RunContext): Promise<RunOutcome> {
  const credential = context.credential ?? { baseUrl: "", secret: "", extra: {} };
  const model = context.model || spec.defaultModel;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), context.timeoutMs);
  context.signal?.addEventListener("abort", () => controller.abort(), { once: true });

  try {
    const response = await fetch(endpoint(spec, credential.baseUrl), {
      method: "POST",
      headers: headers(spec, credential.secret),
      body: JSON.stringify(body(spec, model, context.prompt)),
      signal: controller.signal,
    });
    const raw = await response.text();
    if (!response.ok) {
      return { ok: false, text: "", exitCode: response.status, error: raw.slice(0, 2000) };
    }
    const text = extractText(spec, JSON.parse(raw));
    context.onChunk?.("stdout", text);
    return { ok: true, text, exitCode: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, text: "", exitCode: null, error: message, timedOut: controller.signal.aborted };
  } finally {
    clearTimeout(timer);
  }
}

export async function listHttpModels(
  spec: HttpRunnerSpec,
  credential: { baseUrl: string; secret: string },
): Promise<string[]> {
  if (!spec.modelsPath) return [];
  const root = (credential.baseUrl || spec.defaultBaseUrl).replace(/\/+$/, "");
  const response = await fetch(`${root}${spec.modelsPath}`, { headers: headers(spec, credential.secret) });
  if (!response.ok) throw new Error(`models request failed: ${response.status}`);
  const payload: any = await response.json();
  const candidates: unknown[] = payload?.data ?? payload?.models ?? [];
  return candidates
    .map((entry: any) => String(entry?.id ?? entry?.name ?? entry?.model ?? ""))
    .filter(Boolean)
    .sort();
}
