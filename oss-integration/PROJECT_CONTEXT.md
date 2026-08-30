# PROJECT CONTEXT

Orientation for a reviewer arriving cold. Facts and pointers only — the release
decision is deliberately not summarised here.

## What this is

A CLI that takes a goal (and optionally some GitHub repositories), decomposes it
into **capabilities**, discovers and verifies OSS that supplies them, applies
hard gates, resolves duplication and conflict, and **generates a new Claude Code
plugin** — then benchmarks that plugin against the ones it drew from.

The deliverable is a plugin, not a list of repositories.

## Pipeline

```
goal → capability decomposition → repository analysis → capability extraction
     → evidence classification → licence gate + security gate
     → capability graph (REQUIRES/COMPLEMENTS/ALTERNATIVE_TO/CONFLICTS_WITH/UNLOCKS)
     → gap + near-miss → global discovery → duplicate + conflict detection
     → KEEP/REPLACE/ADD/REMOVE/WATCH/REJECT/UNKNOWN
     → best capability stack → stack optimizer → integration architect
     → original layer → plugin builder → validator
```

## Source map

| Module | Responsibility |
| --- | --- |
| `src/goal/` | NL goal → GoalSpec; capability decomposition; goal archetypes |
| `src/capability/` | Taxonomy; capability extraction |
| `src/repository/` | Analyzer with three resolution paths; `live-fetch.ts`; `tar.ts` |
| `src/discovery/` | Global discovery over the seed registry and npm search |
| `src/evidence/` | The **only** place an evidence class is assigned |
| `src/license/`, `src/security/`, `src/health/` | Hard gates and health |
| `src/graph/` | Capability graph, prerequisite closure, near-miss detection |
| `src/gap/`, `src/compatibility/` | Gap engine; duplicate and conflict detection |
| `src/scoring/` | Scout Score, weighted, gate-aware |
| `src/integration/` | Selector, stack optimizer, architect |
| `src/builder/` | Plugin builder — writes a real Claude Code plugin |
| `src/validation/` | Package validator, benchmark runner, live task runner, reports |
| `src/pipeline.ts`, `src/cli.ts` | Orchestration and CLI |

## Scoring and gates

**Scout Score** (0–5, weighted): Task Fit 25%, Evidence 20%, Maintenance 10%,
Architecture 10%, Compatibility 10%, Differentiation 10%, Integration Value 10%,
Popularity **5%**. Defined in `src/scoring/scout-score.ts`.

**Evidence classes**, strongest first: `VERIFIED` > `SUPPORTED` > `INFERRED` >
`CLAIMED` > `UNKNOWN`. Derived from what was actually inspected, never asserted.
Popularity alone can never exceed `UNKNOWN`. See `src/evidence/engine.ts`.

**Hard gates**: `LICENSE`, `SECURITY`, `SOURCE_INTEGRITY`, `REPRODUCIBILITY`.
A `BLOCK` outranks any score. Scanning nothing yields `UNKNOWN`, never `PASS`.

**Licence policies**: `REUSE_OK` · `REUSE_WITH_CONDITIONS` · `REFERENCE_ONLY` ·
`LEGAL_REVIEW` · `BLOCK`. An unobserved licence is `UNKNOWN` and never permits
copying. See `src/license/gate.ts`.

## MVP scope

In scope: the pipeline above, three CLI modes (`goal`, `analyze`, `build`),
`--live` artifact fetching, `--real-tasks` browser execution, and the generated
plugin plus its reports.

Explicitly out of scope for v0.1: SaaS, auth, billing, web UI, marketplace,
microservices, vector database, a large GitHub index.

## How to run

```bash
npm install && npm run build && npm test        # offline, deterministic
OSS_LIVE_TEST=1  node --test "dist/tests/live-repository.test.js"
OSS_REAL_TASK=1  node --test "dist/tests/real-task.test.js"
```

Offline and deterministic by default. `--live` is the only network path;
`--real-tasks` is the only thing that starts a browser.

## Reading order for a reviewer

1. `PROJECT_CONTEXT.md` (this file)
2. `CLAUDE.md` — mission, principles, prohibitions, invariants
3. `ASSUMPTIONS.md` — every default adopted and how to overturn it
4. `DECISIONS.md` — the reasoning behind each contested decision
5. `data/benchmark-metrics.json` + `BENCHMARK_POLICY_v0.1.1.md`
6. `benchmark/baseline-v0.1.json` — frozen v0.1 evidence
7. The generated plugins under `examples/` and their reports
8. `FINAL_RELEASE_REPORT.md` — **read last**; it contains the author's
   conclusion and will anchor you if read first
