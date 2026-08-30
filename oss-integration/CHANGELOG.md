# Changelog

## 0.1.0 — 2026-08-30

First MVP. Goal → discovery → capability comparison → selection → integration →
conflict resolution → **generated plugin** → benchmark, in one pass.

### Added

- **Goal Engine** with capability decomposition and auditable goal archetypes.
- **Repository Analyzer** with three resolution paths — local fixture, seed
  registry, live GitHub — and an explicit UNKNOWN stub when none applies.
- **Capability Extractor**, **Evidence Engine**, **License Gate**,
  **Security Gate** (10 risk categories, 10 rules), **Health Engine**.
- **Capability Graph** with REQUIRES / COMPLEMENTS / ALTERNATIVE_TO /
  CONFLICTS_WITH / UNLOCKS, prerequisite closure and near-miss detection.
- **Gap Engine**, **Duplicate Detector**, **Conflict Detector** (9 kinds).
- **Scout Score** — weighted per spec, popularity capped at 5%, gate-aware.
- **Capability Selector** (KEEP / REPLACE / ADD / REMOVE / WATCH / REJECT /
  UNKNOWN, each with a reason), **Stack Optimizer**, **Integration Architect**,
  **Original Layer Designer**.
- **Plugin Builder** emitting a real Claude Code plugin, plus
  **Package Validator**, **Benchmark Runner** and report renderers.
- CLI: `goal`, `analyze`, `build`.
- 62 tests: unit, goal evaluation cases, schema conformance, and 4 acceptance suites.

### Independent review (rule 34)

Codex was unavailable in this environment, so the independent review was run as
a self-directed adversarial pass. Development continued rather than stopping,
per rule 34's own fallback. Findings that changed the code:

1. **Goal decomposition was too literal.** Keyword aliasing reduced
   "Claude Codeで最高品質のWebサイトを作れるPluginを作って" to two capabilities,
   so the first build selected one capability and benchmarked at 0.0 task
   completion. *Fix:* data-driven goal archetypes, recorded on the GoalSpec
   with their rationale so the expansion stays auditable rather than becoming
   invention. Task completion moved 0.0 → 0.889.
2. **Unlocked capabilities were miscounted as gaps.** `visual-review` is
   unlocked by the selected combination, but the gap engine reported it missing
   and the selector emitted UNKNOWN for it. *Fix:* `GapReport.coveredByUnlock`;
   such capabilities enter the stack as original contributions of the
   integration instead of being shopped for.
3. **The Stack Optimizer named in §5 was never built.** Per-capability
   selection scattered the stack across five projects when four sufficed.
   *Fix:* `src/integration/optimizer.ts`, which consolidates onto sources
   already committed to and refuses to trade evidence for tidiness. Verified
   reduction 5 → 4 sources on the acceptance fixture.
4. **A benchmark metric was punishing the wrong thing.** Raw install-source
   count compared subjects delivering 2 tasks against one delivering 8. *Fix:*
   `countsTowardVerdict` / `excludedBecause` on `MetricResult`; the raw number
   is still reported and any rise in it is called out, and a normalized
   coverage-per-install metric carries the verdict. The exclusion and its
   justification are printed in the report.
5. **Duplicate evidence bases** were emitted by `profileEvidence`. *Fix:*
   deduplicated before classification.
6. **CLI executed on import**, which would have run the CLI during tests.
   *Fix:* entry-point comparison via `realpathSync`.

### Known limitations

- The benchmark is **static capability coverage**. The generated plugin was not
  executed against a live target, so Output Quality, Reliability, UX and Token
  Usage are `NOT_VERIFIED`.
- Registry-sourced candidates have `securityStatus: UNKNOWN` offline, because
  no artifact was available to scan. This is why the integrated plugin's Error
  Rate regresses against the fixtures, whose artifacts *were* scanned.
- The v0.1 no-vendoring policy (rule 28) means the generated plugin orchestrates
  upstream tools rather than containing them, so every selected source stays a
  separate install. This is the direct cause of the install-source cost.
- Discovery is limited to the seed registry unless `--live` is passed. A
  missing capability means "not in the seed registry", not "does not exist".
