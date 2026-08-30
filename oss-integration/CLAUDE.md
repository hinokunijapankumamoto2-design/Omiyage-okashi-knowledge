# CLAUDE.md — OSS Scout × Integration Architect

## Mission

世界のOSSをCapability単位で理解し、目的に最適な能力を選択・統合・再設計し、
検証済みの目的特化型Pluginを生成する。

Understand the world's OSS at the level of *capabilities*, select the ones a
specific goal needs, integrate and re-architect them, and emit a verified,
purpose-built plugin.

The deliverable is never a list of repositories. It is an **OPTIMIZED PLUGIN**.

## Principles

```
Evidence > Popularity
Capability > Repository
Goal > Tool
Integration > Collection
Optimization > Bundling
Verified > Claimed
License before Reuse
Security before Convenience
Benchmark before Marketing Claim
Simple MVP before Platform
```

## Prohibited

- **Starsだけで評価しない.** Popularity is capped at 5% of the Scout Score and
  cannot lift a candidate on its own. `classifyEvidence(['social-popularity'])`
  returns `UNKNOWN` by construction.
- **Licenseを推測しない.** "Public on GitHub" grants nothing. An unobserved
  licence is `UNKNOWN`, and `UNKNOWN` never permits copying code.
- **Evidenceを捏造しない.** An evidence class is *derived* from what was
  actually inspected (`src/evidence/engine.ts`). Nothing may declare itself
  VERIFIED.
- **UNKNOWNを埋めない.** Every report has an UNKNOWN section. Leave it
  populated rather than guessing.
- **第三者コードを無断コピーしない.** v0.1 policy: the builder copies no
  third-party source at all. `PROVENANCE.md` says `Reused Code: None` because
  the generator makes it structurally true, not because we promised.
- **READMEだけでCapabilityを確定しない.** `RepositoryProfile.inspected` records
  which artifact kinds were available; a README-only inspection caps the
  evidence class at CLAIMED/SUPPORTED, never VERIFIED.
- **複数Pluginを単純結合しない.** One implementation per capability. The
  duplicate detector resolves every collision to a single winner on a named
  axis before anything is generated.
- **Benchmarkなしに「改善」と断定しない.** An unmeasured dimension is reported
  as `NOT_VERIFIED`. A measured regression is reported as `REGRESSION DETECTED`
  and blocks the "improved" claim.

## Architecture

```
src/
  goal/          Goal Engine — NL goal → GoalSpec, capability decomposition
  capability/    Taxonomy + Capability Extractor
  repository/    Repository Analyzer (fixture / registry seed / live GitHub)
  discovery/     Global Discovery Engine
  evidence/      Evidence Engine — the only place an evidence class is assigned
  license/       License Gate
  security/      Security Gate
  health/        Health Engine
  graph/         Capability Graph — REQUIRES / COMPLEMENTS / ALTERNATIVE_TO /
                 CONFLICTS_WITH / UNLOCKS, plus near-miss detection
  gap/           Gap Engine — required − held = missing, minus unlocks
  compatibility/ Duplicate Detector + Conflict Detector
  scoring/       Scout Score (weighted, gate-aware)
  integration/   Capability Selector, Stack Optimizer, Integration Architect
  builder/       Plugin Builder — writes a real Claude Code plugin
  validation/    Package Validator, Benchmark Runner, Report renderers
  pipeline.ts    OSS Scout end-to-end
  cli.ts         oss-integrate
```

## Invariants to preserve when changing this code

1. **Evidence is derived, never asserted.** If you add a new signal, add it to
   `EvidenceBasis` and let `classifyEvidence` rank it. Do not write
   `class: 'VERIFIED'` anywhere outside that engine.
2. **A hard gate BLOCK outranks any score.** `ScoutScore.blocked` is computed
   from the gates and the selector rejects on it before it looks at numbers.
3. **Scanning nothing yields UNKNOWN.** `scanSecurity({artifacts:{}})` must
   never return PASS. Absence of findings is not evidence of safety.
4. **One capability, one implementation.** If you add a code path that can put
   two sources for the same capability into a stack, it is a bug.
5. **Every decision carries a reason.** `CapabilityDecision.reason` is asserted
   non-trivial by the acceptance tests.
6. **The builder never copies upstream source.** If that ever changes, the
   licence gate's `mayCopyCode()` must gate it and PROVENANCE must stop saying
   `Reused Code: None`.
7. **A benchmark metric excluded from the verdict must say why**, and only
   "no subject measured it" is an acceptable reason. Excluding a metric because
   its result is unflattering is forbidden. See `MetricResult.countsTowardVerdict`.
8. **Metric definitions live in `data/benchmark-metrics.json`, not in code**,
   and are pre-registered before measurement. Changing one requires a
   `changedFromV01` entry naming the measurement DEFECT it fixes. "The number
   looked bad" is not a defect.
9. **Every subject is measured by the same rule.** Two of this project's worst
   bugs were asymmetric measurement — charging the integrated plugin for its
   upstreams while charging originals nothing, and scoring each subject over its
   own rubric subset so that seeing more made you score worse.
10. **A subject that attempted nothing has no error rate and no execution
    time.** Report `null`, not `0`. Inaction must never look like a clean, fast
    record.
11. **The optimizer may never weaken a gate or an evidence class** to reduce
    the project count. Tidiness is not worth a security gate.
12. **Self-review is not independent review.** If Codex is unavailable, record
    `CODEX REVIEW: NOT_RUN / CODEX_UNAVAILABLE` and log the pass separately as
    `CLAUDE SELF REVIEW`.

## Reproducing a run

```bash
npm install
npm run build
npm test                      # 84 offline tests

# opt-in, network:  real public repositories
OSS_LIVE_TEST=1 node --test "dist/tests/live-repository.test.js"

# opt-in, browser:  real page, real axe-core, real pixel diff
OSS_REAL_TASK=1 OSS_CHROMIUM_PATH=/path/to/chrome \
  node --test "dist/tests/real-task.test.js"
node dist/src/cli.js build --goal "…" --repo … --repo …
```

Runs are offline and deterministic by default. `--live` is the only thing that
touches the network; without it an unresolvable repository becomes an explicit
UNKNOWN rather than a guess. `--real-tasks` is the only thing that starts a
browser.

**Synthetic and live results are never mixed.** A fixture under `fixture-org` is
not a real project, and no fact about one may be reported as a fact about a real
repository. Every report classifies its sources as `LIVE_VERIFIED`,
`SEED_REGISTRY` or `SYNTHETIC`.
