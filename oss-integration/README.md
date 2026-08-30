# OSS Scout × Integration Architect

**v0.1 MVP** — Take a goal (and optionally some GitHub repositories you like),
break the world's OSS down into *capabilities*, verify and gate them, pick the
strong ones, resolve what collides, and **generate a new plugin** — then check
whether it is actually better than what you started with.

The output is not a list of repositories. It is an **OPTIMIZED PLUGIN**.

```
Repositoryを集めるな。Capabilityを理解せよ。
Capabilityを並べるな。Goalに対して最適化せよ。
Pluginを束ねるな。再設計せよ。
統合して終わるな。改善を検証せよ。
```

[日本語版 README](./README.ja.md)

## Reproduce a full run

```bash
cd oss-integration
npm install
npm run build
npm test          # 63 tests: unit, goal cases, schema conformance, acceptance
```

### Verify it end to end

```bash
# offline, deterministic
npm test

# real repositories over the network
OSS_LIVE_TEST=1 node --test "dist/tests/live-repository.test.js"

# real browser against a real page
OSS_REAL_TASK=1 OSS_CHROMIUM_PATH=/path/to/chrome \
  node --test "dist/tests/real-task.test.js"
```

### MODE C — bring your own tools and optimize (the important one)

```bash
node dist/src/cli.js build \
  --goal "Claude Codeで最高品質のWebサイトを作れるPluginを作って" \
  --repo https://github.com/fixture-org/frontend-craft-plugin \
  --repo https://github.com/fixture-org/browser-qa-plugin \
  --repo https://github.com/fixture-org/a11y-guard-plugin \
  --name frontend-quality-plugin
```

Writes `generated/plugins/frontend-quality-plugin/` containing a real Claude
Code plugin plus `INTEGRATION_REPORT.md`, `VALIDATION_REPORT.md` and
`PROVENANCE.md`.

### MODE A — goal only

```bash
node dist/src/cli.js goal "Claude Codeで最高品質のWebサイトを作れるPluginを作って"
```

### MODE B — analyse one repository

```bash
node dist/src/cli.js analyze --repo https://github.com/fixture-org/a11y-guard-plugin
```

### Options

| Flag | Meaning |
| --- | --- |
| `--live` | Fetch real artifacts — licence file, README, package metadata and the published source — from `raw.githubusercontent.com` and `registry.npmjs.org`, and scan them. **Off by default** so runs stay reproducible; without it an unknown repository resolves to an explicit `UNKNOWN` instead of a guess. |
| `--real-tasks` | Execute the task suite in a real browser against a real page, for every subject under identical conditions. Set `OSS_CHROMIUM_PATH` if Chromium is not where Playwright expects it. |
| `--repeats <n>` | Repeats for `--real-tasks`. Reliability needs `n > 1`; at `n = 1` it stays `NOT_VERIFIED`. |
| `--out <dir>` | Output root (default `generated/plugins`). |
| `--name <name>` | Generated plugin name. |
| `--json` | Machine-readable output. |

## What actually happens

```
USER GOAL + OPTIONAL USER-SUPPLIED OSS
  → Goal Engine ─ capability decomposition (never repository names)
  → Repository Analyzer ─ fixture / seed registry / live GitHub
  → Capability Extractor
  → Evidence Engine ─ VERIFIED > SUPPORTED > INFERRED > CLAIMED > UNKNOWN
  → License Gate + Security Gate ─ a BLOCK outranks any score
  → Capability Graph ─ REQUIRES / COMPLEMENTS / ALTERNATIVE_TO /
                       CONFLICTS_WITH / UNLOCKS, plus near-miss detection
  → Gap Engine ─ required − held = missing (minus what the combination unlocks)
  → Global Discovery ─ go shopping for what is missing
  → Duplicate + Conflict Detection
  → KEEP / REPLACE / ADD / REMOVE / WATCH / REJECT / UNKNOWN, each with a reason
  → Best Capability Stack
  → Stack Optimizer ─ consolidate sources without weakening evidence
  → Integration Architect ─ dependencies, conflicts, workflow, architecture
  → Original Layer ─ only where this stack demands it
  → Plugin Builder ─ a real .claude-plugin/ package
  → Validator ─ originals vs integrated, on the same task suite
  → FINAL PLUGIN
```

## Three things this refuses to do

**It will not rank on stars.** Popularity is 5% of the Scout Score and
`classifyEvidence(['social-popularity'])` returns `UNKNOWN`. In the acceptance
fixture the most-starred repository (4,300 stars) is rejected outright, because
a hard gate outranks a score.

**It will not guess a licence.** An unobserved licence is `UNKNOWN`, and
`UNKNOWN` never permits copying code — only referencing the idea and
implementing it independently. v0.1 copies no third-party source at all, so
`Reused Code: None` is structurally true rather than a promise.

**It will not claim an improvement it did not measure.** Output Quality,
Execution Time and Reliability are now measured by executing the suite in a real
browser. UX, Setup Time and Token Usage remain `NOT_VERIFIED` with no proxy
substituted, and every measured regression is reported with its materiality.

## Release status

```
BUILD STATUS          CONDITIONAL
RELEASE READINESS     READY_WITH_KNOWN_TRADEOFFS
IMPROVEMENT VERDICT   REGRESSION  (full-capability)
BENCHMARK POLICY      v0.1.1   (v0.1 frozen at benchmark/baseline-v0.1.json)
FINAL RECOMMENDATION  SHIP_WITH_LIMITATIONS
```

Full detail in **[FINAL_RELEASE_REPORT.md](./FINAL_RELEASE_REPORT.md)**;
reasoning in **[DECISIONS.md](./DECISIONS.md)**.

### Executed benchmark — synthetic inputs, real browser

`fixture-org` is **not** a real organisation; nothing in this run is a claim
about a real project. The capability sets are synthetic, the execution is real.

| Metric | best original | originals-union | integrated | verdict | material |
| --- | --- | --- | --- | --- | --- |
| Task Completion | 0.25 | 0.5 | **1.0** | IMPROVED | — |
| Integration Debt | 3 | 6 | **0** | IMPROVED | — |
| Quality Criteria Covered | 3 | 4 | **7** | IMPROVED | — |
| Task Coverage per Install Action | 0.25 | 0.125 | **0.5** | IMPROVED | — |
| Output Quality / Error Rate / Security / Reliability | — | — | — | EQUIVALENT | — |
| Install Actions | 1 | 4 | 2 | REGRESSION | no |
| **Distinct Upstream Projects** | 1 | 3 | **5** | REGRESSION | **YES** |
| **Unscanned Dependencies** | 0 | 0 | **2** *(0 with `--live`)* | REGRESSION | **YES** |
| **Execution Time** | 243 ms | 244 ms | **549 ms** | REGRESSION | **YES** |
| **Time per Completed Task / per Criterion** | 121.5 / 81.7 | 61 / 61 | **68.6 / 78.4** | REGRESSION | **YES** |
| UX / Setup Time / Token Usage | — | — | — | NOT_VERIFIED | — |

**Live run** (three real repositories): Task Completion 0.75 IMPROVED,
Unscanned Dependencies **0**, and **one** material regression — Distinct
Upstream Projects.

### The two findings that matter

**Execution time is extra work, not overhead — and it is proven.** Restricted to
the same four tasks with capability sets intersected so nobody does extra work:

| | originals-union | integrated |
| --- | --- | --- |
| Execution Time (SAME-TASK) | 252 ms | **249 ms** |

At identical work the integrated plugin is not slower. The full-capability
delta is fully accounted for by accessibility auditing and visual regression
that no baseline can do at all (~315 ms of extra work against a ~316 ms
measured difference). Raw time still regressed, still counts, and is still
reported as a regression — SAME-TASK is diagnostic, never the headline.

Optimization took it from **844 ms → 549 ms (−35%)** by sharing one browser,
caching the axe-core source, reusing a duplicate screenshot and moving cold
start into a discarded warm-up pass. **No check was skipped.**

**The project count cannot go lower without breaking a rule.** All four
upstreams are `ESSENTIAL`. Every route to four requires moving
accessibility-audit onto a source with a weaker security gate (axe-core,
lighthouse), or onto LGPL-3.0-only `pa11y` — a licence-gate regression — or
dropping a capability. The optimizer attempted the first and **refused it**.
Vendoring was assessed and rejected: it would not even reduce the count, and
would move security responsibility onto this project.

### Review status

```
CODEX REVIEW        STATUS: NOT_RUN   REASON: CODEX_UNAVAILABLE
CLAUDE SELF REVIEW  19 defects found and fixed — see CHANGELOG.md
```

The self-review was performed by the agent that wrote the code. It is evidence
that specific defects were found, **not** evidence that the code is correct.

### What may and may not be claimed

Allowed, because each clause is backed by a committed measurement:

> In an executed benchmark against its own source plugins, the integrated plugin
> achieved higher measured task completion, broader measured quality coverage,
> and zero integration debt — at the cost of more upstream projects and higher
> raw execution time. At identical work it was not slower.

Prohibited: "always faster" (raw time regressed), "better in every metric" (five
regressed), "production proven" (never run outside this sandbox),
"independently reviewed" (Codex NOT_RUN).

## Layout

```
oss-integration/
├── CLAUDE.md              Mission, principles, prohibitions, invariants
├── ASSUMPTIONS.md         Every default adopted, and how to overturn it
├── PROVENANCE.md          Prior art, registry sources, dependencies
├── CHANGELOG.md           Including the independent-review findings
├── skills/
│   ├── oss-scout/SKILL.md            Discovery, evidence, gates, stack
│   └── integration-architect/SKILL.md Integration, redesign, generation
├── src/                   16 modules — see CLAUDE.md
├── schemas/               JSON Schemas for the four core records
├── data/                  Capability taxonomy + seed OSS registry
├── generated/plugins/     Build output
├── tests/                 Fixtures, benchmark suite, unit + acceptance tests
├── FINAL_RELEASE_REPORT.md    Build status, readiness, verdict, claim gate
├── DECISIONS.md              Why each remaining regression was accepted
├── BENCHMARK_POLICY_v0.1.1.md Versioned policy change, additive only
├── benchmark/baseline-v0.1.json  Frozen v0.1 evidence, never recomputed
├── ORIGINAL_CONTRIBUTIONS.md  Audit of the four original components — and the
│                          three that were examined and rejected
├── examples/              Two committed reference runs, synthetic and live
└── references/ambit.md    Prior-art record
```

## Status against the v0.1 definition of done

All 24 conditions met. `npm run verify` builds and runs 91 tests, plus 4 live
repository tests and 9 real-browser tests. Overall status is **CONDITIONAL**,
not PASS: material regressions remain, each quantified above and in
`FINAL_RELEASE_REPORT.md`.

## Licence

MIT. See [LICENSE](./LICENSE).
