export interface WorkerReport {
  status: "done" | "blocked" | "unknown";
  summary: string;
  changed: string[];
  verified: string;
  blocker: string;
}

function fieldsFrom(block: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of block.split(/\r?\n/)) {
    const match = /^\s*([a-z_]+)\s*:\s*(.*)$/i.exec(line);
    if (match) fields[match[1].toLowerCase()] = match[2].trim();
  }
  return fields;
}

/** Tolerant parser: agents wrap the block in fences, or forget them entirely. */
export function parseWorkerReport(output: string): WorkerReport {
  const index = output.lastIndexOf("GUILD-REPORT");
  const fallback: WorkerReport = {
    status: "unknown",
    summary: output.trim().split(/\r?\n/).filter(Boolean).slice(-3).join(" ").slice(0, 400),
    changed: [],
    verified: "",
    blocker: "",
  };
  if (index < 0) return fallback;

  const fields = fieldsFrom(output.slice(index + "GUILD-REPORT".length).replace(/```/g, ""));
  const status = fields.status === "done" || fields.status === "blocked" ? fields.status : "unknown";
  const changedRaw = fields.changed ?? "";
  return {
    status,
    summary: fields.summary || fallback.summary,
    changed:
      !changedRaw || changedRaw.toLowerCase() === "none"
        ? []
        : changedRaw.split(",").map((entry) => entry.trim()).filter(Boolean),
    verified: fields.verified && fields.verified.toLowerCase() !== "none" ? fields.verified : "",
    blocker: fields.blocker ?? "",
  };
}

export interface ReviewVerdict {
  verdict: "accept" | "revise" | "reject" | "unknown";
  reasons: string;
  requiredChanges: string[];
}

export function parseReviewVerdict(output: string): ReviewVerdict {
  const index = output.lastIndexOf("GUILD-REVIEW");
  if (index < 0) return { verdict: "unknown", reasons: output.trim().slice(-600), requiredChanges: [] };
  const body = output.slice(index + "GUILD-REVIEW".length).replace(/```/g, "");
  const fields = fieldsFrom(body);
  const verdict = ["accept", "revise", "reject"].includes(fields.verdict ?? "")
    ? (fields.verdict as ReviewVerdict["verdict"])
    : "unknown";
  const required = body
    .split(/required_changes\s*:/i)[1]
    ?.split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, "").trim())
    .filter(Boolean) ?? [];
  return { verdict, reasons: fields.reasons ?? "", requiredChanges: required.slice(0, 20) };
}

/** Planning replies arrive as JSON, sometimes wrapped in prose or fences. */
export function parsePlanJson(output: string): { planSummary: string; subtasks: Array<Record<string, unknown>> } {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(output);
  const candidates = [fenced?.[1], output.slice(output.indexOf("{"), output.lastIndexOf("}") + 1), output];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate.trim());
      const subtasks = Array.isArray(parsed?.subtasks) ? parsed.subtasks : [];
      return { planSummary: String(parsed?.plan_summary ?? ""), subtasks };
    } catch {
      // try the next shape
    }
  }
  return { planSummary: output.trim().slice(0, 600), subtasks: [] };
}
