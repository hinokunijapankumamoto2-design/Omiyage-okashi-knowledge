# PROVENANCE — live-web-quality

Generated 2026-08-30 by `oss-integrate build`.

**Reused code: None.** This plugin contains no third-party source. Every file
was generated from the analysis result. Where a capability was inspired by an
upstream project, that project is credited below as a *concept* source, and the
plugin either invokes the upstream tool as an external process or implements
the idea independently.

## Summary

| Capability | Repository | Author | Licence posture | Version | Evidence | Decision | Reused code | Generated component |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| image-comparison | americanexpress/jest-image-snapshot | americanexpress | REUSE_WITH_CONDITIONS | 6.5.2 | SUPPORTED | KEEP | None | verification-runner, verification-agent |
| visual-regression | americanexpress/jest-image-snapshot | americanexpress | REUSE_WITH_CONDITIONS | 6.5.2 | SUPPORTED | KEEP | None | verification-runner, verification-agent |
| performance-audit | GoogleChrome/lighthouse | GoogleChrome | REUSE_WITH_CONDITIONS | 13.4.1 | SUPPORTED | KEEP | None | verification-runner, verification-agent |
| testing | microsoft/playwright | microsoft | REUSE_WITH_CONDITIONS | 0.0.1-security | SUPPORTED | ADD | None | verification-runner, verification-agent |
| browser-automation | microsoft/playwright-mcp | microsoft | REUSE_WITH_CONDITIONS | 0.0.79 | SUPPORTED | ADD | None | verification-runner, verification-agent |
| screenshot-capture | microsoft/playwright-mcp | microsoft | REUSE_WITH_CONDITIONS | 0.0.79 | SUPPORTED | ADD | None | verification-runner, verification-agent |
| accessibility-audit | microsoft/playwright-mcp | microsoft | REUSE_WITH_CONDITIONS | 0.0.79 | SUPPORTED | ADD | None | verification-runner, verification-agent |
| visual-review | (combination) | (combination) | REUSE_OK | UNKNOWN | INFERRED | ADD | None | review-agent |
| capability-router | (none) | this project | MIT (this project) | UNKNOWN | SUPPORTED | ADD | None | skills/capability-router/SKILL.md |
| evidence-ledger | (none) | this project | MIT (this project) | UNKNOWN | SUPPORTED | ADD | None | skills/evidence-ledger/SKILL.md |

## Detail

### image-comparison — americanexpress/jest-image-snapshot

- **Source**: public GitHub repository
- **Research date**: 2026-08-30
- **Adopted concept**: Diff two images pixel-wise or perceptually and produce a pass/fail with a diff artifact.
- **Reused code**: None
- **Modification**: Not applicable - no upstream code was copied, so there is nothing modified. The capability was re-specified for this plugin.
- **Original contribution**: Independent specification of image-comparison inside the live-web-quality architecture, with an evidence class attached to every result.
- **Evidence**: SUPPORTED
- **Decision**: KEEP

### visual-regression — americanexpress/jest-image-snapshot

- **Source**: public GitHub repository
- **Research date**: 2026-08-30
- **Adopted concept**: Detect unintended visual change between a baseline and the current build.
- **Reused code**: None
- **Modification**: Not applicable - no upstream code was copied, so there is nothing modified. The capability was re-specified for this plugin.
- **Original contribution**: Independent specification of visual-regression inside the live-web-quality architecture, with an evidence class attached to every result.
- **Evidence**: SUPPORTED
- **Decision**: KEEP

### performance-audit — GoogleChrome/lighthouse

- **Source**: public GitHub repository
- **Research date**: 2026-08-30
- **Adopted concept**: Measure loading and runtime performance metrics for a page and report regressions.
- **Reused code**: None
- **Modification**: Not applicable - no upstream code was copied, so there is nothing modified. The capability was re-specified for this plugin.
- **Original contribution**: Independent specification of performance-audit inside the live-web-quality architecture, with an evidence class attached to every result.
- **Evidence**: SUPPORTED
- **Decision**: KEEP

### testing — microsoft/playwright

- **Source**: public GitHub repository
- **Research date**: 2026-08-30
- **Adopted concept**: Define and execute automated tests, and report pass/fail with reproducible output.
- **Reused code**: None
- **Modification**: Not applicable - no upstream code was copied, so there is nothing modified. The capability was re-specified for this plugin.
- **Original contribution**: Independent specification of testing inside the live-web-quality architecture, with an evidence class attached to every result.
- **Evidence**: SUPPORTED
- **Decision**: ADD

### browser-automation — microsoft/playwright-mcp

- **Source**: public GitHub repository
- **Research date**: 2026-08-30
- **Adopted concept**: Drive a real browser programmatically: navigate, interact, evaluate, and read page state.
- **Reused code**: None
- **Modification**: Not applicable - no upstream code was copied, so there is nothing modified. The capability was re-specified for this plugin.
- **Original contribution**: Independent specification of browser-automation inside the live-web-quality architecture, with an evidence class attached to every result.
- **Evidence**: SUPPORTED
- **Decision**: ADD

### screenshot-capture — microsoft/playwright-mcp

- **Source**: public GitHub repository
- **Research date**: 2026-08-30
- **Adopted concept**: Capture deterministic page or element screenshots at defined viewports.
- **Reused code**: None
- **Modification**: Not applicable - no upstream code was copied, so there is nothing modified. The capability was re-specified for this plugin.
- **Original contribution**: Independent specification of screenshot-capture inside the live-web-quality architecture, with an evidence class attached to every result.
- **Evidence**: SUPPORTED
- **Decision**: ADD

### accessibility-audit — microsoft/playwright-mcp

- **Source**: public GitHub repository
- **Research date**: 2026-08-30
- **Adopted concept**: Detect WCAG / ARIA violations on a rendered page and report actionable fixes.
- **Reused code**: None
- **Modification**: Not applicable - no upstream code was copied, so there is nothing modified. The capability was re-specified for this plugin.
- **Original contribution**: Independent specification of accessibility-audit inside the live-web-quality architecture, with an evidence class attached to every result.
- **Evidence**: SUPPORTED
- **Decision**: ADD

### visual-review — (combination)

- **Source**: public GitHub repository
- **Research date**: 2026-08-30
- **Adopted concept**: Judge a rendered UI against design intent and report concrete defects.
- **Reused code**: None
- **Modification**: Not applicable - no upstream code was copied, so there is nothing modified. The capability was re-specified for this plugin.
- **Original contribution**: Independent specification of visual-review inside the live-web-quality architecture, with an evidence class attached to every result.
- **Evidence**: INFERRED
- **Decision**: ADD

### capability-router — (none)

- **Source**: original
- **Research date**: 2026-08-30
- **Adopted concept**: (none - designed for this stack)
- **Reused code**: None
- **Modification**: Not applicable.
- **Original contribution**: The selected capabilities come from independent projects with no shared entry point. Without a router the user has to know which source tool answers which request, which is exactly the cost integration is supposed to remove.
- **Evidence**: SUPPORTED
- **Decision**: ADD

### evidence-ledger — (none)

- **Source**: original
- **Research date**: 2026-08-30
- **Adopted concept**: (none - designed for this stack)
- **Reused code**: None
- **Modification**: Not applicable.
- **Original contribution**: Some capabilities entered the stack as concept references or with a non-clean gate result. The ledger keeps that distinction visible at runtime instead of letting the plugin present every result as equally verified.
- **Evidence**: SUPPORTED
- **Decision**: ADD

