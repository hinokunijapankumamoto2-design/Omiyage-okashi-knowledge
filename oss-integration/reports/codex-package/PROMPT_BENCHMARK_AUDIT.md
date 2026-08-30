Audit this benchmark as a hostile peer reviewer. Read
`data/benchmark-metrics.json`, `BENCHMARK_POLICY_v0.1.1.md`,
`benchmark/baseline-v0.1.json` and `src/validation/`.

Check: metric definitions; materiality thresholds; warm-up fairness;
cold-start handling; same-task fairness; full-capability fairness;
normalization formulas; task equivalence; sample size; variance; p50/p95;
baseline selection; missing metrics; metric direction; metric naming;
verdict aggregation; regression classification.

Identify ANY metric that could make the integrated plugin look artificially
better OR artificially worse. Three definitions were changed mid-project
(`install-actions`, `upstream-projects`, `output-quality`), each claiming to fix
a measurement defect rather than a preference — verify that claim or refute it.

Note explicitly: n=3 repeats, single machine, no p95 reported. Say whether that
is sufficient for the conclusions drawn.
