# Changelog

## 0.1.0 — verification round — 2026-08-30

Second pass over the same MVP: no new product surface, only verification of
what already existed and repair of what it exposed.

### Added

- **`--live`**: real artifact fetching over `raw.githubusercontent.com` and
  `registry.npmjs.org`, including the published tarball, so the security gate
  scans real source instead of nothing. Live facts override the seed registry;
  the registry keeps only the curated capability mapping, and which is which is
  recorded in `dataProvenance`.
- **`--real-tasks`**: the task suite executes in a real browser against a real
  page — real `axe-core`, real pixel diffing, real navigation timings. Each
  subject gets its own capability-gated browser pass, so Execution Time is that
  subject's own cost. Turns Output Quality, Execution Time and Reliability from
  `NOT_VERIFIED` into measurements.
- **Pre-registered metric definitions** in `data/benchmark-metrics.json`,
  written before re-measurement, with a pre-registered materiality rule. The
  benchmark code reads them rather than restating them.
- **`originals-union` baseline**: all the originals installed together, which is
  the realistic alternative to an integrated plugin and therefore the honest
  counterfactual for any cost metric.
- **New reports**: `BENCHMARK_REPORT.md`, `SECURITY_REPORT.md`,
  `LIVE_REPOSITORY_REPORT.md`.
- **Provenance audit** (`tests/provenance-audit.test.ts`): `Reused Code: None`
  is now verified by shingle comparison against the generated artifacts, not
  taken on the generator's word.
- `ORIGINAL_CONTRIBUTIONS.md`, which also lists the components examined and
  **rejected** as original contributions.

## 0.1.0 — initial MVP — 2026-08-30

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
- 63 tests: unit, goal evaluation cases, schema conformance, and 4 acceptance suites.

### Review status

#### CODEX REVIEW

```
STATUS: NOT_RUN
REASON: CODEX_UNAVAILABLE
```

Codex is not available in this environment. No independent review has been
performed on this codebase by any party other than its author.

#### CLAUDE SELF REVIEW

**This is a SELF_REVIEW, not an independent review.** It was performed by the
same agent that wrote the code, and carries the bias that implies: it is
evidence that specific defects were found and fixed, not evidence that the code
is correct. The previous build report described this as an "independent review";
that description was wrong and is corrected here.

Defects found by self-review in v0.1 and fixed:

1. **Goal decomposition was too literal**, reducing the reference goal to two
   capabilities. Fixed with data-driven goal archetypes recorded on the GoalSpec.
2. **Unlocked capabilities were miscounted as gaps.** Fixed with
   `GapReport.coveredByUnlock`.
3. **The Stack Optimizer named in the specification was never built.** Added.
4. **A benchmark metric compared subjects of different scope.** Fixed.
5. **Duplicate evidence bases** in `profileEvidence`. Deduplicated.
6. **The CLI executed on import.** Fixed with an entry-point check.

Defects found by self-review in this verification round and fixed:

7. **`--live` threw a TDZ error** (`hasTestFiles` used before initialization),
   so every live fetch silently fell back to seed data. The fallback reported
   itself correctly, which is how it was caught.
8. **A security rule fired on any JSON value starting with `http://`**,
   flagging author URLs as suspicious dependencies. Replaced with a structured
   `package.json` inspection that only reads the dependency maps and the
   install-time scripts.
9. **The `destructive-rm` rule did not match its own description.** It claimed
   to fire on a delete against a *broad* path but matched any recursive+force
   delete, so a library deleting its own computed temp file was scored
   identically to `rm -rf /` — and BLOCKed a clean dependency. Split into a
   critical broad-path rule and a medium rule that states the path was not
   evaluated. Verified in both directions: `rm -rf /` still BLOCKs.
10. **The artifact scan budget was spent in archive order**, reading twenty
    translation files while skipping the install script. Now prioritised by
    risk.
11. **The stack optimizer only eliminated single-capability sources**, so it
    kept both a tool and a wrapper around it. Added a source-elimination pass.
12. **The optimizer would trade a clean security gate for a degraded one** to
    reduce the project count. It now refuses to weaken a gate for tidiness —
    which costs one project in the reference build, and is reported as such.
13. **`node@20` vs `node@18` was reported as an unresolved conflict.** Runtime
    engine versions are floors, not pins. Now resolved to the highest floor;
    genuine library major clashes are still unresolved.
14. **Error Rate and Execution Time reported `0` for a subject that attempted
    nothing**, making inaction look like a clean, fast record. Both now report
    `null`.
15. **Output Quality punished breadth**: a subject that could check
    accessibility and found a real page defect scored *lower* than one that was
    blind to it. Now scored over the criteria the compared subjects share, with
    breadth reported separately as `Quality Criteria Covered`.
16. **The generated router referenced none of its sibling skills**, and
    `config/default.json` was generated but never referenced. Both fixed, and
    an acceptance test now fails on any unreachable component.

### Known limitations

- **Two material regressions remain and are reported, not tuned away.**
  `Distinct Upstream Projects` (5 vs 3 for installing all the originals) and,
  in the synthetic run, `Execution Time` (869 ms vs 454 ms). The first is
  structural: the plugin is itself a project on top of the ones it orchestrates.
  The second is real work: it completes 4× the tasks. Neither is hidden.
- **UX, Setup Time and Token Usage remain NOT_VERIFIED.** UX needs human
  subjects. Token Usage does not exist for a suite executed as deterministic
  code rather than through a model. No proxy is substituted for either.
- **The GitHub REST API is unreachable** from this environment (HTTP 403), so
  `--live` uses `raw.githubusercontent.com` and `registry.npmjs.org`. The
  latest commit SHA is therefore always `UNKNOWN`, and the default branch is
  the one that served content rather than a confirmed default.
- **The real-task page is a locally served fixture**, not a remote production
  site. The browser, the accessibility engine, the pixel diff and the timings
  are real; the page is one we control, so the benchmark stays reproducible.
- Discovery is limited to the seed registry unless `--live` is passed, which
  adds an npm-registry search. A missing capability means "not found by the
  sources we searched", not "does not exist".
