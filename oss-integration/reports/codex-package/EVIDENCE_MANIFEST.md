# Evidence manifest

Everything a reviewer needs, mapped to its real path. Where a conventionally
named document does not exist under that name, the file that actually carries
its content is named instead — nothing is invented to fill a slot.

| Evidence required | Where it is | Note |
| --- | --- | --- |
| Source code | `src/` (16 modules) | Entry: `src/pipeline.ts`, `src/cli.ts` |
| Generated plugin | `examples/frontend-plugin/frontend-quality-plugin/`, `examples/live-plugin/live-web-quality/` | Two committed reference builds, synthetic and live |
| Architecture | `PROJECT_CONTEXT.md` § Source map; `CLAUDE.md` § Architecture | No separate `ARCHITECTURE.md`; content lives in these two |
| `CLAUDE.md` | `CLAUDE.md` | Mission, principles, prohibitions, 13 invariants |
| `PROJECT_CONTEXT.md` | `PROJECT_CONTEXT.md` | Orientation, source map, run instructions |
| `DECISIONS.md` | `DECISIONS.md` | D1–D7 with evidence and what would overturn each |
| Scoring and gates | `PROJECT_CONTEXT.md` § Scoring and gates; `src/scoring/`, `src/license/`, `src/security/`, `src/evidence/` | No separate `SCORING_AND_GATES.md`; the code is authoritative |
| MVP spec | `PROJECT_CONTEXT.md` § MVP scope; `README.md` | No separate `MVP_SPEC.md` |
| `ASSUMPTIONS.md` | `ASSUMPTIONS.md` | A1–A37, each with how to overturn it |
| Tests | `tests/` | unit, schema, goal-cases, acceptance, live-fetch, ablation, provenance-audit, real-task |
| Benchmark policy | `BENCHMARK_POLICY_v0.1.1.md`, `data/benchmark-metrics.json` | Definitions pre-registered before measurement |
| Raw benchmark results | each plugin's `BENCHMARK_REPORT.md`; `benchmark/baseline-v0.1.json` | Baseline is frozen and must not be recomputed |
| Security results | each plugin's `SECURITY_REPORT.md`; `src/security/gate.ts` | Includes sources that were **not** scanned |
| Licence results | each plugin's `INTEGRATION_REPORT.md` § 2; `src/license/gate.ts` | 12 SPDX rules |
| Provenance | each plugin's `PROVENANCE.md`; root `PROVENANCE.md`; `tests/provenance-audit.test.ts` | `Reused Code: None` claim and its audit |
| Live repository results | `examples/live-plugin/live-web-quality/LIVE_REPOSITORY_REPORT.md` | Per-URL fetch log, and what stayed UNKNOWN |
| Known limitations | `FINAL_RELEASE_REPORT.md` § Known limitations; `CHANGELOG.md` | **Contains the author's conclusion — read last** |
| Original contributions | `ORIGINAL_CONTRIBUTIONS.md`; `tests/ablation.test.ts` | Includes components examined and **rejected** |
| Frozen state | `reports/PRE_EXTERNAL_CODEX_REVIEW.md` | Commit SHA, hashes, all results at freeze |

## Deliberately withheld from the review prompts

`FINAL_RELEASE_REPORT.md` states the author's build status, improvement verdict,
release readiness and ship decision. It is **not** referenced from any prompt,
and the prompts say not to seek it out first. It is listed here so a reviewer
can read it *after* forming an independent view, and so nothing is hidden.
