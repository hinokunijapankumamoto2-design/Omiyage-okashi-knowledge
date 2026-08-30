# Raw benchmark data — where it is, and what is missing

Do not rely on the author's summary. Every raw measurement that exists is
pointed to below, and everything that was **not** retained is stated plainly so
you can weigh it.

## Where the raw numbers live

| Data | Location |
| --- | --- |
| Per-subject metric values, full-capability | `examples/*/*/BENCHMARK_REPORT.md` § Results |
| Per-subject metric values, same-task | same file, § SAME-TASK comparison |
| Per-task outcome, status, duration, evidence fields | same file, § Per-task outcomes |
| Phase profile: ms, %, call count, across all measured passes | same file, § Execution profile |
| Output Quality rubric, per criterion, per subject, with the artifact that produced each score | same file, § Output Quality rubric |
| Metric definitions, pre-registered, with `changedFromV01` where changed | `data/benchmark-metrics.json` |
| Frozen v0.1 results, never recomputed | `benchmark/baseline-v0.1.json` |
| Policy change record | `BENCHMARK_POLICY_v0.1.1.md` |
| Subject construction (this is where symmetry lives or dies) | `src/validation/subjects.ts` |
| Metric computation and verdict aggregation | `src/validation/benchmark.ts` |
| Execution harness | `src/validation/live-task-runner.ts` |

## What is NOT retained — audit these as gaps

| Missing | Consequence |
| --- | --- |
| **Per-repeat execution times.** Runs use `--repeats 3`, but only the **median** is kept. The three individual values are discarded. | **Variance, standard deviation, p95 and any confidence interval cannot be computed from the artifacts.** Any claim resting on run-to-run stability is therefore unverifiable from what was kept. |
| **Per-repeat task outcomes.** Only the first repeat's outcomes are reported; the others are used solely to compute the Reliability metric (fraction of tasks whose outcome was identical across repeats). | A task that flipped outcome would be visible only as `Reliability < 1.0`, not in the per-task table. |
| **Machine and environment metadata** for the timing runs. | Timings are not portable and are not claimed to be. |
| **Cold-start cost.** Measured in a discarded warm-up pass and charged to nobody. | Whether that removes an ordering effect or hides a real user-facing cost is a judgement call, not a fact. `ASSUMPTIONS.md` A30. |

## Sample size

`n = 3` repeats, one machine, median reported, **no dispersion statistic
retained**. Decide independently whether that supports:

- the direction of large differences (e.g. 235 ms vs 556 ms), and
- any conclusion about small differences (e.g. 252 ms vs 256 ms).

These are different questions and may deserve different answers.

## Symmetry checks worth doing yourself

1. Is each metric computed by the **same rule** for every subject?
   `src/validation/subjects.ts` — three definitions were corrected specifically
   because they were not.
2. Is the task set identical across subjects within a comparison mode?
3. Is a subject that attempts nothing scored `0` or `null`? Confirm which, and
   whether the choice flatters anyone.
4. Does the baseline set include the realistic alternative, and is that
   counterfactual fair?
