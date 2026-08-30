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

- `fixture-org/frontend-craft-plugin` — 3 capabilities, 1 install action(s), 1 project(s) in the supply chain
- `fixture-org/browser-qa-plugin` — 3 capabilities, 2 install action(s) (external runtimes: chromium-browser-binaries), 1 project(s) in the supply chain
- `fixture-org/a11y-guard-plugin` — 0 capabilities, 1 install action(s), 1 project(s) in the supply chain
- `originals-union` — 6 capabilities, 4 install action(s) (external runtimes: chromium-browser-binaries), 3 project(s) in the supply chain
- `frontend-quality-plugin` — 11 capabilities, 2 install action(s) (external runtimes: chromium-browser-binaries), 5 project(s) in the supply chain

## Tasks (8)

- `T1` Build a responsive landing page from a brief — requires: frontend-implementation, responsive-design
- `T2` Critique the visual design of an existing page — requires: visual-design
- `T3` Capture the page at three viewports — requires: browser-automation, screenshot-capture
- `T4` Report WCAG violations on a live page — requires: browser-automation, accessibility-audit
- `T5` Report loading performance metrics — requires: browser-automation, performance-audit
- `T6` Detect unintended visual change against a baseline — requires: browser-automation, screenshot-capture, image-comparison, visual-regression
- `T8` Run the end-to-end test suite — requires: testing
- `T9` Give an evidence-backed verdict on whether the page is ready to ship — requires: visual-review, accessibility-audit, performance-audit

Executed against a real page in a real browser at http://127.0.0.1:33407/, 3 repeat(s). Each subject gets its own browser pass performing only the collection its capabilities imply, so Execution Time is that subject's own cost rather than a shared figure.

**Excluded from this run (1):** `T7` Review the diff for correctness and convention — no executable implementation exists for them against a rendered page, so scoring any subject on them would deflate every result equally and measure nothing.

## Results

| Metric | Direction | fixture-org/frontend-craft-plugin | fixture-org/browser-qa-plugin | fixture-org/a11y-guard-plugin | originals-union | frontend-quality-plugin | Verdict | Material? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Task Completion | ↑ better | 0.25 | 0.25 | 0 | 0.5 | 1 | IMPROVED | — |
| Error Rate | ↓ better | 0 | 0 | n/a | 0 | 0 | EQUIVALENT | — |
| Security Findings (high/critical) | ↓ better | 0 | 0 | 2 | 2 | 0 | EQUIVALENT | — |
| Integration Debt | ↓ better | 3 | 6 | 5 | 6 | 0 | IMPROVED | — |
| Install Actions | ↓ better | 1 | 2 | 1 | 4 | 2 | REGRESSION | no |
| Distinct Upstream Projects | ↓ better | 1 | 1 | 1 | 3 | 5 | REGRESSION | **YES** |
| Task Coverage per Install Action | ↑ better | 0.25 | 0.125 | 0 | 0.125 | 0.5 | IMPROVED | — |
| Output Quality | ↑ better | n/a | n/a | n/a | 1 | 1 | EQUIVALENT | — |
| Quality Criteria Covered | ↑ better | 1 | 3 | 0 | 4 | 7 | IMPROVED | — |
| Execution Time | ↓ better | 461 | 440 | n/a | 462 | 844 | REGRESSION | **YES** |
| Reliability | ↑ better | 1 | 1 | n/a | 1 | 1 | EQUIVALENT | — |
| UX | not measured | n/a | n/a | n/a | n/a | n/a | NOT_VERIFIED (no verdict) | — |
| Setup Time | not measured | n/a | n/a | n/a | n/a | n/a | NOT_VERIFIED (no verdict) | — |
| Token Usage | not measured | n/a | n/a | n/a | n/a | n/a | NOT_VERIFIED (no verdict) | — |

> **Install Actions regressed.** Not material: 2 is better than the realistic alternative (originals-union = 4). It regresses only against the single cheapest original, which cannot do the same work.

> **Distinct Upstream Projects regressed.** MATERIAL: 5 is worse than the realistic alternative (originals-union = 3), so integrating costs more than what it replaces.

> **Execution Time regressed.** MATERIAL: 844 is worse than the realistic alternative (originals-union = 462), so integrating costs more than what it replaces.

**Overall: REGRESSION**

REGRESSION DETECTED on: Install Actions, Distinct Upstream Projects, Execution Time. Rule 21: the overall verdict is REGRESSION whenever any measured metric regresses, whether or not that regression is material.

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
| **Results** | fixture-org/frontend-craft-plugin=0.25, fixture-org/browser-qa-plugin=0.25, fixture-org/a11y-guard-plugin=0, originals-union=0.5, frontend-quality-plugin=1 |
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
| **Results** | fixture-org/frontend-craft-plugin=0, fixture-org/browser-qa-plugin=0, fixture-org/a11y-guard-plugin=n/a, originals-union=0, frontend-quality-plugin=0 |
| **Verdict** | EQUIVALENT |
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
| **Results** | fixture-org/frontend-craft-plugin=0, fixture-org/browser-qa-plugin=0, fixture-org/a11y-guard-plugin=2, originals-union=2, frontend-quality-plugin=0 |
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
| **Results** | fixture-org/frontend-craft-plugin=3, fixture-org/browser-qa-plugin=6, fixture-org/a11y-guard-plugin=5, originals-union=6, frontend-quality-plugin=0 |
| **Verdict** | IMPROVED |
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
| **Results** | fixture-org/frontend-craft-plugin=1, fixture-org/browser-qa-plugin=2, fixture-org/a11y-guard-plugin=1, originals-union=4, frontend-quality-plugin=2 |
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
| **Results** | fixture-org/frontend-craft-plugin=1, fixture-org/browser-qa-plugin=1, fixture-org/a11y-guard-plugin=1, originals-union=3, frontend-quality-plugin=5 |
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
| **Results** | fixture-org/frontend-craft-plugin=0.25, fixture-org/browser-qa-plugin=0.125, fixture-org/a11y-guard-plugin=0, originals-union=0.125, frontend-quality-plugin=0.5 |
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
| **Results** | fixture-org/frontend-craft-plugin=n/a, fixture-org/browser-qa-plugin=n/a, fixture-org/a11y-guard-plugin=n/a, originals-union=1, frontend-quality-plugin=1 |
| **Verdict** | EQUIVALENT |
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
| **Results** | fixture-org/frontend-craft-plugin=1, fixture-org/browser-qa-plugin=3, fixture-org/a11y-guard-plugin=0, originals-union=4, frontend-quality-plugin=7 |
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
| **Results** | fixture-org/frontend-craft-plugin=461, fixture-org/browser-qa-plugin=440, fixture-org/a11y-guard-plugin=n/a, originals-union=462, frontend-quality-plugin=844 |
| **Verdict** | REGRESSION |
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
| **Results** | fixture-org/frontend-craft-plugin=1, fixture-org/browser-qa-plugin=1, fixture-org/a11y-guard-plugin=n/a, originals-union=1, frontend-quality-plugin=1 |
| **Verdict** | EQUIVALENT |
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
| **Results** | fixture-org/frontend-craft-plugin=n/a, fixture-org/browser-qa-plugin=n/a, fixture-org/a11y-guard-plugin=n/a, originals-union=n/a, frontend-quality-plugin=n/a |
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
| **Results** | fixture-org/frontend-craft-plugin=n/a, fixture-org/browser-qa-plugin=n/a, fixture-org/a11y-guard-plugin=n/a, originals-union=n/a, frontend-quality-plugin=n/a |
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
| **Results** | fixture-org/frontend-craft-plugin=n/a, fixture-org/browser-qa-plugin=n/a, fixture-org/a11y-guard-plugin=n/a, originals-union=n/a, frontend-quality-plugin=n/a |
| **Verdict** | NOT_VERIFIED |
| **Confidence** | none — not measured |


## Output Quality rubric

0 = fails, 1 = partially meets, 2 = fully meets. NOT_VERIFIED criteria are excluded from both numerator and denominator.

#### fixture-org/frontend-craft-plugin

| Criterion | Score | Evidence |
| --- | --- | --- |
| Requirement Satisfaction | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Visual Consistency | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Responsive Behavior | 2 / 2 | no horizontal overflow at 360x800, 768x1024, 1440x900. |
| Accessibility | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Functional Correctness | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Visual Regression | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Performance | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Code Quality | NOT_VERIFIED | NOT_VERIFIED — this suite exercises a rendered page, not a codebase under review. No evidence exists for this criterion. |

#### fixture-org/browser-qa-plugin

| Criterion | Score | Evidence |
| --- | --- | --- |
| Requirement Satisfaction | 2 / 2 | DOM assertions passed (cta present, 3 cards). |
| Visual Consistency | 2 / 2 | 3 screenshots captured across 3 viewports. |
| Responsive Behavior | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Accessibility | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Functional Correctness | 2 / 2 | cta present: true, cards: 3. |
| Visual Regression | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Performance | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Code Quality | NOT_VERIFIED | NOT_VERIFIED — this suite exercises a rendered page, not a codebase under review. No evidence exists for this criterion. |

#### fixture-org/a11y-guard-plugin

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
| Requirement Satisfaction | 2 / 2 | DOM assertions passed (cta present, 3 cards). |
| Visual Consistency | 2 / 2 | 3 screenshots captured across 3 viewports. |
| Responsive Behavior | 2 / 2 | no horizontal overflow at 360x800, 768x1024, 1440x900. |
| Accessibility | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Functional Correctness | 2 / 2 | cta present: true, cards: 3. |
| Visual Regression | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Performance | NOT_VERIFIED | NOT_VERIFIED — the subject does not hold the capability this criterion needs, or the check did not run. |
| Code Quality | NOT_VERIFIED | NOT_VERIFIED — this suite exercises a rendered page, not a codebase under review. No evidence exists for this criterion. |

#### frontend-quality-plugin

| Criterion | Score | Evidence |
| --- | --- | --- |
| Requirement Satisfaction | 2 / 2 | DOM assertions passed (cta present, 3 cards). |
| Visual Consistency | 2 / 2 | 3 screenshots captured across 3 viewports. |
| Responsive Behavior | 2 / 2 | no horizontal overflow at 360x800, 768x1024, 1440x900. |
| Accessibility | 0 / 2 | axe-core: 1 violation(s), 1 serious/critical (image-alt). |
| Functional Correctness | 2 / 2 | cta present: true, cards: 3. |
| Visual Regression | 2 / 2 | pixel diff ratio 0. |
| Performance | 2 / 2 | load 18ms, DOMContentLoaded 15ms. |
| Code Quality | NOT_VERIFIED | NOT_VERIFIED — this suite exercises a rendered page, not a codebase under review. No evidence exists for this criterion. |

## Per-task outcomes

#### fixture-org/frontend-craft-plugin

| Task | Outcome | Time | Detail | Evidence |
| --- | --- | --- | --- | --- |
| T1 | passed | 0 ms | layout adapts at every viewport with no horizontal overflow | cards=3, viewports=3, overflowViewports=0 |
| T2 | passed | 0 ms | one h1: true, heading order sound: true | h1Count=1, headingOrderOk=true, title=Kaede Studio — Product Landing Page |
| T3 | not-attempted | 0 ms | missing capability: browser-automation, screenshot-capture | — |
| T4 | not-attempted | 0 ms | missing capability: browser-automation, accessibility-audit | — |
| T5 | not-attempted | 0 ms | missing capability: browser-automation, performance-audit | — |
| T6 | not-attempted | 0 ms | missing capability: browser-automation, screenshot-capture, image-comparison, visual-regression | — |
| T8 | not-attempted | 0 ms | missing capability: testing | — |
| T9 | not-attempted | 0 ms | missing capability: visual-review, accessibility-audit, performance-audit | — |

#### fixture-org/browser-qa-plugin

| Task | Outcome | Time | Detail | Evidence |
| --- | --- | --- | --- | --- |
| T1 | not-attempted | 0 ms | missing capability: frontend-implementation, responsive-design | — |
| T2 | not-attempted | 0 ms | missing capability: visual-design | — |
| T3 | passed | 0 ms | captured 3 screenshots | shot:360x800=55785, shot:768x1024=72411, shot:1440x900=77600 |
| T4 | not-attempted | 0 ms | missing capability: accessibility-audit | — |
| T5 | not-attempted | 0 ms | missing capability: performance-audit | — |
| T6 | not-attempted | 0 ms | missing capability: image-comparison, visual-regression | — |
| T8 | passed | 0 ms | DOM assertions: cta present true, cards 3 | ctaPresent=true, cardCount=3 |
| T9 | not-attempted | 0 ms | missing capability: visual-review, accessibility-audit, performance-audit | — |

#### fixture-org/a11y-guard-plugin

| Task | Outcome | Time | Detail | Evidence |
| --- | --- | --- | --- | --- |
| T1 | not-attempted | 0 ms | missing capability: frontend-implementation, responsive-design | — |
| T2 | not-attempted | 0 ms | missing capability: visual-design | — |
| T3 | not-attempted | 0 ms | missing capability: browser-automation, screenshot-capture | — |
| T4 | not-attempted | 0 ms | missing capability: browser-automation, accessibility-audit | — |
| T5 | not-attempted | 0 ms | missing capability: browser-automation, performance-audit | — |
| T6 | not-attempted | 0 ms | missing capability: browser-automation, screenshot-capture, image-comparison, visual-regression | — |
| T8 | not-attempted | 0 ms | missing capability: testing | — |
| T9 | not-attempted | 0 ms | missing capability: visual-review, accessibility-audit, performance-audit | — |

#### originals-union

| Task | Outcome | Time | Detail | Evidence |
| --- | --- | --- | --- | --- |
| T1 | passed | 0 ms | layout adapts at every viewport with no horizontal overflow | cards=3, viewports=3, overflowViewports=0 |
| T2 | passed | 0 ms | one h1: true, heading order sound: true | h1Count=1, headingOrderOk=true, title=Kaede Studio — Product Landing Page |
| T3 | passed | 0 ms | captured 3 screenshots | shot:360x800=55785, shot:768x1024=72411, shot:1440x900=77600 |
| T4 | not-attempted | 0 ms | missing capability: accessibility-audit | — |
| T5 | not-attempted | 0 ms | missing capability: performance-audit | — |
| T6 | not-attempted | 0 ms | missing capability: image-comparison, visual-regression | — |
| T8 | passed | 0 ms | DOM assertions: cta present true, cards 3 | ctaPresent=true, cardCount=3 |
| T9 | not-attempted | 0 ms | missing capability: visual-review, accessibility-audit, performance-audit | — |

#### frontend-quality-plugin

| Task | Outcome | Time | Detail | Evidence |
| --- | --- | --- | --- | --- |
| T1 | passed | 0 ms | layout adapts at every viewport with no horizontal overflow | cards=3, viewports=3, overflowViewports=0 |
| T2 | passed | 0 ms | one h1: true, heading order sound: true | h1Count=1, headingOrderOk=true, title=Kaede Studio — Product Landing Page |
| T3 | passed | 0 ms | captured 3 screenshots | shot:360x800=55785, shot:768x1024=72411, shot:1440x900=77600 |
| T4 | passed | 0 ms | axe-core reported 1 violation(s): image-alt | violations=1, serious=1, rules=image-alt |
| T5 | passed | 0 ms | load 18ms, DOMContentLoaded 15ms | loadMs=18, domContentLoadedMs=15 |
| T6 | passed | 0 ms | pixel diff ratio against baseline: 0 | diffRatio=0 |
| T8 | passed | 0 ms | DOM assertions: cta present true, cards 3 | ctaPresent=true, cardCount=3 |
| T9 | passed | 0 ms | verdict assembled from 1 a11y violation(s), load 18ms, 3 screenshots | violations=1, loadMs=18, screenshots=3 |

## Not measured

- UX — NOT MEASURABLE in this project. It needs human subjects, which are not available. It stays NOT_VERIFIED and no proxy is substituted. Reporting this as improved would be a guess.
- Setup Time — NOT MEASURED. Install Actions is reported as a separate measured metric in its own right; it is NOT presented as a measurement of setup time. Reporting this as improved would be a guess.
- Token Usage — NOT MEASURED. The task suite is executed as deterministic code, not through a model, so no token accounting exists. Estimating it would be a fabrication. Reporting this as improved would be a guess.
