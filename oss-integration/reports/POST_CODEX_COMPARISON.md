# PRE-CODEX → POST-CODEX comparison

The Codex independent review **did not run** (`CONNECTION_FAILED` — see
`CODEX_REVIEW_REPORT.md`), so there were no external findings to fix and **no
product code changed in this round**. This file exists so that absence is
recorded as a measured fact rather than an assumption.

## What changed

| Change | Kind | Risk |
| --- | --- | --- |
| `codex-cli` 0.151.0 installed; `codex@openai-codex` v1.0.6 marketplace-added and enabled | tooling, outside the project tree | none — the project does not import it |
| `reports/PRE_CODEX_BASELINE.md`, `reports/codex-package/`, `CODEX_REVIEW_REPORT.md` | documentation | none |
| **`tests/real-task.test.ts`: cache-safety test added** | test only, no product code | none — it can only fail, never change behaviour |

No `src/` file was modified. The benchmark difference below is therefore
timing noise on a shared machine, not an effect.

## Benchmark — PRE vs POST (synthetic, executed, full-capability)

| Metric | PRE | POST | Δ | Verdict change |
| --- | --- | --- | --- | --- |
| Task Completion | 1.0 | 1.0 | 0 | none |
| Error Rate | 0 | 0 | 0 | none |
| Security Findings (high/critical) | 0 | 0 | 0 | none |
| Integration Debt | 0 | 0 | 0 | none |
| Install Actions | 2 | 2 | 0 | none |
| Distinct Upstream Projects | 5 | 5 | 0 | none |
| Task Coverage per Install Action | 0.5 | 0.5 | 0 | none |
| Unscanned Dependencies | 2 | 2 | 0 | none |
| Output Quality (shared criteria) | 1.0 | 1.0 | 0 | none |
| Quality Criteria Covered | 7 | 7 | 0 | none |
| Execution Time | 549 ms | 556 ms | +7 ms (+1.3%) | none — noise |
| Reliability (3 repeats) | 1.0 | 1.0 | 0 | none |
| Time per Completed Task | 68.6 | 69.5 | +0.9 | none |
| Time per Quality Criterion | 78.4 | 79.4 | +1.0 | none |
| UX / Setup Time / Token Usage | NOT_VERIFIED | NOT_VERIFIED | — | none |

## Same-task (diagnostic)

| | PRE | POST |
| --- | --- | --- |
| originals-union | 252 ms | 256 ms |
| integrated | 249 ms | 252 ms |
| verdict | not material | **EQUIVALENT** |

Within noise in both runs. The correct reading is **EQUIVALENT — no material
orchestration overhead detected**. "The integrated plugin is faster" is *not*
supported by this and is not claimed.

## Live run

| | PRE | POST |
| --- | --- | --- |
| Task Completion | 0.75 | 0.75 |
| Unscanned Dependencies | 0 | 0 |
| Material regressions | 1 (Distinct Upstream Projects) | 1 (Distinct Upstream Projects) |

## Test matrix

| | PRE | POST |
| --- | --- | --- |
| TypeScript build | PASS | PASS |
| Offline tests | 86 pass / 0 fail | 86 pass / 0 fail |
| Live repository tests | 4 pass / 0 fail | 4 pass / 0 fail |
| Real browser tests | 9 pass / 0 fail | **10 pass / 0 fail** (cache-safety added) |
| Cache safety / shared-state leakage | not tested | **NONE detected**, now asserted permanently |

## Delta summary

**No regression introduced. One test added. No metric moved outside noise.**
The release verdict is unchanged, and remains constrained by the fact that no
independent party has reviewed this code.
