export type RunnerKind = "cli" | "http" | "manual";

export interface RunContext {
  prompt: string;
  /** Absolute working directory the runner is confined to. */
  cwd: string;
  model?: string;
  timeoutMs: number;
  signal?: AbortSignal;
  /** Streaming sink for live terminal output. */
  onChunk?: (stream: "stdout" | "stderr", chunk: string) => void;
  /** Resolved credential material, already decrypted. */
  credential?: { baseUrl: string; secret: string; extra: Record<string, unknown> };
}

export interface RunOutcome {
  ok: boolean;
  text: string;
  exitCode: number | null;
  pid?: number;
  timedOut?: boolean;
  error?: string;
}

export interface CliRunnerSpec {
  /** Executable looked up on PATH. */
  bin: string;
  /** Arguments for a single non-interactive, prompt-in / text-out invocation. */
  args: (context: RunContext) => string[];
  /** Passing the prompt on stdin avoids OS argv length limits. */
  promptVia: "stdin" | "arg";
  /** Command used only to detect that the tool is installed. */
  probeArgs: string[];
  env?: (context: RunContext) => Record<string, string>;
}

export type HttpDialect = "openai-chat" | "anthropic-messages" | "ollama-chat";

export interface HttpRunnerSpec {
  dialect: HttpDialect;
  defaultBaseUrl: string;
  /** Header name carrying the secret, plus an optional value prefix. */
  auth: { header: string; prefix: string; extraHeaders?: Record<string, string> };
  defaultModel: string;
  /** Relative path that lists models, when the vendor exposes one. */
  modelsPath?: string;
}

export interface RunnerDefinition {
  id: string;
  kind: RunnerKind;
  label: string;
  /** Short note shown in Settings so an operator knows what they are wiring up. */
  note: string;
  cli?: CliRunnerSpec;
  http?: HttpRunnerSpec;
}
