---
name: verification-runner
description: Run the verification capabilities against a URL and return measured results rather than impressions.
---

# Verification Runner

Turns claims about the page into measured facts.

## Capabilities in scope

- **Browser Automation** (`browser-automation`)
- **Screenshot Capture** (`screenshot-capture`)
- **Image Comparison** (`image-comparison`)
- **Visual Regression Testing** (`visual-regression`)
- **Performance Audit** (`performance-audit`)
- **Testing** (`testing`)
- **Accessibility Audit** (`accessibility-audit`)

## Procedure

1. Read `baseUrl` and `viewports` from `config/default.json`, applying any
   user override. If `baseUrl` is not set, stop and ask for it. Do not guess
   a URL.
2. For each viewport, drive the browser to the page and collect the raw
   artifacts the selected capabilities need.
3. Run each capability's check and record its numeric or boolean result.
4. Hand every result to `evidence-ledger` before reporting it.
5. Report failures at or above the configured `failOn` severity as blocking.

## Source posture

- `image-comparison`: concept from americanexpress/jest-image-snapshot (REUSE_WITH_CONDITIONS). Reuse of its code is permitted under its licence conditions, but this plugin does not vendor it - invoke the upstream tool instead.
- `visual-regression`: concept from americanexpress/jest-image-snapshot (REUSE_WITH_CONDITIONS). Reuse of its code is permitted under its licence conditions, but this plugin does not vendor it - invoke the upstream tool instead.
- `performance-audit`: concept from GoogleChrome/lighthouse (REUSE_WITH_CONDITIONS). Reuse of its code is permitted under its licence conditions, but this plugin does not vendor it - invoke the upstream tool instead.
- `testing`: concept from microsoft/playwright (REUSE_WITH_CONDITIONS). Reuse of its code is permitted under its licence conditions, but this plugin does not vendor it - invoke the upstream tool instead.
- `browser-automation`: concept from microsoft/playwright-mcp (REUSE_WITH_CONDITIONS). Reuse of its code is permitted under its licence conditions, but this plugin does not vendor it - invoke the upstream tool instead.
- `screenshot-capture`: concept from microsoft/playwright-mcp (REUSE_WITH_CONDITIONS). Reuse of its code is permitted under its licence conditions, but this plugin does not vendor it - invoke the upstream tool instead.
- `accessibility-audit`: concept from microsoft/playwright-mcp (REUSE_WITH_CONDITIONS). Reuse of its code is permitted under its licence conditions, but this plugin does not vendor it - invoke the upstream tool instead.

## What this skill must never do

- Report a check as passing when it did not run. An unrun check is UNKNOWN.
- Average, round, or soften a measured number to make output look better.
- Substitute a screenshot for an accessibility or performance measurement.
