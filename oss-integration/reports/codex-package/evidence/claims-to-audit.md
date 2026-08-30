# Claims to audit

**These are claims, not premises.** Each is an interpretation the author drew
from the artifacts. Your task is to decide, independently, whether the artifacts
support it.

For each claim return exactly one verdict:

| Verdict | Meaning |
| --- | --- |
| `SUPPORT` | The artifacts support the claim as stated. |
| `PARTIALLY_SUPPORT` | Supported in part; state precisely which part fails and why. |
| `REFUTE` | The artifacts contradict the claim. |
| `NOT_VERIFIED` | The artifacts are insufficient to decide. Say what would settle it. |

`NOT_VERIFIED` is a legitimate and expected outcome. Do not force a verdict the
evidence does not carry, in either direction.

---

### CLAIM 1 — The capability decomposition matches the stated goal

Goal: `Claude Codeで最高品質のWebサイトを作れるPluginを作って`.
Where to look: `src/goal/engine.ts`, `data/capability-registry.json`
(`goalArchetypes`), `tests/goal-cases.test.ts`, each build's
`INTEGRATION_REPORT.md` § 1.

### CLAIM 2 — Selected capabilities are actually supported by source evidence

Where to look: `src/capability/extractor.ts`, `src/evidence/engine.ts`, the
`evidence` and `confidence` columns in each `INTEGRATION_REPORT.md` § 8, and
`LIVE_REPOSITORY_REPORT.md` for what was actually fetched.

### CLAIM 3 — Hard gates correctly distinguish unsafe from uncertain sources

Where to look: `src/security/gate.ts`, `src/license/gate.ts`, each
`SECURITY_REPORT.md`, and `SECURITY_EVIDENCE.md` in this package. Note that
`UNKNOWN` and `BLOCK` are intended to be different outcomes — check whether the
code and reports actually keep them apart.

### CLAIM 4 — The generated plugin reduces integration debt

Where to look: `src/compatibility/detector.ts`, `src/integration/architect.ts`,
the `Integration Debt` metric definition in `data/benchmark-metrics.json`, and
its values in each `BENCHMARK_REPORT.md`. Audit whether the metric measures what
its name says.

### CLAIM 5 — Same-task integration overhead is not materially worse than the comparison subjects

Where to look: `BENCHMARK_REPORT.md` § SAME-TASK comparison; the capability
intersection logic in `src/cli.ts`; `RAW_BENCHMARK_DATA.md` for what raw data
exists and what does not. **Decide for yourself whether the sample supports any
directional conclusion at all.**

### CLAIM 6 — Full-capability regressions are caused by additional work rather than architectural waste

Where to look: `BENCHMARK_REPORT.md` § Execution profile, § Results;
`src/validation/live-task-runner.ts` for what is gated on which capability.

### CLAIM 7 — Original contributions have measurable value

Where to look: `ORIGINAL_CONTRIBUTIONS.md`, `tests/ablation.test.ts`.
**Audit the ablation harness itself before trusting its result** — could it pass
for a component that does nothing?

### CLAIM 8 — `Reused Code: None` is supported by artifact evidence

Where to look: `tests/provenance-audit.test.ts`, `PROVENANCE_EVIDENCE.md` in
this package, each plugin's `PROVENANCE.md`. Critique the *methodology*, not
only its result.

### CLAIM 9 — Synthetic evidence is never presented as live evidence

Where to look: `examples/frontend-plugin/README.md` (synthetic),
`examples/live-plugin/README.md` (live), `LIVE_REPOSITORY_REPORT.md`
classification table, and every superlative in `README.md` / `README.ja.md`.
`fixture-org` is not a real organisation — check that nothing states or implies
otherwise anywhere.

### CLAIM 10 — The current benchmark policy compares subjects fairly

Where to look: `data/benchmark-metrics.json`, `BENCHMARK_POLICY_v0.1.1.md`,
`benchmark/baseline-v0.1.json`, `src/validation/benchmark.ts`,
`src/validation/subjects.ts`. Three definitions were changed mid-project, each
recorded as a defect fix rather than a preference — verify or refute each.

### CLAIM 11 — The available benchmark evidence is sufficient to support the current performance interpretation

This claim is about the **evidence base itself**, not about performance.

`evidence/benchmark-evidence.md` records that per-repeat timings were
**discarded** — only a single median was retained per subject. It therefore
states `MEAN`, `MEDIAN`, `VARIANCE`, `STDDEV`, `P50/P95` and
`CONFIDENCE_INTERVAL` as `NOT_COMPUTABLE_FROM_AVAILABLE_DATA`, and n = 3 on one
machine with no platform metadata.

Judge whether what was retained is sufficient to support the performance
conclusions drawn from it. Consider separately:

- large differences (e.g. 235 ms vs 556 ms), and
- small differences (e.g. 252 ms vs 256 ms).

They may deserve different verdicts. If the evidence is insufficient for either,
say so — and say what would have to be retained to settle it.

Where to look: `evidence/benchmark-evidence.md`,
`src/validation/live-task-runner.ts` (`runRealTaskSuite`, where repeats are
reduced to a median), each build's `BENCHMARK_REPORT.md`.

