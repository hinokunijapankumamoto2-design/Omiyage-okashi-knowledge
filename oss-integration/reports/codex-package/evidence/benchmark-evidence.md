# Benchmark evidence

Only data that **exists** is recorded here. Where a statistic cannot be computed
from what was retained, it is marked `NOT_COMPUTABLE_FROM_AVAILABLE_DATA` rather
than derived, estimated or back-filled from an aggregate.

```
POLICY VERSION           v0.1.1
BASELINE (frozen, v0.1)  benchmark/baseline-v0.1.json
```

---

## Availability summary — read this first

```
PER_TASK_EVIDENCE        AVAILABLE
PER_SUBJECT_AGGREGATES   AVAILABLE
PHASE_PROFILE            AVAILABLE
RUBRIC_PER_CRITERION     AVAILABLE

PER_REPEAT_TIMINGS       NOT_AVAILABLE
MEAN                     NOT_COMPUTABLE_FROM_AVAILABLE_DATA
MEDIAN                   NOT_COMPUTABLE_FROM_AVAILABLE_DATA
VARIANCE                 NOT_COMPUTABLE_FROM_AVAILABLE_DATA
STDDEV                   NOT_COMPUTABLE_FROM_AVAILABLE_DATA
P50 / P95                NOT_COMPUTABLE_FROM_AVAILABLE_DATA
CONFIDENCE_INTERVAL      NOT_COMPUTABLE_FROM_AVAILABLE_DATA
```

**Why `MEDIAN` is `NOT_COMPUTABLE` even though a median was reported.** Runs use
`--repeats 3`. The harness computed a median internally and kept only that
single number; the three underlying values were discarded. So the reported
figure *is* a median, but it **cannot be recomputed or checked** from the
committed artifacts, and no other statistic can be derived from it. A single
retained aggregate does not yield a variance, and none is fabricated here.

Sample size: **n = 3**, one machine, one session. No dispersion statistic
retained. Platform metadata for the timing runs was not recorded.

---

## Metrics — synthetic run, full-capability, executed

Subjects: three fixtures, their union, and the integrated plugin.
Source file: `examples/frontend-plugin/frontend-quality-plugin/BENCHMARK_REPORT.md` § Results.

| METRIC | SUBJECT (best original / union / integrated) | RAW RESULT | MEASUREMENT METHOD | KNOWN LIMITATION |
| --- | --- | --- | --- | --- |
| Task Completion | 0.25 / 0.5 / 1.0 | fraction of 8 executable tasks passed | EXECUTED, real browser | 8 of 9 tasks executable; T7 has no executable implementation |
| Error Rate | 0 / 0 / 0 | errored ÷ attempted | EXECUTED | `null`, not 0, for a subject attempting nothing |
| Security Findings (high/critical) | 0 / 2 / 0 | count over required sources | static scan | absence of findings ≠ safety |
| Integration Debt | 3 / 6 / 0 | unresolved conflicts + duplicate implementations | counted | measures two specific things, not "maintainability" broadly |
| Install Actions | 1 / 4 / 2 | manual install steps | counted from declared deps | definition corrected mid-project — see `changedFromV01` |
| Distinct Upstream Projects | 1 / 3 / 5 | projects in the supply chain | counted from final stack | definition corrected mid-project |
| Task Coverage per Install Action | 0.25 / 0.125 / 0.5 | completion ÷ install actions | derived | inherits both inputs' limits |
| Unscanned Dependencies | 0 / 0 / 2 | sources with 0 artifacts scanned | counted | **0 under `--live`** — offline artefact |
| Output Quality | n/a / 1.0 / 1.0 | rubric over criteria BOTH subjects could evaluate | EXECUTED, rubric | scored only over shared criteria; definition corrected mid-project |
| Quality Criteria Covered | 3 / 4 / 7 | rubric criteria evaluable | counted | criteria are not equal in cost or value |
| Execution Time | 246 / 235 / 556 ms | wall clock per subject pass | EXECUTED, **median of 3, repeats discarded** | see availability summary |
| Reliability | 1.0 / 1.0 / 1.0 | tasks with identical outcome across 3 repeats | EXECUTED | outcome stability only; **says nothing about timing stability** |
| Time per Completed Task | 123 / 58.8 / 69.5 ms | execution time ÷ tasks completed | derived | inherits the timing limitation above |
| Time per Quality Criterion | 83.7 / 58.8 / 79.4 ms | execution time ÷ criteria covered | derived | as above |
| UX / Setup Time / Token Usage | — | `NOT_VERIFIED` | not measured for any subject | no proxy substituted |

## Same-task comparison (diagnostic mode)

Source: same file, § SAME-TASK comparison. Tasks restricted to those the union
can attempt (T1, T2, T3, T8); every subject's capabilities intersected with what
those tasks require.

| METRIC | best original / union / integrated | RAW RESULT | LIMITATION |
| --- | --- | --- | --- |
| Task Completion | 0.5 / 1.0 / 1.0 | fraction of 4 tasks | — |
| Execution Time | 234 / 256 / 252 ms | median of 3, **repeats discarded** | `PER_REPEAT_TIMINGS: NOT_AVAILABLE`, so whether 252 and 256 are distinguishable **cannot be determined from the artifacts** |
| Quality Criteria Covered | 1 / 4 / 4 | count | — |

**No interpretation of the 252 / 256 pair is offered here.** Decide
independently what, if anything, it supports.

## Per-task evidence — AVAILABLE

Source: same file, § Per-task outcomes. Each row records task id, status,
duration and the artifact fields that produced the result. Examples:

| TASK | SUBJECT | RAW RESULT | EVIDENCE FIELDS |
| --- | --- | --- | --- |
| T3 | integrated | passed | `shot:360x800=55785, shot:768x1024=72411, shot:1440x900=77600` (bytes) |
| T4 | integrated | passed | `violations=1, serious=1, rules=image-alt` |
| T6 | integrated | passed | `diffRatio=0` |
| T1 | integrated | passed | `cards=3, viewports=3, overflowViewports=0` |

Per-task **durations** are recorded but are dominated by the shared browser
pass, which is attributed to the subject as a whole rather than per task.

## Phase profile — AVAILABLE

Source: same file, § Execution profile. Aggregated across all measured passes
(all subjects, all repeats): phase name, total ms, percentage, call count.
Screenshots ≈48%, context creation ≈14%, axe inject+run ≈13%.

Browser launch, module loading and the axe-core source read are paid once in a
**discarded warm-up pass** and are charged to no subject. Whether that removes
an ordering effect or hides a real user-facing cost is a judgement call, not a
fact — see `ASSUMPTIONS.md` A30.

## Live run

Source: `examples/live-plugin/live-web-quality/BENCHMARK_REPORT.md`.
Task Completion 0.75; Unscanned Dependencies 0; Distinct Upstream Projects 5 vs
union 3. Baselines attempted **zero** tasks, so most live metrics have no
comparison and report `NOT_VERIFIED`.

## Symmetry checks worth performing directly

1. Is each metric computed by the **same rule** for every subject?
   `src/validation/subjects.ts`. Three definitions were corrected specifically
   because they were not — verify each correction in `changedFromV01`.
2. Is a subject that attempts nothing scored `0` or `null`? Confirm which per
   metric, and whether the choice flatters anyone.
3. Is the task set identical across subjects within a comparison mode?
4. Is `originals-union` a fair counterfactual, or one that flatters the
   integrated subject?

## Files

| Data | Path |
| --- | --- |
| Metric definitions, pre-registered | `data/benchmark-metrics.json` |
| Policy change record | `BENCHMARK_POLICY_v0.1.1.md` |
| Frozen v0.1 results | `benchmark/baseline-v0.1.json` |
| Synthetic run | `examples/frontend-plugin/frontend-quality-plugin/BENCHMARK_REPORT.md` |
| Live run | `examples/live-plugin/live-web-quality/BENCHMARK_REPORT.md` |
| Subject construction | `src/validation/subjects.ts` |
| Metric computation, verdict aggregation | `src/validation/benchmark.ts` |
| Execution harness | `src/validation/live-task-runner.ts` |
