# Benchmark audit — hostile peer review

Audit this benchmark as a hostile peer reviewer. Assume it may be unsound.

Read `data/benchmark-metrics.json`, `BENCHMARK_POLICY_v0.1.1.md`,
`benchmark/baseline-v0.1.json`, `src/validation/` and the raw
`BENCHMARK_REPORT.md` in each generated plugin.

## Check

Metric definitions · materiality thresholds · warm-up handling · cold-start
handling · same-task fairness · full-capability fairness · normalization
formulas · task equivalence · sample size · variance · p50/p95 where available ·
baseline selection · missing metrics · metric direction · metric naming ·
verdict aggregation · regression classification.

## Specific things to decide for yourself

1. **The same-task execution-time figures.** Read the raw numbers from the
   report. Decide independently what they support. State explicitly whether the
   sample size and variance justify *any* directional conclusion, or only
   "indistinguishable". **No interpretation is supplied here on purpose.**
2. **The `originals-union` baseline.** Is comparing cost against "install all
   the originals" a fair counterfactual, or a rigged one that makes the
   integrated plugin look cheap? Argue it either way from the data.
3. **The warm-up pass.** Cold start is measured in a discarded pass. Does that
   remove an order effect, or hide a real user-facing cost? Both readings are
   available — pick one and justify it.
4. **The three mid-project definition changes** (`install-actions`,
   `upstream-projects`, `output-quality`). Each `changedFromV01` entry claims to
   fix a measurement defect rather than a preference. Verify or refute each
   independently.
5. **Sample size.** n=3 repeats, one machine, no p95 reported. State plainly
   whether that supports the conclusions drawn, and which conclusions it does
   not support.

## Required output

Identify **any** metric that could make the integrated plugin look artificially
better **or** artificially worse. Both directions. For each, say whether the
distortion is material to a release decision.
