# VALIDATION REPORT — frontend-quality-plugin

## 1. Package validation

**Result: PASS**

Checked 11 path(s): `.claude-plugin/plugin.json`, `skills/build-surface/SKILL.md`, `skills/capability-router/SKILL.md`, `skills/evidence-ledger/SKILL.md`, `skills/namespace-guard/SKILL.md`, `skills/verification-runner/SKILL.md`, `agents/review-agent.md`, `agents/verification-agent.md`, `PROVENANCE.md`, `README.md`, `capability-manifest.json`

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

| Metric | Direction | fixture-org/frontend-craft-plugin | fixture-org/browser-qa-plugin | fixture-org/a11y-guard-plugin | originals-union | frontend-quality-plugin | Verdict | Material? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Task Completion | ↑ better | 0.25 | 0.25 | 0 | 0.5 | 1 | IMPROVED | — |
| Error Rate | ↓ better | 0 | 0 | n/a | 0 | 0 | EQUIVALENT | — |
| Security Findings (high/critical) | ↓ better | 0 | 0 | 2 | 2 | 0 | EQUIVALENT | — |
| Integration Debt | ↓ better | 3 | 6 | 5 | 6 | 0 | IMPROVED | — |
| Install Actions | ↓ better | 1 | 2 | 1 | 4 | 2 | REGRESSION | no |
| Distinct Upstream Projects | ↓ better | 1 | 1 | 1 | 3 | 5 | REGRESSION | **YES** |
| Task Coverage per Install Action | ↑ better | 0.25 | 0.125 | 0 | 0.125 | 0.5 | IMPROVED | — |
| Unscanned Dependencies | ↓ better | 0 | 0 | 0 | 0 | 2 | REGRESSION | **YES** |
| Output Quality | ↑ better | n/a | n/a | n/a | 1 | 1 | EQUIVALENT | — |
| Quality Criteria Covered | ↑ better | 1 | 3 | 0 | 4 | 7 | IMPROVED | — |
| Execution Time | ↓ better | 243 | 245 | n/a | 244 | 549 | REGRESSION | **YES** |
| Reliability | ↑ better | 1 | 1 | n/a | 1 | 1 | EQUIVALENT | — |
| Execution Time per Completed Task | ↓ better | 121.5 | 122.5 | n/a | 61 | 68.625 | REGRESSION | **YES** |
| Execution Time per Quality Criterion | ↓ better | 243 | 81.667 | n/a | 61 | 78.429 | REGRESSION | **YES** |
| UX | not measured | n/a | n/a | n/a | n/a | n/a | NOT_VERIFIED (no verdict) | — |
| Setup Time | not measured | n/a | n/a | n/a | n/a | n/a | NOT_VERIFIED (no verdict) | — |
| Token Usage | not measured | n/a | n/a | n/a | n/a | n/a | NOT_VERIFIED (no verdict) | — |

> **Install Actions regressed.** Not material: 2 is better than the realistic alternative (originals-union = 4). It regresses only against the single cheapest original, which cannot do the same work.

> **Distinct Upstream Projects regressed.** MATERIAL: 5 is worse than the realistic alternative (originals-union = 3), so integrating costs more than what it replaces.

> **Unscanned Dependencies regressed.** An unknown dependency is a security exposure, and the project's own rule is that UNKNOWN is never PASS.

> **Execution Time regressed.** MATERIAL: 549 is worse than the realistic alternative (originals-union = 244), so integrating costs more than what it replaces.

> **Execution Time per Completed Task regressed.** MATERIAL: 68.625 is worse than the realistic alternative (originals-union = 61), so integrating costs more than what it replaces.

> **Execution Time per Quality Criterion regressed.** MATERIAL: 78.429 is worse than the realistic alternative (originals-union = 61), so integrating costs more than what it replaces.

**Overall: REGRESSION**

REGRESSION DETECTED on: Install Actions, Distinct Upstream Projects, Unscanned Dependencies, Execution Time, Execution Time per Completed Task, Execution Time per Quality Criterion. Rule 21: the overall verdict is REGRESSION whenever any measured metric regresses, whether or not that regression is material.

## 3. What was NOT measured

- UX — NOT MEASURABLE in this project. It needs human subjects, which are not available. It stays NOT_VERIFIED and no proxy is substituted. Reporting this as improved would be a guess.
- Setup Time — NOT MEASURED. Install Actions is reported as a separate measured metric in its own right; it is NOT presented as a measurement of setup time. Reporting this as improved would be a guess.
- Token Usage — NOT MEASURED. The task suite is executed as deterministic code, not through a model, so no token accounting exists. Estimating it would be a fabrication. Reporting this as improved would be a guess.

Any of the above reported as an improvement would be a guess. They are
**IMPROVEMENT NOT VERIFIED**.

## 4. Regression check

**REGRESSION DETECTED** on:

- Install Actions: {"fixture-org/frontend-craft-plugin":1,"fixture-org/browser-qa-plugin":2,"fixture-org/a11y-guard-plugin":1,"originals-union":4,"frontend-quality-plugin":2}
- Distinct Upstream Projects: {"fixture-org/frontend-craft-plugin":1,"fixture-org/browser-qa-plugin":1,"fixture-org/a11y-guard-plugin":1,"originals-union":3,"frontend-quality-plugin":5}
- Unscanned Dependencies: {"fixture-org/frontend-craft-plugin":0,"fixture-org/browser-qa-plugin":0,"fixture-org/a11y-guard-plugin":0,"originals-union":0,"frontend-quality-plugin":2}
- Execution Time: {"fixture-org/frontend-craft-plugin":243,"fixture-org/browser-qa-plugin":245,"fixture-org/a11y-guard-plugin":null,"originals-union":244,"frontend-quality-plugin":549}
- Execution Time per Completed Task: {"fixture-org/frontend-craft-plugin":121.5,"fixture-org/browser-qa-plugin":122.5,"fixture-org/a11y-guard-plugin":null,"originals-union":61,"frontend-quality-plugin":68.625}
- Execution Time per Quality Criterion: {"fixture-org/frontend-craft-plugin":243,"fixture-org/browser-qa-plugin":81.667,"fixture-org/a11y-guard-plugin":null,"originals-union":61,"frontend-quality-plugin":78.429}

The integration architecture must account for this before the plugin is presented as better than its sources.
