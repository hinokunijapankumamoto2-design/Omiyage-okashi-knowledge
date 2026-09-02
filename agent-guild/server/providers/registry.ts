import type { RunnerDefinition } from "./types.js";

/**
 * Runners are declared as data. Adding a CLI or an OpenAI-compatible endpoint is
 * a entry here, not a new code path — which is what keeps the engine
 * vendor-neutral.
 */
export const RUNNERS: RunnerDefinition[] = [
  {
    id: "claude-code",
    kind: "cli",
    label: "Claude Code CLI",
    note: "Anthropic's terminal agent. Uses whatever auth the CLI already has.",
    cli: {
      bin: "claude",
      promptVia: "stdin",
      args: (context) => ["-p", ...(context.model ? ["--model", context.model] : [])],
      probeArgs: ["--version"],
    },
  },
  {
    id: "codex-cli",
    kind: "cli",
    label: "Codex CLI",
    note: "OpenAI's terminal agent, run non-interactively.",
    cli: {
      bin: "codex",
      promptVia: "arg",
      args: (context) => ["exec", ...(context.model ? ["--model", context.model] : []), context.prompt],
      probeArgs: ["--version"],
    },
  },
  {
    id: "gemini-cli",
    kind: "cli",
    label: "Gemini CLI",
    note: "Google's terminal agent in single-prompt mode.",
    cli: {
      bin: "gemini",
      promptVia: "arg",
      args: (context) => [...(context.model ? ["-m", context.model] : []), "-p", context.prompt],
      probeArgs: ["--version"],
    },
  },
  {
    id: "opencode",
    kind: "cli",
    label: "OpenCode",
    note: "Open-source terminal agent.",
    cli: {
      bin: "opencode",
      promptVia: "arg",
      args: (context) => ["run", ...(context.model ? ["--model", context.model] : []), context.prompt],
      probeArgs: ["--version"],
    },
  },
  {
    id: "generic-cli",
    kind: "cli",
    label: "Custom CLI",
    note: "Any tool that reads a prompt on stdin and writes the answer to stdout.",
    cli: {
      bin: process.env.AG_GENERIC_CLI_BIN ?? "agent-cli",
      promptVia: "stdin",
      args: () => (process.env.AG_GENERIC_CLI_ARGS ?? "").split(" ").filter(Boolean),
      probeArgs: ["--version"],
    },
  },
  {
    id: "openai-compatible",
    kind: "http",
    label: "OpenAI-compatible API",
    note: "Works with OpenAI, OpenRouter, Together, Groq, Cerebras, vLLM and most gateways.",
    http: {
      dialect: "openai-chat",
      defaultBaseUrl: "https://api.openai.com/v1",
      auth: { header: "Authorization", prefix: "Bearer " },
      defaultModel: "gpt-4.1-mini",
      modelsPath: "/models",
    },
  },
  {
    id: "anthropic-api",
    kind: "http",
    label: "Anthropic API",
    note: "Direct Messages API access with an API key.",
    http: {
      dialect: "anthropic-messages",
      defaultBaseUrl: "https://api.anthropic.com/v1",
      auth: { header: "x-api-key", prefix: "", extraHeaders: { "anthropic-version": "2023-06-01" } },
      defaultModel: "claude-sonnet-4-5",
      modelsPath: "/models",
    },
  },
  {
    id: "ollama",
    kind: "http",
    label: "Ollama (local)",
    note: "Local models over the Ollama HTTP API. No key required.",
    http: {
      dialect: "ollama-chat",
      defaultBaseUrl: "http://127.0.0.1:11434",
      auth: { header: "Authorization", prefix: "Bearer " },
      defaultModel: "llama3.1",
      modelsPath: "/api/tags",
    },
  },
  {
    id: "manual",
    kind: "manual",
    label: "Manual / human",
    note: "The staff member is a placeholder; a human completes the task.",
  },
];

export function getRunner(id: string): RunnerDefinition | undefined {
  return RUNNERS.find((runner) => runner.id === id);
}

export function runnersOfKind(kind: string): RunnerDefinition[] {
  return RUNNERS.filter((runner) => runner.kind === kind);
}
