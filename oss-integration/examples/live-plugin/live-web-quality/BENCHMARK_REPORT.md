# BENCHMARK REPORT

Metric definitions were **pre-registered** in `data/benchmark-metrics.json` on
2026-08-30 (version 0.2.0), before any implementation change
or re-measurement in this round. This file reads them; it does not restate them,
so a definition cannot drift from the code that computes it.

## Materiality rule

A regression is MATERIAL if it degrades the user's ability to achieve the stated goal, or degrades safety or legality. A regression in a COST metric is material only if the integrated subject's cost exceeds the cost of the realistic alternative — installing the original plugins that together cover the same tasks (the `originals-union` subject).

**Why it exists:** Rule 20 makes PASS depend on there being no MATERIAL regression, and rule 21 makes the overall benchmark verdict depend on any regression at all. These are two different questions, so materiality is recorded separately from the verdict and never removes a metric from it.

**Applies to:** final STATUS only. Every measured metric counts toward the benchmark OVERALL verdict regardless of materiality.

## Subjects

- `dequelabs/axe-core` — 1 capabilities, 1 install action(s), 1 project(s) in the supply chain
- `americanexpress/jest-image-snapshot` — 2 capabilities, 1 install action(s), 1 project(s) in the supply chain
- `GoogleChrome/lighthouse` — 2 capabilities, 2 install action(s) (external runtimes: chromium-browser-binaries), 1 project(s) in the supply chain
- `originals-union` — 4 capabilities, 4 install action(s) (external runtimes: chromium-browser-binaries), 3 project(s) in the supply chain
- `live-web-quality` — 8 capabilities, 2 install action(s) (external runtimes: chromium-browser-binaries), 5 project(s) in the supply chain

## Tasks (8)

- `T1` Build a responsive landing page from a brief — requires: frontend-implementation, responsive-design
- `T2` Critique the visual design of an existing page — requires: visual-design
- `T3` Capture the page at three viewports — requires: browser-automation, screenshot-capture
- `T4` Report WCAG violations on a live page — requires: browser-automation, accessibility-audit
- `T5` Report loading performance metrics — requires: browser-automation, performance-audit
- `T6` Detect unintended visual change against a baseline — requires: browser-automation, screenshot-capture, image-comparison, visual-regression
- `T8` Run the end-to-end test suite — requires: testing
- `T9` Give an evidence-backed verdict on whether the page is ready to ship — requires: visual-review, accessibility-audit, performance-audit

Executed against a real page in a real browser at http://127.0.0.1:33359/, 3 repeat(s). Each subject gets its own browser pass performing only the collection its capabilities imply, so Execution Time is that subject's own cost rather than a shared figure.

**Excluded from this run (1):** `T7` Review the diff for correctness and convention — no executable implementation exists for them against a rendered page, so scoring any subject on them would deflate every result equally and measure nothing.

## Results

| Metric | Direction | dequelabs/axe-core | americanexpress/jest-image-snapshot | GoogleChrome/lighthouse | originals-union | live-web-quality | Verdict | Material? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Task Completion | ↑ better | 0 | 0 | 0 | 0 | 0.75 | IMPROVED | — |
| Error Rate | ↓ better | n/a | n/a | n/a | n/a | 0 | NOT_VERIFIED | — |
| Security Findings (high/critical) | ↓ better | 1 | 0 | 0 | 1 | 0 | EQUIVALENT | — |
| Integration Debt | ↓ better | 0 | 0 | 0 | 1 | 0 | EQUIVALENT | — |
| Install Actions | ↓ better | 1 | 1 | 2 | 4 | 2 | REGRESSION | no |
| Distinct Upstream Projects | ↓ better | 1 | 1 | 1 | 3 | 5 | REGRESSION | **YES** |
| Task Coverage per Install Action | ↑ better | 0 | 0 | 0 | 0 | 0.375 | IMPROVED | — |
| Unscanned Dependencies | ↓ better | 0 | 0 | 0 | 0 | 0 | EQUIVALENT | — |
| Output Quality | ↑ better | n/a | n/a | n/a | n/a | 0.833 | NOT_VERIFIED | — |
| Quality Criteria Covered | ↑ better | 0 | 0 | 0 | 0 | 6 | IMPROVED | — |
| Execution Time | ↓ better | n/a | n/a | n/a | n/a | 578 | NOT_VERIFIED | — |
| Reliability | ↑ better | n/a | n/a | n/a | n/a | 1 | NOT_VERIFIED | — |
| Execution Time per Completed Task | ↓ better | n/a | n/a | n/a | n/a | 96.333 | NOT_VERIFIED | — |
| Execution Time per Quality Criterion | ↓ better | n/a | n/a | n/a | n/a | 96.333 | NOT_VERIFIED | — |
| UX | not measured | n/a | n/a | n/a | n/a | n/a | NOT_VERIFIED (no verdict) | — |
| Setup Time | not measured | n/a | n/a | n/a | n/a | n/a | NOT_VERIFIED (no verdict) | — |
| Token Usage | not measured | n/a | n/a | n/a | n/a | n/a | NOT_VERIFIED (no verdict) | — |

> **Install Actions regressed.** Not material: 2 is better than the realistic alternative (originals-union = 4). It regresses only against the single cheapest original, which cannot do the same work.

> **Distinct Upstream Projects regressed.** MATERIAL: 5 is worse than the realistic alternative (originals-union = 3), so integrating costs more than what it replaces.

**Overall: REGRESSION**

REGRESSION DETECTED on: Install Actions, Distinct Upstream Projects. Rule 21: the overall verdict is REGRESSION whenever any measured metric regresses, whether or not that regression is material.

## SAME-TASK comparison (diagnostic)

_Not computed: the suite was not executed, or the realistic alternative could attempt no task._

## Metric definitions and results

### Task Completion

| Field | Value |
| --- | --- |
| **Definition** | Fraction of the benchmark tasks the subject can complete, where a task is completable only if the subject holds every capability the task requires. |
| **Formula** | `count(tasks where requires ⊆ subject.capabilities) / count(tasks)` |
| **Direction** | higher-is-better |
| **Measurement method** | STATIC: capability-set containment. In the live-task suite this is replaced by EXECUTED: the task is actually run and its assertions checked. |
| **Counts toward verdict** | yes |
| **Material?** | yes — It is the goal itself. A subject that completes fewer tasks is worse at what the user asked for. |
| **Results** | dequelabs/axe-core=0, americanexpress/jest-image-snapshot=0, GoogleChrome/lighthouse=0, originals-union=0, live-web-quality=0.75 |
| **Verdict** | IMPROVED |
| **Confidence** | medium — capability-set arithmetic, not execution |


### Error Rate

| Field | Value |
| --- | --- |
| **Definition** | Of the tasks a subject can complete, the fraction that depend on at least one capability whose hard gates did not come back clean (security not PASS, or licence LEGAL_REVIEW/BLOCK). |
| **Formula** | `count(completable tasks touching a gate-degraded capability) / count(completable tasks)` |
| **Direction** | lower-is-better |
| **Measurement method** | STATIC: derived from the per-capability gate results recorded at selection time. In the live-task suite this is replaced by EXECUTED: fraction of attempted tasks that threw, timed out, or failed their assertions. |
| **Counts toward verdict** | yes |
| **Material?** | yes — A result that cannot be trusted is not a result. This directly degrades goal achievement. |
| **Results** | dequelabs/axe-core=n/a, americanexpress/jest-image-snapshot=n/a, GoogleChrome/lighthouse=n/a, originals-union=n/a, live-web-quality=0 |
| **Verdict** | NOT_VERIFIED |
| **Confidence** | medium — capability-set arithmetic, not execution |


### Security Findings (high/critical)

| Field | Value |
| --- | --- |
| **Definition** | Count of high- or critical-severity findings from the security gate, across every source the subject requires. |
| **Formula** | `sum over required sources of count(findings where severity ∈ {high, critical})` |
| **Direction** | lower-is-better |
| **Measurement method** | Static pattern scan over artifacts that were actually fetched. A source with no fetched artifact contributes 0 findings but is separately reported as UNSCANNED — absence of findings is not evidence of safety. |
| **Counts toward verdict** | yes |
| **Material?** | yes — Safety. |
| **Results** | dequelabs/axe-core=1, americanexpress/jest-image-snapshot=0, GoogleChrome/lighthouse=0, originals-union=1, live-web-quality=0 |
| **Verdict** | EQUIVALENT |
| **Confidence** | medium |


### Integration Debt

| Field | Value |
| --- | --- |
| **Definition** | Count of things a maintainer would still have to reconcile by hand: conflicts that were detected but not resolved, plus any capability supplied by more than one implementation in the same subject. |
| **Formula** | `count(unresolved conflicts) + count(duplicate implementations of one capability)` |
| **Direction** | lower-is-better |
| **Measurement method** | Counted from the conflict detector and the final stack. |
| **Counts toward verdict** | yes |
| **Material?** | yes — It is unfinished work handed to the user. |
| **Results** | dequelabs/axe-core=0, americanexpress/jest-image-snapshot=0, GoogleChrome/lighthouse=0, originals-union=1, live-web-quality=0 |
| **Verdict** | EQUIVALENT |
| **Confidence** | medium |
| **Changed from v0.1** | **RENAMED ONLY. The formula and the numbers are identical.** Was: Maintainability. Why: "Maintainability" implied a broad quality judgement the number does not support — it counts two specific unreconciled things. The old name invited the reader to conclude more than was measured. Renaming to what is actually counted removes that. No value changed. |

### Install Actions

| Field | Value |
| --- | --- |
| **Definition** | Number of distinct install steps a user must perform to obtain the subject's capabilities: one per package they install by hand, plus one per external runtime that needs its own separate install step (for example browser binaries). Transitive library dependencies resolved automatically by the package manager are NOT counted, because the user does not perform them. |
| **Formula** | `1 (the subject package) + count(distinct external runtimes requiring a separate manual install step across the subject's required sources)` |
| **Direction** | lower-is-better |
| **Measurement method** | Counted from declared dependencies of every source the subject requires. |
| **Counts toward verdict** | yes |
| **Material?** | no — A one-time setup cost, not a property of goal achievement — UNLESS it exceeds the `originals-union` cost, per the materiality rule above, at which point integration is costing more than the alternative it replaces. |
| **Results** | dequelabs/axe-core=1, americanexpress/jest-image-snapshot=1, GoogleChrome/lighthouse=2, originals-union=4, live-web-quality=2 |
| **Verdict** | REGRESSION |
| **Confidence** | medium |
| **Changed from v0.1** | **DEFECT FIX. The v0.1 implementation measured the two kinds of subject differently: originals were charged only for themselves while their own runtime dependencies were ignored, and the integrated plugin was charged for every upstream. That is an asymmetric measurement, not a definition preference.** Was: Install Sources = 1 for every original, but 1 + count(upstream sources) for the integrated plugin.. Why: Rule 22 forbids changing a definition to pass a benchmark. It does not require preserving an implementation that measured different subjects by different rules. The corrected definition is applied identically to every subject, the raw upstream count is still reported separately as `upstream-projects`, and both count toward the verdict. |

### Distinct Upstream Projects

| Field | Value |
| --- | --- |
| **Definition** | Number of distinct third-party projects whose code must be present at runtime for the subject's capabilities to work, counting every project involved including the subject's own package(s). |
| **Formula** | `count(distinct projects: the subject's own package(s) ∪ the source repositories its capabilities come from)` |
| **Direction** | lower-is-better |
| **Measurement method** | Counted from the final stack. |
| **Counts toward verdict** | yes |
| **Material?** | no — A supply-chain surface measure. It is reported and counted so that the Install Actions correction cannot hide the fact that the integrated plugin does draw on more projects. |
| **Results** | dequelabs/axe-core=1, americanexpress/jest-image-snapshot=1, GoogleChrome/lighthouse=1, originals-union=3, live-web-quality=5 |
| **Verdict** | REGRESSION |
| **Confidence** | medium |
| **Changed from v0.1** | **DEFECT FIX (ambiguity, not a threshold change). The phrase 'excluding the subject itself' has no meaning for the composite `originals-union` subject, whose 'self' is three projects. Read literally it scored the union 0 and a single original 0, while scoring the integrated plugin by a different rule — the same asymmetry corrected in `install-actions`.** Was: count(distinct source repositories the subject's capabilities come from, EXCLUDING the subject itself). Why: The corrected definition names one rule that applies to every subject. It makes the integrated plugin's number LARGER, not smaller: it now carries its own package plus every upstream. This correction works against the integrated subject, which is how you can tell it was not made to pass a benchmark. |

### Task Coverage per Install Action

| Field | Value |
| --- | --- |
| **Definition** | Task Completion divided by Install Actions: how much capability each install step buys. |
| **Formula** | `task-completion / install-actions` |
| **Direction** | higher-is-better |
| **Measurement method** | Derived from the two metrics above. |
| **Counts toward verdict** | yes |
| **Material?** | no — An efficiency ratio, subject to the same cost-materiality threshold as Install Actions. |
| **Results** | dequelabs/axe-core=0, americanexpress/jest-image-snapshot=0, GoogleChrome/lighthouse=0, originals-union=0, live-web-quality=0.375 |
| **Verdict** | IMPROVED |
| **Confidence** | medium |


### Output Quality

| Field | Value |
| --- | --- |
| **Definition** | Rubric score computed over the criteria that BOTH the integrated subject and the realistic alternative (`originals-union`) were able to evaluate, so the two are scored on the same questions. A subject that could not evaluate all of those criteria reports n/a rather than a score over a smaller set. |
| **Formula** | `sum(criterion scores over the common evaluated criteria) / sum(max over those criteria)` |
| **Direction** | higher-is-better |
| **Measurement method** | EXECUTED against a real page. Each criterion cites the artifact that produced its score. A criterion no subject could evaluate, or that only some subjects could evaluate, is excluded from the composite and reported separately under `quality-criteria-covered`. |
| **Counts toward verdict** | yes |
| **Material?** | yes — The user asked for a high-quality result. |
| **Results** | dequelabs/axe-core=n/a, americanexpress/jest-image-snapshot=n/a, GoogleChrome/lighthouse=n/a, originals-union=n/a, live-web-quality=0.833 |
| **Verdict** | NOT_VERIFIED |
| **Confidence** | high — produced by executing the task against a real page |
| **Changed from v0.1** | **DEFECT FIX (comparability). Scoring each subject over its OWN criterion subset compares different questions and produces a perverse result: a subject that can check accessibility and finds a real page defect scores LOWER than a subject that cannot check accessibility at all. That measures blindness, not quality.** Was: Rubric score over the criteria each subject could evaluate individually, with unevaluable criteria excluded from that subject's own denominator.. Why: The composite is now computed over the criteria every compared subject could evaluate, so the comparison is like-for-like. Breadth is not discarded — it moves to `quality-criteria-covered`, a metric of its own that counts toward the verdict, and every per-criterion score remains printed in full in BENCHMARK_REPORT.md. |

### Quality Criteria Covered

| Field | Value |
| --- | --- |
| **Definition** | Number of Output Quality rubric criteria the subject was able to evaluate at all, from evidence it produced itself. |
| **Formula** | `count(rubric criteria with a non-null score)` |
| **Direction** | higher-is-better |
| **Measurement method** | EXECUTED. A criterion counts only when the subject held the capability and the check actually ran. |
| **Counts toward verdict** | yes |
| **Material?** | yes — Being unable to check something is not the same as it being fine. A subject that can evaluate fewer criteria tells the user less about their page, which directly degrades goal achievement. |
| **Results** | dequelabs/axe-core=0, americanexpress/jest-image-snapshot=0, GoogleChrome/lighthouse=0, originals-union=0, live-web-quality=6 |
| **Verdict** | IMPROVED |
| **Confidence** | high — produced by executing the task against a real page |


### Execution Time

| Field | Value |
| --- | --- |
| **Definition** | Wall-clock milliseconds to execute the task suite. |
| **Formula** | `sum of per-task wall-clock durations` |
| **Direction** | lower-is-better |
| **Measurement method** | EXECUTED. Measured on one machine in one session; treat as indicative, not as a portable figure. |
| **Counts toward verdict** | yes |
| **Material?** | no — A cost metric under the same threshold rule. |
| **Results** | dequelabs/axe-core=n/a, americanexpress/jest-image-snapshot=n/a, GoogleChrome/lighthouse=n/a, originals-union=n/a, live-web-quality=578 |
| **Verdict** | NOT_VERIFIED |
| **Confidence** | high — produced by executing the task against a real page |


### Execution Time per Completed Task

| Field | Value |
| --- | --- |
| **Definition** | Wall-clock milliseconds divided by the number of tasks the subject actually completed. |
| **Formula** | `execution-time / (task-completion x task count)` |
| **Direction** | lower-is-better |
| **Measurement method** | EXECUTED. Derived from two measured metrics. Undefined when a subject completes nothing, and reported n/a rather than 0 in that case. |
| **Counts toward verdict** | yes |
| **Material?** | no — A cost-efficiency ratio under the same threshold rule. ADDED beside raw Execution Time, which keeps its own verdict and its own materiality. |
| **Results** | dequelabs/axe-core=n/a, americanexpress/jest-image-snapshot=n/a, GoogleChrome/lighthouse=n/a, originals-union=n/a, live-web-quality=96.333 |
| **Verdict** | NOT_VERIFIED |
| **Confidence** | high — produced by executing the task against a real page |


### Execution Time per Quality Criterion

| Field | Value |
| --- | --- |
| **Definition** | Wall-clock milliseconds divided by the number of Output Quality criteria the subject could actually evaluate. |
| **Formula** | `execution-time / quality-criteria-covered` |
| **Direction** | lower-is-better |
| **Measurement method** | EXECUTED. Derived from two measured metrics. Undefined when a subject evaluates no criterion. |
| **Counts toward verdict** | yes |
| **Material?** | no — A cost-efficiency ratio. Criteria are not equal in cost or value, so this is indicative rather than precise. |
| **Results** | dequelabs/axe-core=n/a, americanexpress/jest-image-snapshot=n/a, GoogleChrome/lighthouse=n/a, originals-union=n/a, live-web-quality=96.333 |
| **Verdict** | NOT_VERIFIED |
| **Confidence** | high — produced by executing the task against a real page |


### Reliability

| Field | Value |
| --- | --- |
| **Definition** | Variance in task outcome across repeated identical runs. |
| **Formula** | `count(tasks with an identical outcome across all repeats) / count(tasks)` |
| **Direction** | higher-is-better |
| **Measurement method** | EXECUTED: the suite is run N times and outcomes compared. With N=1 this is NOT_VERIFIED. |
| **Counts toward verdict** | yes |
| **Material?** | yes — An unreliable result is not usable. |
| **Results** | dequelabs/axe-core=n/a, americanexpress/jest-image-snapshot=n/a, GoogleChrome/lighthouse=n/a, originals-union=n/a, live-web-quality=1 |
| **Verdict** | NOT_VERIFIED |
| **Confidence** | high — produced by executing the task against a real page |


### UX

| Field | Value |
| --- | --- |
| **Definition** | Quality of the interaction for a human operator. |
| **Formula** | `n/a` |
| **Direction** | higher-is-better |
| **Measurement method** | NOT MEASURABLE in this project. It needs human subjects, which are not available. It stays NOT_VERIFIED and no proxy is substituted. |
| **Counts toward verdict** | no — Never measured, by any subject, so there is nothing to compare. This is not the exclusion of an unfavourable result — no result exists. Rule 22 forbids excluding a REGRESSION; a metric with no measurement for any subject has no verdict to exclude. |
| **Material?** | no — Not measured, so it cannot be material either way. |
| **Results** | dequelabs/axe-core=n/a, americanexpress/jest-image-snapshot=n/a, GoogleChrome/lighthouse=n/a, originals-union=n/a, live-web-quality=n/a |
| **Verdict** | NOT_VERIFIED |
| **Confidence** | none — not measured |


### Setup Time

| Field | Value |
| --- | --- |
| **Definition** | Wall-clock time for a user to get the subject working from nothing. |
| **Formula** | `n/a` |
| **Direction** | lower-is-better |
| **Measurement method** | NOT MEASURED. Install Actions is reported as a separate measured metric in its own right; it is NOT presented as a measurement of setup time. |
| **Counts toward verdict** | no — Never measured for any subject. |
| **Material?** | no — Not measured. |
| **Results** | dequelabs/axe-core=n/a, americanexpress/jest-image-snapshot=n/a, GoogleChrome/lighthouse=n/a, originals-union=n/a, live-web-quality=n/a |
| **Verdict** | NOT_VERIFIED |
| **Confidence** | none — not measured |


### Token Usage

| Field | Value |
| --- | --- |
| **Definition** | Model tokens consumed to complete the task suite. |
| **Formula** | `sum of prompt + completion tokens` |
| **Direction** | lower-is-better |
| **Measurement method** | NOT MEASURED. The task suite is executed as deterministic code, not through a model, so no token accounting exists. Estimating it would be a fabrication. |
| **Counts toward verdict** | no — Never measured for any subject. |
| **Material?** | no — Not measured. |
| **Results** | dequelabs/axe-core=n/a, americanexpress/jest-image-snapshot=n/a, GoogleChrome/lighthouse=n/a, originals-union=n/a, live-web-quality=n/a |
| **Verdict** | NOT_VERIFIED |
| **Confidence** | none — not measured |


### Unscanned Dependencies

| Field | Value |
| --- | --- |
| **Definition** | Number of sources the subject depends on for which no artifact was available to scan, so their security gate is UNKNOWN. |
| **Formula** | `count(required sources with 0 scanned artifacts)` |
| **Direction** | lower-is-better |
| **Measurement method** | Counted from the security gate results. This is the component of supply-chain risk that actually carries risk: an unscanned dependency is not a safe one, it is an unknown one. |
| **Counts toward verdict** | yes |
| **Material?** | yes — An unknown dependency is a security exposure, and the project's own rule is that UNKNOWN is never PASS. |
| **Results** | dequelabs/axe-core=0, americanexpress/jest-image-snapshot=0, GoogleChrome/lighthouse=0, originals-union=0, live-web-quality=0 |
| **Verdict** | EQUIVALENT |
| **Confidence** | medium |


## Output Quality rubric

0 = fails, 1 = partially meets, 2 = fully meets. NOT_VERIFIED criteria are excluded from both numerator and denominator.

#### dequelabs/axe-core

| Criterion | Score | Evidence |
| --- | --- | --- |
| Requirement Satisfaction | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Visual Consistency | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Responsive Behavior | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Accessibility | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Functional Correctness | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Visual Regression | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Performance | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Code Quality | NOT_VERIFIED | NOT_VERIFIED — this suite exercises a rendered page, not a codebase under review. No evidence exists for this criterion. |

#### americanexpress/jest-image-snapshot

| Criterion | Score | Evidence |
| --- | --- | --- |
| Requirement Satisfaction | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Visual Consistency | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Responsive Behavior | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Accessibility | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Functional Correctness | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Visual Regression | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Performance | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Code Quality | NOT_VERIFIED | NOT_VERIFIED — this suite exercises a rendered page, not a codebase under review. No evidence exists for this criterion. |

#### GoogleChrome/lighthouse

| Criterion | Score | Evidence |
| --- | --- | --- |
| Requirement Satisfaction | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Visual Consistency | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Responsive Behavior | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Accessibility | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Functional Correctness | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Visual Regression | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Performance | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Code Quality | NOT_VERIFIED | NOT_VERIFIED — this suite exercises a rendered page, not a codebase under review. No evidence exists for this criterion. |

#### originals-union

| Criterion | Score | Evidence |
| --- | --- | --- |
| Requirement Satisfaction | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Visual Consistency | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Responsive Behavior | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Accessibility | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Functional Correctness | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Visual Regression | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Performance | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Code Quality | NOT_VERIFIED | NOT_VERIFIED — this suite exercises a rendered page, not a codebase under review. No evidence exists for this criterion. |

#### live-web-quality

| Criterion | Score | Evidence |
| --- | --- | --- |
| Requirement Satisfaction | 2 / 2 | DOM assertions passed (cta present, 3 cards). |
| Visual Consistency | 2 / 2 | 3 screenshots captured across 3 viewports. |
| Responsive Behavior | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Accessibility | 0 / 2 | axe-core: 1 violation(s), 1 serious/critical (image-alt). |
| Functional Correctness | 2 / 2 | cta present: true, cards: 3. |
| Visual Regression | 2 / 2 | pixel diff ratio 0. |
| Performance | 2 / 2 | load 19ms, DOMContentLoaded 17ms. |
| Code Quality | NOT_VERIFIED | NOT_VERIFIED — this suite exercises a rendered page, not a codebase under review. No evidence exists for this criterion. |

## Per-task outcomes

#### dequelabs/axe-core

| Task | Outcome | Time | Detail | Evidence |
| --- | --- | --- | --- | --- |
| T1 | not-attempted | 0 ms | missing capability: frontend-implementation, responsive-design | — |
| T2 | not-attempted | 0 ms | missing capability: visual-design | — |
| T3 | not-attempted | 0 ms | missing capability: browser-automation, screenshot-capture | — |
| T4 | not-attempted | 0 ms | missing capability: browser-automation | — |
| T5 | not-attempted | 0 ms | missing capability: browser-automation, performance-audit | — |
| T6 | not-attempted | 0 ms | missing capability: browser-automation, screenshot-capture, image-comparison, visual-regression | — |
| T8 | not-attempted | 0 ms | missing capability: testing | — |
| T9 | not-attempted | 0 ms | missing capability: visual-review, performance-audit | — |

#### americanexpress/jest-image-snapshot

| Task | Outcome | Time | Detail | Evidence |
| --- | --- | --- | --- | --- |
| T1 | not-attempted | 0 ms | missing capability: frontend-implementation, responsive-design | — |
| T2 | not-attempted | 0 ms | missing capability: visual-design | — |
| T3 | not-attempted | 0 ms | missing capability: browser-automation, screenshot-capture | — |
| T4 | not-attempted | 0 ms | missing capability: browser-automation, accessibility-audit | — |
| T5 | not-attempted | 0 ms | missing capability: browser-automation, performance-audit | — |
| T6 | not-attempted | 0 ms | missing capability: browser-automation, screenshot-capture | — |
| T8 | not-attempted | 0 ms | missing capability: testing | — |
| T9 | not-attempted | 0 ms | missing capability: visual-review, accessibility-audit, performance-audit | — |

#### GoogleChrome/lighthouse

| Task | Outcome | Time | Detail | Evidence |
| --- | --- | --- | --- | --- |
| T1 | not-attempted | 0 ms | missing capability: frontend-implementation, responsive-design | — |
| T2 | not-attempted | 0 ms | missing capability: visual-design | — |
| T3 | not-attempted | 0 ms | missing capability: browser-automation, screenshot-capture | — |
| T4 | not-attempted | 0 ms | missing capability: browser-automation | — |
| T5 | not-attempted | 0 ms | missing capability: browser-automation | — |
| T6 | not-attempted | 0 ms | missing capability: browser-automation, screenshot-capture, image-comparison, visual-regression | — |
| T8 | not-attempted | 0 ms | missing capability: testing | — |
| T9 | not-attempted | 0 ms | missing capability: visual-review | — |

#### originals-union

| Task | Outcome | Time | Detail | Evidence |
| --- | --- | --- | --- | --- |
| T1 | not-attempted | 0 ms | missing capability: frontend-implementation, responsive-design | — |
| T2 | not-attempted | 0 ms | missing capability: visual-design | — |
| T3 | not-attempted | 0 ms | missing capability: browser-automation, screenshot-capture | — |
| T4 | not-attempted | 0 ms | missing capability: browser-automation | — |
| T5 | not-attempted | 0 ms | missing capability: browser-automation | — |
| T6 | not-attempted | 0 ms | missing capability: browser-automation, screenshot-capture | — |
| T8 | not-attempted | 0 ms | missing capability: testing | — |
| T9 | not-attempted | 0 ms | missing capability: visual-review | — |

#### live-web-quality

| Task | Outcome | Time | Detail | Evidence |
| --- | --- | --- | --- | --- |
| T1 | not-attempted | 0 ms | missing capability: frontend-implementation, responsive-design | — |
| T2 | not-attempted | 0 ms | missing capability: visual-design | — |
| T3 | passed | 0 ms | captured 3 screenshots | shot:360x800=55785, shot:768x1024=72411, shot:1440x900=77600 |
| T4 | passed | 0 ms | axe-core reported 1 violation(s): image-alt | violations=1, serious=1, rules=image-alt |
| T5 | passed | 0 ms | load 19ms, DOMContentLoaded 17ms | loadMs=19, domContentLoadedMs=17 |
| T6 | passed | 0 ms | pixel diff ratio against baseline: 0 | diffRatio=0 |
| T8 | passed | 0 ms | DOM assertions: cta present true, cards 3 | ctaPresent=true, cardCount=3 |
| T9 | passed | 0 ms | verdict assembled from 1 a11y violation(s), load 19ms, 3 screenshots | violations=1, loadMs=19, screenshots=3 |

## Execution profile

Phase breakdown across every measured pass (all subjects, all repeats). Browser launch, module loading and the axe-core source read happen once in a discarded warm-up pass and are **not** in this table or in any subject's Execution Time — charging process start-up to whichever subject ran first was measuring the ordering, not the capability set.

| Phase | ms | % | calls |
| --- | --- | --- | --- |
| screenshot:capture | 1369.9 | 23.1% | 24 |
| axe:inject | 1298.9 | 21.9% | 12 |
| axe:run | 1034 | 17.4% | 12 |
| pixel:diff | 816.7 | 13.8% | 9 |
| browser:newPage | 623.3 | 10.5% | 15 |
| page:goto | 249.3 | 4.2% | 15 |
| browser:closeContext | 217.9 | 3.7% | 15 |
| eval:structure | 116.1 | 2% | 15 |
| browser:newContext | 99.8 | 1.7% | 15 |
| eval:navigation-timing | 45.6 | 0.8% | 15 |
| viewport:resize | 44.3 | 0.7% | 15 |
| eval:layout | 9.8 | 0.2% | 9 |
| require:pixelmatch | 0.3 | 0% | 15 |
| require:pngjs | 0 | 0% | 15 |

## Not measured

- UX — NOT MEASURABLE in this project. It needs human subjects, which are not available. It stays NOT_VERIFIED and no proxy is substituted. Reporting this as improved would be a guess.
- Setup Time — NOT MEASURED. Install Actions is reported as a separate measured metric in its own right; it is NOT presented as a measurement of setup time. Reporting this as improved would be a guess.
- Token Usage — NOT MEASURED. The task suite is executed as deterministic code, not through a model, so no token accounting exists. Estimating it would be a fabrication. Reporting this as improved would be a guess.
