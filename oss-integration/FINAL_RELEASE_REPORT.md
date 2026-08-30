# OSS INTEGRATION MVP v0.1 — FINAL RELEASE REPORT

```
BUILD STATUS          CONDITIONAL
RELEASE READINESS     READY_WITH_KNOWN_TRADEOFFS
IMPROVEMENT VERDICT   REGRESSION   (full-capability, both runs)
BENCHMARK POLICY      v0.1.1  (v0.1 frozen at benchmark/baseline-v0.1.json)
```

These three are deliberately separate. "The product works" and "every metric
improved" are different questions, and only the second is a REGRESSION.

---

## GOAL

`Claude Codeで最高品質のWebサイトを作れるPluginを作って` — normalized to 10
required and 3 optional capabilities via a recorded, auditable goal archetype.

## LIVE EVIDENCE

Three real public repositories, analysed over the network this run. Licences read
from the licence **text** shipped with each project, not a metadata field.

| Repository | Licence | Release | Artifacts scanned | Security gate |
| --- | --- | --- | --- | --- |
| `dequelabs/axe-core` | MPL-2.0 | 4.13.0 | 28 | REVIEW_REQUIRED (1) |
| `americanexpress/jest-image-snapshot` | Apache-2.0 | 6.5.2 | 11 | CONDITIONAL (1) |
| `GoogleChrome/lighthouse` | Apache-2.0 | 13.4.1 | 63 | CONDITIONAL (2) |

Discovery live-verified **20** real repositories in total, including
`reshotdev/screenshot`, which the security gate **BLOCKed** on real fetched
source. `REMOTE_REAL_SITE: NOT_VERIFIED — REASON: ENVIRONMENT_RESTRICTION`
(remote sites are unreachable from this sandbox; the browser, engine and
timings are real, the page is served from localhost).

## GENERATED PLUGIN

Valid Claude Code plugin, structural validation **PASS** in both runs. Emits only
what the goal needs: 5 skills in the synthetic run (which has name collisions),
3 in the live run (which has none). Zero dead components, asserted by test.

## CAPABILITY COVERAGE

11 capabilities: 3 from `frontend-craft`, 3 from `browser-qa`, 2 from
`jest-image-snapshot`, 2 from `lighthouse`/`playwright`, plus `visual-review`
delivered by the combination itself at evidence `INFERRED`.

## ORIGINAL CONTRIBUTIONS

All four kept — each proven by ablation, not asserted. Three further components
were examined and **rejected** as original contributions. See `DECISIONS.md` D5
and `ORIGINAL_CONTRIBUTIONS.md`.

## DEPENDENCY MAP / DISTINCT UPSTREAM PROJECTS

5 = the generated plugin + 4 upstreams. All four classified `ESSENTIAL`; full
ownership table in `DECISIONS.md` D1.

## SUPPLY CHAIN ANALYSIS

Project count alone does not express risk. Reported as inputs, not collapsed:

| Input | offline | `--live` |
| --- | --- | --- |
| Distinct Upstream Projects | 5 | 5 |
| **Unscanned Dependencies** | **2** | **0** |
| Security gate non-PASS | 2 | 2 (both CONDITIONAL, none BLOCK) |
| Licence gate non-permissive | 0 | 0 |

Five small, licence-clean, fully-scanned dependencies are not obviously worse
than one large unscanned one. The component that actually carries risk —
unscanned dependencies — is **0 under `--live`**.

## LICENSE

Every selected upstream is Apache-2.0 / `REUSE_WITH_CONDITIONS`. Nothing
vendored; `Reused Code: None` verified from the artifacts by shingle comparison,
not taken on the generator's word. Vendoring was assessed and **rejected**
(`DECISIONS.md` D2) — it would not even reduce the project count, and would move
security responsibility onto us.

## SECURITY

All 10 risk categories re-validated as detectable after optimization; no gate
status changed. `rm -rf /` still BLOCKs; scanning nothing still yields UNKNOWN,
never PASS. The optimizer **refused** a project-count reduction that would have
moved accessibility-audit onto a weaker-gated source.

## EXECUTION PROFILE

| Phase | % of measured time |
| --- | --- |
| screenshot:capture (39 calls) | 48.0% |
| browser:newPage (15) | 14.1% |
| axe:inject / axe:run (3 each) | 13.2% |
| page:goto (15) | 5.8% |
| pixel:diff (3) | ~5% |

Browser launch, module loading and the axe-core read happen once in a discarded
warm-up pass and are charged to nobody.

## RAW EXECUTION TIME (kept, still counts, still regresses)

| | v0.1 baseline (frozen) | v0.1.1 now | change |
| --- | --- | --- | --- |
| integrated | 844 ms | **549 ms** | **−35%** |
| originals-union | 462 ms | 244 ms | −47% |

Optimizations: one shared browser, cached axe source, reuse of a duplicate
screenshot, plus a warm-up fairness fix. **No check skipped, no validation
shortened, no capability disabled.**

## NORMALIZED PERFORMANCE (added, never replacing raw)

| Metric | best original | union | integrated | verdict |
| --- | --- | --- | --- | --- |
| Execution Time per Completed Task | 121.5 | 61 | 68.6 | REGRESSION (material) |
| Execution Time per Quality Criterion | 81.7 | 61 | 78.4 | REGRESSION (material) |

## SAME-TASK vs FULL-CAPABILITY

| Mode | Execution Time (union → integrated) | Reading |
| --- | --- | --- |
| **FULL-CAPABILITY** (headline) | 244 → 549 ms, REGRESSION, material | Doing all it can, it costs more |
| **SAME-TASK** (diagnostic) | 252 → **249 ms**, not material | At identical work it is **not slower** |

The entire full-capability delta is accounted for by accessibility auditing and
visual regression that no baseline can perform at all — measured at ~315 ms of
extra work against a ~316 ms measured difference. **There is no orchestration
overhead to remove.** This does not cancel the raw regression, and is not
offered as doing so.

## BASELINE vs INTEGRATED — full-capability, synthetic, executed

| Metric | best original | union | integrated | verdict | material |
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
| **Unscanned Dependencies** | 0 | 0 | **2** *(0 live)* | REGRESSION | **YES** |
| **Execution Time** | 243 | 244 | **549** | REGRESSION | **YES** |
| **Time per Completed Task** | 121.5 | 61 | **68.6** | REGRESSION | **YES** |
| **Time per Quality Criterion** | 81.7 | 61 | **78.4** | REGRESSION | **YES** |
| UX / Setup Time / Token Usage | — | — | — | NOT_VERIFIED | — |

**Live run:** Task Completion 0.75 IMPROVED; Unscanned Dependencies **0**
EQUIVALENT; **one** material regression only — Distinct Upstream Projects.

## MATERIAL REGRESSIONS

| Regression | Abs Δ | Rel Δ | User impact | Goal impact | Security impact | Maintenance impact | Can fix? | Cost to fix | Trade-off | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Distinct Upstream Projects | +2 vs union | +67% | LOW — one `npm install` either way | none | Neutral: all 4 licence-clean, 0 unscanned live | Slightly higher; upstreams patch themselves | **NO** | Only by weakening a gate or dropping a capability | Supply-chain breadth for capability breadth | **ACCEPT, disclosed** |
| Unscanned Dependencies (offline only) | +2 | — | MEDIUM offline | none | Real: UNKNOWN ≠ PASS | none | **YES — already** | Run `--live` | Reproducibility vs coverage | **ACCEPT offline; `--live` is the real mode** |
| Execution Time | +305 ms | +125% | **LOW** — sub-second, non-interactive | none: it buys 4× completion | none | none | Partly — done (−35%) | Further cuts mean checking less | Time for accessibility + visual regression | **ACCEPT, disclosed** |
| Time per Completed / per Criterion | +7.6 ms / +17.4 ms | +12% / +29% | LOW | none | none | none | NO | — | Marginal cost of harder checks | **ACCEPT, disclosed** |

## ACCEPTED TRADEOFFS

1. More upstream projects in exchange for 4× measured task completion.
2. Higher raw execution time in exchange for accessibility and visual-regression
   checking no baseline can do.
3. A slightly worse per-task time rate, because the added checks are the
   expensive ones.

## UNACCEPTABLE TRADEOFFS (refused during this round)

1. Moving accessibility-audit to a weaker-gated source to reach 4 projects.
2. Moving it to LGPL-3.0-only `pa11y` — a licence-gate regression.
3. Vendoring for project count alone.
4. Skipping any check to reduce execution time.
5. Retroactively editing v0.1's verdict, or removing a regressing metric from
   the verdict.

## CODEX CONNECTION

```
CODEX_CONNECTION: FAIL
```

| | |
| --- | --- |
| Codex CLI | ✅ `codex-cli 0.151.0` installed, advanced runtime available (installed only — not authenticated, no review run through it) |
| Plugin | ✅ `codex@openai-codex` v1.0.6 marketplace-added, installed, **enabled** |
| Commands available | `/codex:review`, `/codex:adversarial-review`, `/codex:status`, `/codex:setup`, … |
| Auth | ❌ `codex login status` → **Not logged in**. `~/.codex` present (created by the CLI install) but **no credential material**: no `auth.json`, no token cache. `OPENAI_API_KEY` / `CODEX_API_KEY` / `CODEX_ACCESS_TOKEN` unset. Re-verified 2026-08-30T08:45:35Z |
| Network | ❌ `api.openai.com` / `chatgpt.com` / `auth.openai.com` → `connect_rejected`, **403 to CONNECT (organization policy)**. Single re-check 2026-08-30T08:45:51Z: unchanged. Classified `ENVIRONMENT_RESTRICTION`, not a Codex product failure |
| Recovery attempts | 7, all recorded in `CODEX_REVIEW_REPORT.md` |

The tooling side is complete; the blocker is egress policy plus absent
credentials. Substituting a different model and calling it Codex was considered
and **rejected**.

## CODEX STANDARD REVIEW / ADVERSARIAL REVIEW / BENCHMARK AUDIT / SECURITY-LICENCE-PROVENANCE AUDIT

```
NOT_RUN — REASON: CONNECTION_FAILED
```

All four review packages are written and committed at `reports/codex-package/`,
deliberately withholding this report's recommendation so it cannot anchor the
reviewer. One command runs all four once access exists.

## CODEX FINDINGS

```
CRITICAL: 0    HIGH: 0    MEDIUM: 0    LOW: 0
```

**Zero findings because nobody looked.** This is not a clean bill of health and
must not be read as one.

## CLAUDE VERIFIED FINDINGS / FALSE POSITIVES / FIXED FINDINGS

None — there were no external findings to verify, dismiss or fix.

## CLAUDE SELF REVIEW

**SELF_REVIEW — not independent, and not promoted to fill the Codex gap.**
19 defects found and fixed across the verification and convergence rounds.
Evidence that specific defects were found; **not** evidence the code is correct.

Three of the most consequential were caught only on a *later* self-pass, invisible
to the pass that wrote them: a live-fetch TDZ error that made every live fetch
silently fall back to seed data; a security rule that BLOCKed a clean dependency
because it never checked the path breadth its own description claimed; and a
benchmark that scored a subject *worse* for being able to see a real defect.
That is the failure mode independent review exists to catch, and the best
argument that this project still needs the review it could not run.

## PRE-CODEX BASELINE → POST-CODEX RESULTS

No product code changed this round; one test was added. Full table in
`reports/POST_CODEX_COMPARISON.md`.

| | PRE | POST | Δ |
| --- | --- | --- | --- |
| Offline / live / browser tests | 86 / 4 / 9 | 86 / 4 / **10** | +1 (cache safety) |
| Execution Time (integrated) | 549 ms | 556 ms | +1.3%, noise |
| Same-task (union → integrated) | 252 → 249 ms | 256 → 252 ms | **EQUIVALENT** both runs |
| Material regressions | 5 synthetic / 1 live | 5 synthetic / 1 live | unchanged |
| Cache / shared-state leakage | untested | **NONE**, now asserted | new evidence |

**Same-task reads EQUIVALENT — no material orchestration overhead detected.**
"The integrated plugin is faster" is not supported by n=3 on one machine and is
not claimed.

## PROVENANCE

`Reused Code: None`, verified from the generated artifacts by 8-word shingle
comparison against every upstream artifact held. Prior art (`zz-plant/ambit`,
MIT) credited as concept-only and pinned `REFERENCE_ONLY` by policy.

## KNOWN LIMITATIONS

- **This code has never been reviewed by anyone but its author.** Codex could
  not be reached; the review package is ready but unrun. This is the single
  largest limitation on confidence in everything below.
- Remote real-site validation `NOT_VERIFIED` (environment restriction).
- Benchmark n=3 on one machine; no p95 reported. Sufficient for the direction
  of large effects, not for small ones — which is why same-task is read as
  EQUIVALENT rather than as a win.
- GitHub REST API unreachable → latest commit SHA always `UNKNOWN`.
- UX, Setup Time, Token Usage never measured; no proxy substituted.
- Synthetic fixtures are not real projects and are never reported as such.
- Live-run baselines can attempt no task, so several live metrics have no
  comparison and report `NOT_VERIFIED`.

## UNKNOWN

Latest commit SHA; true default branch; UX; setup wall-clock; token usage;
whether unsearched ecosystems hold a permissive PASS-grade a11y engine.

## MARKETING CLAIMS ALLOWED

> In an executed benchmark against its own source plugins, the integrated plugin
> achieved higher measured task completion (1.0 vs 0.5 for installing all three),
> broader measured quality coverage (7 criteria vs 4), and zero integration debt
> (vs 6) — at the cost of more upstream projects and higher raw execution time.
> At identical work it was not slower.

Every clause above is backed by a committed measurement.

## MARKETING CLAIMS PROHIBITED

"World's best"; "best Claude Code plugin"; "always faster" (it is not — raw time
regressed); "more secure than every alternative"; "better in every metric" (five
metrics regressed); "production proven" (never run outside this sandbox); **"independently
reviewed", "Codex-verified", "externally audited"** — the review did not run;
"faster at the same work" (same-task is EQUIVALENT, not faster).

## FINAL RECOMMENDATION

```
SHIP_WITH_LIMITATIONS
```

The end-to-end flow works, the generated plugin is valid, live analysis and real
browser execution both pass, there are zero unresolved conflicts and zero
integration debt. Five metrics regress; all five are quantified, none is hidden,
none was tuned away, and each is a disclosed trade-off rather than a defect.
`--live` is the recommended operating mode: it takes unscanned dependencies to
zero and leaves a single material regression.

One release-blocker check, run explicitly: no critical security defect, no
blocking licence issue, no provenance integrity failure, no core-flow failure,
no invalid generated plugin, no material benchmark invalidity, no unresolved
high-severity correctness defect. **None present** — so the blocker rule does
not force `DO_NOT_SHIP`. "Never independently reviewed" is not on that list, and
is neither silently promoted onto it nor silently dismissed: it is the headline
limitation, and any CRITICAL or HIGH finding from a future Codex run moves this
to `DO_NOT_SHIP` until fixed.

**CONDITIONAL is the truth, so CONDITIONAL is reported.**
