# Benchmark Policy v0.1.1

Supersedes **v0.1** for runs labelled `BENCHMARK_POLICY_VERSION: v0.1.1`.
It does **not** rewrite v0.1 results. `benchmark/baseline-v0.1.json` is frozen
and stays the reference for what v0.1 measured.

## Why a new version rather than an edit

The v0.1 round ended with two material regressions, `Distinct Upstream Projects`
and `Execution Time`, pre-registered as material before measurement. Editing the
policy afterwards to make either disappear would be exactly the manipulation the
project forbids. So v0.1's verdict stands as recorded, and everything below is
**additive**.

## WHAT CHANGED

### 1. Comparison mode is now explicit: SAME-TASK and FULL-CAPABILITY

v0.1 reported one comparison and did not say which it was. It was
FULL-CAPABILITY: each subject did everything its capabilities allowed, so the
integrated plugin's `Execution Time` included accessibility auditing and visual
regression that no baseline can perform at all. That is a real number, but it
answers "what does each subject cost when doing all it can", not "is the
integrated plugin slower at the same job".

v0.1.1 reports both, separately and never blended:

| Mode | Task set | Capability set | Answers |
| --- | --- | --- | --- |
| **FULL-CAPABILITY** | every executable task | everything the subject holds | What does each subject cost doing all it can? |
| **SAME-TASK** | the tasks the realistic alternative (`originals-union`) can attempt | each subject's capabilities **intersected** with those the shared task set requires | Is the integrated plugin slower at identical work? |

FULL-CAPABILITY remains the headline. SAME-TASK is diagnostic.

### 2. Normalized performance metrics ADDED, raw metrics KEPT

Raw `Execution Time` is unchanged, still counts toward the verdict, and still
carries its regression. Added alongside it:

| Name | Formula | Why it matters | Direction | Limitation |
| --- | --- | --- | --- | --- |
| Execution Time per Completed Task | `execution-time / (task-completion × task count)` | Separates "slower" from "doing more". | lower-is-better | Undefined when a subject completes nothing; reported `n/a`, never 0. |
| Execution Time per Quality Criterion | `execution-time / quality-criteria-covered` | Cost of each question the subject can actually answer about the page. | lower-is-better | Criteria are not equal in value or cost. |

Neither replaces the raw metric. A subject that regressed on raw time still
regresses on raw time.

### 3. `SUPPLY_CHAIN_COST` added as a composite; `Distinct Upstream Projects` KEPT

Project count alone does not express supply-chain risk — five small, licence-
clean, security-scanned dependencies can be safer than one large unscanned one.
The composite reports its inputs rather than collapsing them into one number
that hides them:

```
Distinct Upstream Projects
Direct Dependencies
Unscanned Dependencies        <- the one that actually carries risk
Security Gate: non-PASS count
Licence Gate: non-permissive count
Capability Coverage per Upstream
```

`Distinct Upstream Projects` keeps its own verdict and its own materiality. The
composite is additional evidence, not a replacement.

## EFFECT ON OLD RESULTS

None. v0.1 numbers are frozen in `benchmark/baseline-v0.1.json` and are not
recomputed. v0.1.1 results are reported separately and labelled.

## CAN IT FAVOR THE INTEGRATED PLUGIN?

Yes, and this must be stated plainly:

- **SAME-TASK** is expected to favour the integrated plugin on `Execution Time`,
  because it removes work the baselines cannot do. That is the point of the
  mode — and it is why it is **diagnostic, not the headline**.
- **Normalized time metrics** favour a subject that does more per unit time.
- **`SUPPLY_CHAIN_COST`** may favour the integrated plugin, whose dependencies
  are all licence-clean and security-scanned, over a baseline with unscanned
  ones.

## CAN IT HURT THE INTEGRATED PLUGIN?

Yes:

- **SAME-TASK** would expose the integrated plugin as *genuinely* slower if it
  carried orchestration overhead, because the work is then identical. If it
  regresses here, the "it just does more" defence is dead.
- **`Unscanned Dependencies`** counts every source the plugin pulls in but did
  not scan, and the integrated plugin pulls in more sources than any baseline.
- Raw `Execution Time` and `Distinct Upstream Projects` are untouched and still
  carry their material regressions into the verdict.

## What v0.1.1 does NOT do

- It does not remove a metric, relax a threshold, change a direction, or move a
  regression out of the verdict.
- It does not recompute v0.1.
- It does not change the pre-registered materiality rule.
