import { describe, expect, it } from "vitest";
import { parsePlanJson, parseReviewVerdict, parseWorkerReport } from "../engine/report-parser.js";

describe("worker report parsing", () => {
  it("reads a well-formed fenced block", () => {
    const report = parseWorkerReport(`Did the thing.

\`\`\`
GUILD-REPORT
status: done
summary: Added a token bucket limiter.
changed: src/limit.ts, src/limit.test.ts
verified: npm test
\`\`\``);
    expect(report.status).toBe("done");
    expect(report.summary).toBe("Added a token bucket limiter.");
    expect(report.changed).toEqual(["src/limit.ts", "src/limit.test.ts"]);
    expect(report.verified).toBe("npm test");
  });

  it("normalises 'none' to empty", () => {
    const report = parseWorkerReport("GUILD-REPORT\nstatus: done\nchanged: none\nverified: none");
    expect(report.changed).toEqual([]);
    expect(report.verified).toBe("");
  });

  it("carries the blocker when the agent stops", () => {
    const report = parseWorkerReport("GUILD-REPORT\nstatus: blocked\nblocker: missing DB credentials");
    expect(report.status).toBe("blocked");
    expect(report.blocker).toBe("missing DB credentials");
  });

  it("falls back to the tail when no block is present", () => {
    const report = parseWorkerReport("line one\nline two\nI could not finish.");
    expect(report.status).toBe("unknown");
    expect(report.summary).toContain("I could not finish.");
  });

  it("uses the last block when the agent emits two", () => {
    const report = parseWorkerReport(
      "GUILD-REPORT\nstatus: blocked\nsummary: first\n\nGUILD-REPORT\nstatus: done\nsummary: second",
    );
    expect(report.status).toBe("done");
    expect(report.summary).toBe("second");
  });
});

describe("review verdict parsing", () => {
  it("reads accept", () => {
    expect(parseReviewVerdict("GUILD-REVIEW\nverdict: accept\nreasons: all criteria met").verdict).toBe("accept");
  });

  it("collects the numbered required changes on a revise", () => {
    const verdict = parseReviewVerdict(`GUILD-REVIEW
verdict: revise
reasons: the limiter is not covered by a test
required_changes:
1. Add a test for the 429 path
2. Handle a clock jump`);
    expect(verdict.verdict).toBe("revise");
    expect(verdict.requiredChanges).toEqual(["Add a test for the 429 path", "Handle a clock jump"]);
  });

  it("reports unknown rather than guessing when the block is missing", () => {
    expect(parseReviewVerdict("Looks fine to me!").verdict).toBe("unknown");
  });
});

describe("plan parsing", () => {
  it("reads a fenced JSON plan", () => {
    const plan = parsePlanJson(`Here is the plan.

\`\`\`json
{ "plan_summary": "Two steps", "subtasks": [{ "title": "A", "department": "build" }] }
\`\`\``);
    expect(plan.planSummary).toBe("Two steps");
    expect(plan.subtasks).toHaveLength(1);
  });

  it("reads bare JSON with surrounding prose", () => {
    const plan = parsePlanJson('Sure: { "plan_summary": "x", "subtasks": [] } — done.');
    expect(plan.planSummary).toBe("x");
  });

  it("degrades to a summary when the reply is not JSON", () => {
    const plan = parsePlanJson("I cannot break this down.");
    expect(plan.subtasks).toEqual([]);
    expect(plan.planSummary).toContain("cannot break this down");
  });
});
