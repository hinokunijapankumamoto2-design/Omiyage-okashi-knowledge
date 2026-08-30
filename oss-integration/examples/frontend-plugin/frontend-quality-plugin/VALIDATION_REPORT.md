# VALIDATION REPORT — frontend-quality-plugin

## 1. Package validation

**Result: PASS**

Checked 11 path(s): `.claude-plugin/plugin.json`, `skills/build-surface/SKILL.md`, `skills/capability-router/SKILL.md`, `skills/evidence-ledger/SKILL.md`, `skills/namespace-guard/SKILL.md`, `skills/verification-runner/SKILL.md`, `agents/review-agent.md`, `agents/verification-agent.md`, `PROVENANCE.md`, `README.md`, `capability-manifest.json`

_No structural issue found._

## 2. Benchmark

**Kind:** static-capability-coverage (v0.1). The generated plugin was not executed against a live target.

**Tasks (9)**

- `T1` Build a responsive landing page from a brief — requires: frontend-implementation, responsive-design
- `T2` Critique the visual design of an existing page — requires: visual-design
- `T3` Capture the page at three viewports — requires: browser-automation, screenshot-capture
- `T4` Report WCAG violations on a live page — requires: browser-automation, accessibility-audit
- `T5` Report loading performance metrics — requires: browser-automation, performance-audit
- `T6` Detect unintended visual change against a baseline — requires: browser-automation, screenshot-capture, image-comparison, visual-regression
- `T7` Review the diff for correctness and convention — requires: code-review
- `T8` Run the end-to-end test suite — requires: testing
- `T9` Give an evidence-backed verdict on whether the page is ready to ship — requires: visual-review, accessibility-audit, performance-audit

| Metric | Direction | fixture-org/frontend-craft-plugin | fixture-org/browser-qa-plugin | fixture-org/a11y-guard-plugin | frontend-quality-plugin | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Task Completion | higher better | 0.222 | 0.222 | 0 | 0.889 | IMPROVED |
| Error Rate | lower better | 0 | 0 | 1 | 0.5 | REGRESSION |
| Security | lower better | 0 | 0 | 2 | 0 | EQUIVALENT |
| Maintainability | lower better | 3 | 6 | 5 | 1 | IMPROVED |
| Install Sources | lower better | 1 | 1 | 1 | 5 | REGRESSION (informational) |
| Capability Coverage per Install Source | higher better | 0.222 | 0.222 | 0 | 0.178 | REGRESSION |
| Output Quality | not measured | n/a | n/a | n/a | n/a | NOT_VERIFIED (informational) |
| Reliability | not measured | n/a | n/a | n/a | n/a | NOT_VERIFIED (informational) |
| UX | not measured | n/a | n/a | n/a | n/a | NOT_VERIFIED (informational) |
| Token Usage | not measured | n/a | n/a | n/a | n/a | NOT_VERIFIED (informational) |
| Execution Time (plugin runtime) | not measured | n/a | n/a | n/a | n/a | NOT_VERIFIED (informational) |
> **Install Sources is informational.** Not a like-for-like comparison: the subjects deliver different numbers of capabilities, so comparing raw install counts rewards the subject that does least. The normalized metric below is the one that counts. The raw numbers are still reported, and a rise in them is called out in the regression section.

**Overall: REGRESSION**

REGRESSION DETECTED on at least one measured metric. The integration architecture must be revisited before this plugin is presented as an improvement.

## 3. What was NOT measured

- Output Quality — needs a rubric-scored run against real pages; not run in v0.1.
- Reliability — needs repeated runs to measure variance; not run in v0.1.
- UX — needs human subjects; not run in v0.1.
- Execution Time (plugin runtime) — the pipeline build time is measured, but the generated plugin was not executed against a live target.
- Token Usage — the generated plugin was not executed, so no token accounting exists.
- Setup Time — install-source count is reported as a proxy; wall-clock setup was not timed.

Any of the above reported as an improvement would be a guess. They are
**IMPROVEMENT NOT VERIFIED**.

## 4. Regression check

**REGRESSION DETECTED** on:

- Error Rate: {"fixture-org/frontend-craft-plugin":0,"fixture-org/browser-qa-plugin":0,"fixture-org/a11y-guard-plugin":1,"frontend-quality-plugin":0.5}
- Install Sources: {"fixture-org/frontend-craft-plugin":1,"fixture-org/browser-qa-plugin":1,"fixture-org/a11y-guard-plugin":1,"frontend-quality-plugin":5}
- Capability Coverage per Install Source: {"fixture-org/frontend-craft-plugin":0.222,"fixture-org/browser-qa-plugin":0.222,"fixture-org/a11y-guard-plugin":0,"frontend-quality-plugin":0.178}

The integration architecture must account for this before the plugin is presented as better than its sources.
