import { spawn } from "node:child_process";
import { createLogger } from "../core/logger.js";
import type { CliRunnerSpec, RunContext, RunOutcome } from "./types.js";

const log = createLogger("cli-runner");
const TAIL_LIMIT = 200_000;

/**
 * Runs a terminal agent once, non-interactively, inside `context.cwd`.
 * Output is streamed to the caller and also accumulated (bounded) so the
 * finished run can be summarised without re-reading the log file.
 */
export function runCli(spec: CliRunnerSpec, context: RunContext): Promise<RunOutcome> {
  return new Promise((resolve) => {
    const args = spec.args(context);
    const child = spawn(spec.bin, args, {
      cwd: context.cwd,
      env: { ...process.env, ...(spec.env?.(context) ?? {}) },
      stdio: ["pipe", "pipe", "pipe"],
      // `shell` would let prompt text reach a shell parser; keep it off.
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;

    const append = (target: "stdout" | "stderr", chunk: string) => {
      if (target === "stdout") {
        stdout = (stdout + chunk).slice(-TAIL_LIMIT);
      } else {
        stderr = (stderr + chunk).slice(-TAIL_LIMIT);
      }
      context.onChunk?.(target, chunk);
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => append("stdout", chunk));
    child.stderr.on("data", (chunk: string) => append("stderr", chunk));

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
    }, context.timeoutMs);

    const abort = () => child.kill("SIGTERM");
    context.signal?.addEventListener("abort", abort, { once: true });

    const finish = (outcome: RunOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      context.signal?.removeEventListener("abort", abort);
      resolve(outcome);
    };

    child.on("error", (error) => {
      log.warn(`spawn failed for ${spec.bin}`, error.message);
      finish({
        ok: false,
        text: stdout,
        exitCode: null,
        error: `could not start "${spec.bin}": ${error.message}`,
      });
    });

    child.on("close", (code) => {
      const ok = !timedOut && code === 0;
      finish({
        ok,
        text: stdout.trim() || stderr.trim(),
        exitCode: code,
        pid: child.pid,
        timedOut,
        error: ok ? undefined : timedOut ? "run timed out" : stderr.trim().slice(-4000) || `exit ${code}`,
      });
    });

    if (spec.promptVia === "stdin") {
      child.stdin.end(context.prompt, "utf8");
    } else {
      child.stdin.end();
    }
  });
}

/** Probe used by the Settings screen to show which CLIs are actually installed. */
export async function probeCli(spec: CliRunnerSpec): Promise<{ available: boolean; version: string }> {
  return new Promise((resolve) => {
    const child = spawn(spec.bin, spec.probeArgs, { stdio: ["ignore", "pipe", "pipe"], shell: false });
    let out = "";
    child.stdout.on("data", (chunk) => (out += String(chunk)));
    child.stderr.on("data", (chunk) => (out += String(chunk)));
    const timer = setTimeout(() => child.kill("SIGKILL"), 8_000);
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ available: false, version: "" });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ available: code === 0, version: out.trim().split("\n")[0] ?? "" });
    });
  });
}
