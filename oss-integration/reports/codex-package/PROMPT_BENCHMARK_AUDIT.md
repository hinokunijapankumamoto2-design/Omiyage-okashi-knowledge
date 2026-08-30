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

## Evidence handed to you

Read these before forming a view. They separate what was observed from what was
concluded:

| File | What it is |
| --- | --- |
| `evidence/evidence-classification.md` | Facts, measured results, claims, assumptions and unknowns, kept apart |
| `evidence/claims-to-audit.md` | 11 claims to judge `SUPPORT` / `PARTIALLY_SUPPORT` / `REFUTE` / `NOT_VERIFIED` |
| `evidence/benchmark-evidence.md` | Where every raw measurement is — **and what was not retained** |
| `evidence/security-evidence.md` | Matched rules, files, excerpts, and the two rules deliberately narrowed |
| `evidence/license-evidence.md` | Per-repository licence file, detection, classification, conditions |
| `evidence/provenance-evidence.md` | The `Reused Code: None` method, its parameters and its stated limits |
| `EVIDENCE_MANIFEST.md` | Everything else, mapped to its real path |
| `FINDING_SCHEMA.md` | The output shape |

## Read-only review

**Do not modify, create or delete any file in this repository.** Your role is
`ANALYZE` · `CHALLENGE` · `FIND` · `REPORT`. Automatic fixes are out of scope:
every change is made later, by the author, only after independently reproducing
the finding.

If you would normally apply a patch, describe it under `RECOMMENDATION` instead.

**Baseline:** this review applies to commit `04fab5b51b62dbba03d744e50b03ee1ea1c80a33`. Record that SHA in your
output so reviewed source and later-fixed source are never confused.

## Finding format

Use the schema in `FINDING_SCHEMA.md` for every finding. Reporting **no
finding** in an area is a valid, useful result — say so rather than padding.
