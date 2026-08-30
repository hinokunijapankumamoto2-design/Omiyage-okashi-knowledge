# Independent review — OSS Scout × Integration Architect MVP v0.1

You are an independent reviewer. **Assume the implementation may be wrong.**

The author's release decision is deliberately **not** included in this brief so
it cannot anchor you. Do not go looking for it before forming your own view.
Do not agree with the author unless the artifacts support it.

Review the actual source, tests, generated plugin, reports and benchmark
definitions. **Do not treat README or report claims as proof** — treat them as
assertions to be checked against code and data.

## Scope

Architecture · correctness · type safety · error handling · tests · capability
extraction · capability selection · graph logic · conflict resolution · plugin
generation · security · licence · provenance · reproducibility.

## Output format, one block per finding

```
ID
SEVERITY          CRITICAL | HIGH | MEDIUM | LOW | INFO
FINDING
EVIDENCE
FILE
LINE / COMPONENT
REPRODUCTION
IMPACT
RECOMMENDED ACTION
CONFIDENCE       high | medium | low
```

Prioritise falsifiable defects. Do not praise the implementation. If you find
nothing in an area, say so explicitly rather than padding.

## Questions to answer from the artifacts, not from the reports

These are **open questions**, not claims to confirm. The author's answers are
not reproduced here.

1. Is any third-party source text present in the generated plugin? What would a
   text-similarity audit miss (reformatting, reordering, translation, minified
   or generated code)? See `tests/provenance-audit.test.ts`.
2. `data/benchmark-metrics.json` records the same-task and full-capability
   measurements. **What do those numbers support, and what do they not?**
   Decide independently what conclusion, if any, follows.
3. How many distinct upstream projects does the generated stack require, and is
   that number reducible? Under what constraints, and at what cost to which
   gate? See `src/integration/optimizer.ts` and `DECISIONS.md` D1.
4. Are all four "original contributions" load-bearing? `tests/ablation.test.ts`
   claims to measure this — audit the harness itself before trusting its result.
5. Is `UNKNOWN` ever treated as `PASS` anywhere in the pipeline?
6. The suite shares one browser across subjects and caches the axe-core source.
   Can state or a measurement leak between subjects?
7. Three metric definitions were changed mid-project (`install-actions`,
   `upstream-projects`, `output-quality`), each recorded in `changedFromV01` as
   a defect fix rather than a preference. Verify or refute each.

## Entry points

| What | Where |
| --- | --- |
| Orientation | `PROJECT_CONTEXT.md` |
| Source, 16 modules | `src/`, start at `src/pipeline.ts` |
| Scoring and hard gates | `src/scoring/`, `src/license/`, `src/security/`, `src/evidence/` |
| Metric definitions (pre-registered) | `data/benchmark-metrics.json` |
| Frozen v0.1 evidence | `benchmark/baseline-v0.1.json` |
| Benchmark policy change record | `BENCHMARK_POLICY_v0.1.1.md` |
| Tests | `tests/` — unit, schema, goal-cases, acceptance, live-fetch, ablation, provenance-audit, real-task |
| Generated output | `examples/frontend-plugin/`, `examples/live-plugin/` |
| Raw results | each generated plugin's `BENCHMARK_REPORT.md`, `SECURITY_REPORT.md`, `LIVE_REPOSITORY_REPORT.md` |
| Stated assumptions | `ASSUMPTIONS.md` |
| Full evidence index | `reports/codex-package/EVIDENCE_MANIFEST.md` |
