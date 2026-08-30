# PRE-CODEX BASELINE

Frozen immediately before the Codex independent-review round. Nothing in this
file is recomputed later; the post-Codex state is compared **against** it.

| Field | Value |
| --- | --- |
| Git commit | `8a778c3e27905c1f95d77542f94aca2663eec727` |
| Working tree | clean |
| Benchmark policy | v0.1.1 (v0.1 frozen at `benchmark/baseline-v0.1.json`) |
| TypeScript build (`noEmitOnError`) | **PASS** |
| Offline tests | # pass 86 # fail 0  |
| Live repository tests | # pass 4 # fail 0  |
| Real browser tests | # pass 9 # fail 0  |
| Unresolved conflicts | 0 (both reference builds) |
| Integration debt (integrated) | 0 |
| Generated plugin validation | PASS (both reference builds) |
| Provenance | `Reused Code: None`, verified from artifacts by 8-word shingle audit |
| Licence status | 4 selected upstreams all Apache-2.0 / REUSE_WITH_CONDITIONS; nothing vendored |
| Security status | 10/10 risk categories detectable; no gate BLOCK in the selected stack |
| Codex review | NOT_RUN / CODEX_UNAVAILABLE |

## Benchmark — synthetic, executed, full-capability

| Metric | best original | originals-union | integrated | verdict | material |
| --- | --- | --- | --- | --- | --- |
| Task Completion | 0.25 | 0.5 | 1.0 | IMPROVED | — |
| Error Rate | 0 | 0 | 0 | EQUIVALENT | — |
| Security Findings (high/critical) | 0 | 2 | 0 | EQUIVALENT | — |
| Integration Debt | 3 | 6 | 0 | IMPROVED | — |
| Install Actions | 1 | 4 | 2 | REGRESSION | no |
| Distinct Upstream Projects | 1 | 3 | 5 | REGRESSION | **YES** |
| Task Coverage per Install Action | 0.25 | 0.125 | 0.5 | IMPROVED | — |
| Unscanned Dependencies | 0 | 0 | 2 | REGRESSION | **YES** |
| Output Quality (shared criteria) | n/a | 1.0 | 1.0 | EQUIVALENT | — |
| Quality Criteria Covered | 3 | 4 | 7 | IMPROVED | — |
| Execution Time | 243 ms | 244 ms | 549 ms | REGRESSION | **YES** |
| Reliability (3 repeats) | 1.0 | 1.0 | 1.0 | EQUIVALENT | — |
| Time per Completed Task | 121.5 | 61 | 68.6 | REGRESSION | **YES** |
| Time per Quality Criterion | 81.7 | 61 | 78.4 | REGRESSION | **YES** |
| UX / Setup Time / Token Usage | — | — | — | NOT_VERIFIED | — |

## Same-task (diagnostic)

| | originals-union | integrated |
| --- | --- | --- |
| Execution Time | 252 ms | 249 ms |

## Live run

Task Completion 0.75 IMPROVED; Unscanned Dependencies **0**; one material
regression only (Distinct Upstream Projects 5 vs 3).

## Verdict at freeze

```
BUILD STATUS          CONDITIONAL
IMPROVEMENT VERDICT   REGRESSION (full-capability)
RELEASE READINESS     READY_WITH_KNOWN_TRADEOFFS
SHIP DECISION         SHIP_WITH_LIMITATIONS
```
