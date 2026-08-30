---
name: capability-router
description: Route a request for Claude Codeで最高品質のWebサイトを作れるPluginを作って to the right capability in this plugin, in the right order. Use when the user asks for work covering any of: frontend-implementation, visual-design, responsive-design, browser-automation, screenshot-capture, testing, accessibility-audit, performance-audit, image-comparison, visual-regression, visual-review.
---

# Capability Router

This plugin was assembled for one goal:

> Claude Codeで最高品質のWebサイトを作れるPluginを作って

It carries exactly the capabilities that goal needs. Anything outside this
table was deliberately left out.

| Capability | Evidence | Confidence | Concept source |
| --- | --- | --- | --- |
| frontend-implementation | VERIFIED | 0.95 | fixture-org/frontend-craft-plugin |
| visual-design | SUPPORTED | 0.75 | fixture-org/frontend-craft-plugin |
| responsive-design | SUPPORTED | 0.75 | fixture-org/frontend-craft-plugin |
| browser-automation | VERIFIED | 0.95 | fixture-org/browser-qa-plugin |
| screenshot-capture | SUPPORTED | 0.75 | fixture-org/browser-qa-plugin |
| testing | SUPPORTED | 0.75 | fixture-org/browser-qa-plugin |
| accessibility-audit | SUPPORTED | 0.6 | GoogleChrome/lighthouse |
| performance-audit | SUPPORTED | 0.6 | GoogleChrome/lighthouse |
| image-comparison | SUPPORTED | 0.6 | americanexpress/jest-image-snapshot |
| visual-regression | SUPPORTED | 0.6 | americanexpress/jest-image-snapshot |
| visual-review | INFERRED | 0.5 | (combination) |

## Order of work

- 1. Frontend Implementation (frontend-implementation)
- 2. Visual Design (visual-design)
- 3. Responsive Design (responsive-design)
- 4. Browser Automation (browser-automation)
- 5. Screenshot Capture (screenshot-capture)
- 6. Testing (testing)
- 7. Accessibility Audit (accessibility-audit)
- 8. Performance Audit (performance-audit)
- 9. Image Comparison (image-comparison)
- 10. Visual Regression Testing (visual-regression)
- 11. Visual Review (visual-review)

Run prerequisites before dependants. If a prerequisite is unavailable, say so
and stop - do not substitute a weaker check and present it as the same result.

## Routing rules

1. A request to create or change the artifact goes to the Build layer first.
2. Never report the artifact as finished before the Verify layer has run.
3. Every claim you make about the artifact must name what produced it. If
   nothing produced it, mark it UNKNOWN rather than filling the gap.
4. When a capability the request needs is not in the table above, say it is
   not in this plugin. Do not improvise it.

## Configuration

- `baseUrl` (string): URL the verification capabilities run against. Required before any browser-backed check.
- `viewports` (string[]): Viewport list used by responsive and screenshot capabilities, so every capability measures the same sizes.
- `evidenceStandard` (string): Minimum evidence class a capability result must reach before it is reported as a fact.
- `failOn` (string): Severity at which the verification workflow stops and reports failure.
