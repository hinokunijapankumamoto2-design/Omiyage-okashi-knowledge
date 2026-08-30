---
name: capability-router
description: Route a request for Claude Codeで最高品質のWebサイトを作れるPluginを作って to the right capability in this plugin, in the right order. Use when the user asks for work covering any of: image-comparison, visual-regression, performance-audit, testing, browser-automation, screenshot-capture, accessibility-audit, visual-review.
---

# Capability Router

This plugin was assembled for one goal:

> Claude Codeで最高品質のWebサイトを作れるPluginを作って

It carries exactly the capabilities that goal needs. Anything outside this
table was deliberately left out.

| Capability | Evidence | Confidence | Concept source |
| --- | --- | --- | --- |
| image-comparison | SUPPORTED | 0.75 | americanexpress/jest-image-snapshot |
| visual-regression | SUPPORTED | 0.75 | americanexpress/jest-image-snapshot |
| performance-audit | SUPPORTED | 0.75 | GoogleChrome/lighthouse |
| testing | SUPPORTED | 0.75 | microsoft/playwright |
| browser-automation | SUPPORTED | 0.75 | microsoft/playwright-mcp |
| screenshot-capture | SUPPORTED | 0.75 | microsoft/playwright-mcp |
| accessibility-audit | SUPPORTED | 0.75 | microsoft/playwright-mcp |
| visual-review | INFERRED | 0.5 | (combination) |

## Order of work

- 1. Image Comparison (image-comparison)
- 2. Testing (testing)
- 3. Browser Automation (browser-automation)
- 4. Screenshot Capture (screenshot-capture)
- 5. Accessibility Audit (accessibility-audit)
- 6. Visual Review (visual-review)
- 7. Visual Regression Testing (visual-regression)
- 8. Performance Audit (performance-audit)

Run prerequisites before dependants. If a prerequisite is unavailable, say so
and stop - do not substitute a weaker check and present it as the same result.

## Routing rules

1. A request to create or change the artifact goes to the Build layer first.
2. Never report the artifact as finished before the Verify layer has run.
3. Every claim you make about the artifact must name what produced it. If
   nothing produced it, mark it UNKNOWN rather than filling the gap.
4. When a capability the request needs is not in the table above, say it is
   not in this plugin. Do not improvise it.

## Components in this plugin

Hand off to these rather than doing their work here. Nothing else exists: if a
request needs something not listed, say so.

- `skills/capability-router/SKILL.md` — Route a request for Claude Codeで最高品質のWebサイトを作れるPluginを作って to the right capability in this plugin, in the right order. Use when the user asks for work covering any of: image-comparison, visual-regression, performance-audit, testing, browser-automation, screenshot-capture, accessibility-audit, visual-review.
- `skills/verification-runner/SKILL.md` — Run the verification capabilities against a URL and return measured results rather than impressions.
- `skills/evidence-ledger/SKILL.md` — Record what was measured versus assumed for each capability result, and refuse to report an unmeasured claim as a fact.
- `agents/verification-agent.md` — subagent for verification work.
- `agents/review-agent.md` — subagent for review work.
- `config/default.json` — the single configuration surface every capability reads.
- `capability-manifest.json` — what this plugin can do and how well each claim is evidenced.

## Configuration

Defaults live in `config/default.json`. Read that file before running any
capability, and treat a value the user has overridden as authoritative.

- `baseUrl` (string): URL the verification capabilities run against. Required before any browser-backed check.
- `viewports` (string[]): Viewport list used by responsive and screenshot capabilities, so every capability measures the same sizes.
- `evidenceStandard` (string): Minimum evidence class a capability result must reach before it is reported as a fact.
- `failOn` (string): Severity at which the verification workflow stops and reports failure.
