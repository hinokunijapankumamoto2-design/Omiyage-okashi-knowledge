# Changelog

## Unreleased — Codex environment evidence refresh — 2026-08-30

**Documentation only. No product code changed. No release verdict changed.**

The Codex CLI was installed into this session, which changed the observable
environment state. The conclusion is unchanged — **no usable Codex credential is
present** — but one supporting evidence statement went stale and is corrected.

Evidence timeline:

- At the earlier verification point, `~/.codex` did not exist.
- After Codex CLI installation, `~/.codex` now exists but contains **no
  credential material** — no `auth.json`, no token cache, only local state
  (sqlite logs/goals/memories/queue, `sessions/`, `installation_id`).

Re-verified 2026-08-30T08:45:35Z:

```
codex --version          codex-cli 0.151.0 (advanced runtime available)
codex login status       Not logged in (exit 1)
~/.codex                 PRESENT
auth.json                NOT PRESENT
token cache              NOT PRESENT
OPENAI_API_KEY           NOT SET
CODEX_API_KEY            NOT SET
CODEX_ACCESS_TOKEN       NOT SET
```

Single egress re-check, not retried:

```
TIMESTAMP       2026-08-30T08:45:51Z
TARGET          https://api.openai.com/v1/models
RESULT          no connection established (curl exit 56)
ERROR / STATUS  CONNECT tunnel failed, response 403
CLASSIFICATION  ENVIRONMENT_RESTRICTION
```

The CLI being installed is **not** authentication, readiness, or an independent
review. `INDEPENDENT CODEX REVIEW` remains `NOT_RUN` and v0.1 product
development remains frozen.

### Changed

- `CODEX_REVIEW_REPORT.md`, `CODEX_HANDOFF_REPORT.md`, `FINAL_RELEASE_REPORT.md`
  — replaced the stale `no ~/.codex` evidence with the current measured state
  and added the timestamped egress record.
- `CHANGELOG.md` — scoped the earlier `~/.codex absent` observation to its own
  verification point rather than deleting it.

## 0.1.0 — Codex independent review round — 2026-08-30

**No product code changed.** The Codex review could not run; this round records
that fact with evidence, and adds one safety test.

### Codex

```
CODEX_CONNECTION: FAIL
CODEX REVIEW:     NOT_RUN
REASON:           CONNECTION_FAILED
```

`codex-cli` 0.151.0 installed and `codex@openai-codex` v1.0.6 marketplace-added
and **enabled** — the tooling is in place. Both auth routes the plugin documents
are closed here: `api.openai.com`, `chatgpt.com` and `auth.openai.com` all
return `connect_rejected` (the egress proxy answers **403 to CONNECT**,
organization policy), and no credential exists (`codex login status` →
`Not logged in`, `~/.codex` absent at that verification point, `OPENAI_API_KEY`
unset). Seven recovery attempts
are recorded in `CODEX_REVIEW_REPORT.md`. Routing "Codex" through some other
reachable model was considered and **rejected** — it would make the label false.

**The self-review is not promoted to fill the gap.** It stays labelled
`SELF_REVIEW` wherever it appears.

### Added

- `reports/PRE_CODEX_BASELINE.md` — frozen state at commit `8a778c3`.
- `reports/codex-package/` — the full independent-review package (standard,
  adversarial, benchmark audit, security/licence/provenance), written to
  withhold the author's recommendation so it cannot anchor the reviewer, plus
  `RUN_CODEX_REVIEW.sh` to execute all four in one command.
- `CODEX_REVIEW_REPORT.md` — connection failure, cause, commands, errors,
  recovery attempts, and an explicitly empty findings table.
- `reports/POST_CODEX_COMPARISON.md` — PRE / POST / DELTA.
- **Cache-safety test** (`tests/real-task.test.ts`): the suite shares one
  browser and caches the axe-core source, so a subject *without* an
  accessibility capability must report "not measured" rather than inherit the
  previous subject's real violation count. **No leakage detected**, now asserted
  permanently.

### Revalidated, all unchanged

10/10 security categories detectable; empty scan still `UNKNOWN`, never `PASS`;
licence table intact (`UNKNOWN` and `NONE` both `mayCopy=false`); provenance
audit green; 0 unresolved conflicts; generated plugin valid in both runs.

## 0.1.0 — release gate — 2026-08-30

Benchmark policy **v0.1.1**. No new capability; optimization, measurement
correction and release judgement only. v0.1 results are frozen in
`benchmark/baseline-v0.1.json` and were not recomputed.

### Added

- `benchmark/baseline-v0.1.json` — the frozen v0.1 evidence, captured at commit
  `a5507ae` before this round began.
- `BENCHMARK_POLICY_v0.1.1.md` — versioned policy stating what changed, why, the
  effect on old results, and both how it could favour and how it could hurt the
  integrated plugin.
- **SAME-TASK comparison** (diagnostic) beside FULL-CAPABILITY (headline).
- **Normalized time metrics** added beside raw Execution Time, which is unchanged.
- **`Unscanned Dependencies`** — the component of supply-chain risk that actually
  carries risk. 2 offline, **0** under `--live`.
- **Phase profiler**; the execution profile is now printed in every benchmark report.
- **Ablation harness** (`tests/ablation.test.ts`) proving each original component
  changes something measurable, with a control that would catch a no-op component.
- `DECISIONS.md`, `FINAL_RELEASE_REPORT.md`, `ORIGINAL_CONTRIBUTIONS.md`.

### Changed — performance, with no check skipped

One browser shared across subjects (a context each), axe-core source cached, the
duplicate 1440×900 screenshot reused, and cold start moved into a discarded
warm-up pass. **844 ms → 549 ms (−35%).** The warm-up change is a fairness fix
that works *against* the integrated plugin.

### Findings this round

18. **Cold start was charged to whichever subject ran first**, so ordering rather
    than capability moved Execution Time. Fixed with the warm-up pass.
19. **The ablation harness counted a file's own frontmatter as a reference to
    itself**, which would have let a genuinely dead component pass. Fixed.

### Not fixed, and why

- **Distinct Upstream Projects (5 vs 3)** — every route to 4 requires weakening
  the security gate, weakening the licence gate, or dropping a capability. The
  optimizer refuses all three. `DECISIONS.md` D1.
- **Execution Time (549 ms vs 244 ms)** — the entire delta is accessibility and
  visual-regression work no baseline can perform. SAME-TASK shows 249 ms vs
  252 ms: at identical work it is not slower. `DECISIONS.md` D3.

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
17. **The architect re-opened a conflict the detector had already resolved**,
    discarding the detector's reasoning and reporting a runtime version floor as
    an unresolvable major clash. Both reference builds now have **zero**
    unresolved conflicts.

### Known limitations

- **Two material regressions remain and are reported, not tuned away.**
  `Distinct Upstream Projects` (5 vs 3 for installing all the originals) and,
  in the synthetic run, `Execution Time` (844 ms vs 462 ms). The first is
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
