# PRE_EXTERNAL_CODEX_REVIEW — v0.1 FREEZE

v0.1 is **frozen** at the commit below. Product code does not change until an
external Codex review returns findings that are independently reproduced.

Permitted while frozen: review package, review scripts, review documentation,
result-import structure. Nothing else.

## Baseline

| Field | Value |
| --- | --- |
| Commit SHA | `fb76b8a613a3db9c1f8707868f32dc7429691c5f` |
| Branch | `claude/oss-scout-integration-mvp-514zru` |
| Working tree at freeze | clean |
| Benchmark policy | v0.1.1 (v0.1 frozen separately at `benchmark/baseline-v0.1.json`) |
| TypeScript build (`noEmitOnError`) | **PASS** |
| Offline tests | pass 86 fail 0  |
| Live repository tests | pass 4 fail 0  |
| Real browser tests | pass 10 fail 0  |

## Generated plugin state

Content hash = sha256 over the sorted per-file sha256 list. Any change to a
generated artifact changes this value.

| Plugin | Files | Content hash |
| --- | --- | --- |
| `examples/frontend-plugin/frontend-quality-plugin` | 16 | `f6bc6c959dbfe22c4ab54a9675fc9230d4ae978672432f5cb0d9dad6a72967cf` |
| `examples/live-plugin/live-web-quality` | 15 | `649d4a6d1a3764c4494bd293bef5a1b69e5d098347b4b219a954644f589889cb` |

## Results at freeze

| Area | Result |
| --- | --- |
| Security | 10/10 risk categories detectable; empty scan → UNKNOWN, never PASS; no BLOCK in either selected stack; cache/shared-state leakage **NONE**, asserted by test |
| Licence | 12 SPDX rules; all 4 selected upstreams Apache-2.0 / REUSE_WITH_CONDITIONS; `UNKNOWN` and `NONE` both non-copyable; nothing vendored |
| Provenance | `Reused Code: None`, verified from generated artifacts by 8-word shingle audit |
| Conflicts | 0 unresolved, both builds |
| Integration debt | 0 (integrated) |
| Generated plugin validation | PASS, both builds |

## Benchmark at freeze — synthetic, executed, full-capability

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
| Execution Time | 246 ms | 235 ms | 556 ms | REGRESSION | **YES** |
| Reliability (3 repeats) | 1.0 | 1.0 | 1.0 | EQUIVALENT | — |
| Time per Completed Task | 123 | 58.8 | 69.5 | REGRESSION | **YES** |
| Time per Quality Criterion | 83.7 | 58.8 | 79.4 | REGRESSION | **YES** |
| UX / Setup Time / Token Usage | — | — | — | NOT_VERIFIED | — |

**Same-task (diagnostic):** originals-union 256 ms → integrated 252 ms —
**EQUIVALENT**. No material orchestration overhead detected. Not a speed claim.

**Live run:** Task Completion 0.75 IMPROVED; Unscanned Dependencies 0; one
material regression (Distinct Upstream Projects 5 vs 3).

## Release status at freeze — unchanged until external review returns

```
BUILD STATUS               CONDITIONAL
IMPROVEMENT VERDICT        REGRESSION (full-capability)
RELEASE READINESS          READY_WITH_KNOWN_TRADEOFFS
SHIP DECISION              SHIP_WITH_LIMITATIONS
INDEPENDENT CODEX REVIEW   NOT_RUN
```
