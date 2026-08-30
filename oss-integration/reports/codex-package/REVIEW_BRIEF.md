# Independent review brief — OSS Scout × Integration Architect MVP v0.1

You are an independent reviewer. **Do not assume the implementation or its
conclusions are correct.** This brief deliberately withholds the author's final
recommendation so it cannot anchor you; it is in `FINAL_RELEASE_REPORT.md` if
you want it *after* forming your own view.

Review the actual source, tests, generated plugin, reports and benchmark
definitions. Do not treat README claims as proof.

## What to attack

Architecture · implementation · type safety · error handling · test coverage ·
security · licence handling · provenance · capability extraction · scoring ·
hard gates · conflict resolution · dependency handling · plugin generation ·
benchmark validity · reproducibility · unsupported claims.

Specifically hunt for: benchmark gaming, asymmetric comparison, hidden
regressions, weak baselines, misleading normalization, unmeasured costs,
synthetic evidence presented as live, security false negatives, licence reuse
mistakes, provenance gaps, dependency inflation, unnecessary original layers,
orchestration overhead, dead components, false capability attribution, fragile
heuristics, overfitting to acceptance tests, unsafe caching, stale evidence,
missing negative tests, reproducibility failures, and any condition where the
generated plugin is **worse** than its originals.

## Output format, per finding

```
FINDING / SEVERITY / EVIDENCE / FILE:LINE / WHY IT MATTERS /
FIX REQUIRED? / SUGGESTED FIX / CONFIDENCE
```

Severity: CRITICAL | HIGH | MEDIUM | LOW | INFO.
Prioritise falsifiable defects. Do not praise the implementation.

## Claims that must be checked against evidence, not accepted

1. `Reused Code: None` — verified by shingle audit, or not?
2. Same-task execution 249 ms vs 252 ms ⇒ "no orchestration overhead".
3. "Distinct Upstream Projects cannot go below 5 without weakening a gate."
4. All four original contributions are load-bearing (ablation).
5. Hard gates: is UNKNOWN ever treated as PASS anywhere?
6. Does the shared browser / cached axe source create cross-subject leakage?

## Entry points

| What | Where |
| --- | --- |
| Source | `src/` (16 modules), start at `src/pipeline.ts` |
| Metric definitions (pre-registered) | `data/benchmark-metrics.json` |
| Frozen v0.1 evidence | `benchmark/baseline-v0.1.json` |
| Policy change record | `BENCHMARK_POLICY_v0.1.1.md` |
| Reasoning | `DECISIONS.md` |
| Tests | `tests/` — unit, schema, goal-cases, acceptance, live-fetch, ablation, provenance-audit, real-task |
| Generated output | `examples/frontend-plugin/`, `examples/live-plugin/` |
| Assumptions | `ASSUMPTIONS.md` |
