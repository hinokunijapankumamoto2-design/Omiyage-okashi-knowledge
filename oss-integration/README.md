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

## Verification status

**STATUS: CONDITIONAL.** The end-to-end flow works, the generated plugin is
valid, real repositories are analysed live and the task suite executes in a real
browser — but two material regressions remain and are reported rather than
tuned away.

### SYNTHETIC_TEST — executed head-to-head

Three fixture inputs. `fixture-org` is **not** a real organisation; nothing in
this run is a claim about a real project.

| Metric | best original | originals-union | integrated | Verdict | Material? |
| --- | --- | --- | --- | --- | --- |
| Task Completion | 0.25 | 0.5 | **1.0** | IMPROVED | — |
| Integration Debt | 3 | 6 | **0** | IMPROVED | — |
| Quality Criteria Covered | 3 | 4 | **7** | IMPROVED | — |
| Task Coverage per Install Action | 0.25 | 0.125 | **0.5** | IMPROVED | — |
| Output Quality (shared criteria) | n/a | 1.0 | 1.0 | EQUIVALENT | — |
| Error Rate | 0 | 0 | 0 | EQUIVALENT | — |
| Security Findings (high/critical) | 0 | 2 | 0 | EQUIVALENT | — |
| Reliability (3 repeats) | 1.0 | 1.0 | 1.0 | EQUIVALENT | — |
| Install Actions | 1 | 4 | 2 | REGRESSION | no |
| **Distinct Upstream Projects** | 1 | 3 | **5** | REGRESSION | **YES** |
| **Execution Time** | 440 ms | 462 ms | **844 ms** | REGRESSION | **YES** |
| UX / Setup Time / Token Usage | — | — | — | NOT_VERIFIED | — |

### LIVE_REPOSITORY_TEST — three real public repositories

`dequelabs/axe-core` (MPL-2.0), `americanexpress/jest-image-snapshot`
(Apache-2.0), `GoogleChrome/lighthouse` (Apache-2.0) — each licence read from
the licence text that ships with the project, each one's published source
fetched and scanned. One material regression: Distinct Upstream Projects, 5 vs
3.

### The two material regressions, unhidden

**Distinct Upstream Projects (5 vs 3).** Structural, not fixable by tuning: the
generated plugin is itself a project sitting on top of the ones it orchestrates,
so its supply-chain surface is larger than installing the originals. The stack
optimizer reduces the upstream count where it can — it eliminated a whole
project in the live run — but it **refuses to drop one more** because doing so
would move a capability onto a source with a weaker security gate. Tidiness is
not worth a gate.

**Execution Time (844 ms vs 462 ms).** Real work, honestly reported: the
integrated plugin runs accessibility, performance, screenshot and pixel-diff
passes that the originals cannot run at all. It completes 4× the tasks for
1.9× the time. The pre-registered materiality rule compares raw cost against
the realistic alternative, so it is recorded as material even though the
per-task rate is essentially unchanged.

Neither number was adjusted, and no metric was removed from the verdict.
`data/benchmark-metrics.json` holds the definitions, pre-registered before
re-measurement, including a materiality rule that works against the integrated
plugin.

### Review status

```
CODEX REVIEW    STATUS: NOT_RUN    REASON: CODEX_UNAVAILABLE
CLAUDE SELF REVIEW  17 defects found and fixed — see CHANGELOG.md
```

The self-review was performed by the agent that wrote the code. It is evidence
that specific defects were found, **not** evidence that the code is correct.

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
├── ORIGINAL_CONTRIBUTIONS.md  Audit of the four original components — and the
│                          three that were examined and rejected
├── examples/              Two committed reference runs, synthetic and live
└── references/ambit.md    Prior-art record
```

## Status against the v0.1 definition of done

All 24 conditions met. `npm run verify` builds and runs 85 tests; the `build`
command produces a plugin that passes structural validation. Overall status is
**CONDITIONAL**, not PASS: two material regressions remain, named above.

## Licence

MIT. See [LICENSE](./LICENSE).
