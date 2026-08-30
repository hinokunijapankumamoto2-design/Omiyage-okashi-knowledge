# VALIDATION REPORT — live-web-quality

## 1. Package validation

**Result: PASS**

Checked 9 path(s): `.claude-plugin/plugin.json`, `skills/capability-router/SKILL.md`, `skills/evidence-ledger/SKILL.md`, `skills/verification-runner/SKILL.md`, `agents/review-agent.md`, `agents/verification-agent.md`, `PROVENANCE.md`, `README.md`, `capability-manifest.json`

_No structural issue found._

## 2. Benchmark

**Kind:** mixed: executed task results where a subject was run against a real target, static capability coverage elsewhere. Per-metric measurementMethod says which.

**Tasks (8)**

- `T1` Build a responsive landing page from a brief — requires: frontend-implementation, responsive-design
- `T2` Critique the visual design of an existing page — requires: visual-design
- `T3` Capture the page at three viewports — requires: browser-automation, screenshot-capture
- `T4` Report WCAG violations on a live page — requires: browser-automation, accessibility-audit
- `T5` Report loading performance metrics — requires: browser-automation, performance-audit
- `T6` Detect unintended visual change against a baseline — requires: browser-automation, screenshot-capture, image-comparison, visual-regression
- `T8` Run the end-to-end test suite — requires: testing
- `T9` Give an evidence-backed verdict on whether the page is ready to ship — requires: visual-review, accessibility-audit, performance-audit

| Metric | Direction | dequelabs/axe-core | americanexpress/jest-image-snapshot | GoogleChrome/lighthouse | originals-union | live-web-quality | Verdict | Material? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Task Completion | ↑ better | 0 | 0 | 0 | 0 | 0.75 | IMPROVED | — |
| Error Rate | ↓ better | n/a | n/a | n/a | n/a | 0 | NOT_VERIFIED | — |
| Security Findings (high/critical) | ↓ better | 1 | 0 | 0 | 1 | 0 | EQUIVALENT | — |
| Integration Debt | ↓ better | 0 | 0 | 0 | 1 | 0 | EQUIVALENT | — |
| Install Actions | ↓ better | 1 | 1 | 2 | 4 | 2 | REGRESSION | no |
| Distinct Upstream Projects | ↓ better | 1 | 1 | 1 | 3 | 5 | REGRESSION | **YES** |
| Task Coverage per Install Action | ↑ better | 0 | 0 | 0 | 0 | 0.375 | IMPROVED | — |
| Output Quality | ↑ better | n/a | n/a | n/a | n/a | 0.833 | NOT_VERIFIED | — |
| Quality Criteria Covered | ↑ better | 0 | 0 | 0 | 0 | 6 | IMPROVED | — |
| Execution Time | ↓ better | n/a | n/a | n/a | n/a | 840 | NOT_VERIFIED | — |
| Reliability | ↑ better | n/a | n/a | n/a | n/a | 1 | NOT_VERIFIED | — |
| UX | not measured | n/a | n/a | n/a | n/a | n/a | NOT_VERIFIED (no verdict) | — |
| Setup Time | not measured | n/a | n/a | n/a | n/a | n/a | NOT_VERIFIED (no verdict) | — |
| Token Usage | not measured | n/a | n/a | n/a | n/a | n/a | NOT_VERIFIED (no verdict) | — |

> **Install Actions regressed.** Not material: 2 is better than the realistic alternative (originals-union = 4). It regresses only against the single cheapest original, which cannot do the same work.

> **Distinct Upstream Projects regressed.** MATERIAL: 5 is worse than the realistic alternative (originals-union = 3), so integrating costs more than what it replaces.

**Overall: REGRESSION**

REGRESSION DETECTED on: Install Actions, Distinct Upstream Projects. Rule 21: the overall verdict is REGRESSION whenever any measured metric regresses, whether or not that regression is material.

## 3. What was NOT measured

- UX — NOT MEASURABLE in this project. It needs human subjects, which are not available. It stays NOT_VERIFIED and no proxy is substituted. Reporting this as improved would be a guess.
- Setup Time — NOT MEASURED. Install Actions is reported as a separate measured metric in its own right; it is NOT presented as a measurement of setup time. Reporting this as improved would be a guess.
- Token Usage — NOT MEASURED. The task suite is executed as deterministic code, not through a model, so no token accounting exists. Estimating it would be a fabrication. Reporting this as improved would be a guess.

Any of the above reported as an improvement would be a guess. They are
**IMPROVEMENT NOT VERIFIED**.

## 4. Regression check

**REGRESSION DETECTED** on:

- Install Actions: {"dequelabs/axe-core":1,"americanexpress/jest-image-snapshot":1,"GoogleChrome/lighthouse":2,"originals-union":4,"live-web-quality":2}
- Distinct Upstream Projects: {"dequelabs/axe-core":1,"americanexpress/jest-image-snapshot":1,"GoogleChrome/lighthouse":1,"originals-union":3,"live-web-quality":5}

The integration architecture must account for this before the plugin is presented as better than its sources.
