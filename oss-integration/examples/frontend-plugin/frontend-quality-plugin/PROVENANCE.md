# PROVENANCE — frontend-quality-plugin

Generated 2026-08-30 by `oss-integrate build`.

**Reused code: None.** This plugin contains no third-party source. Every file
was generated from the analysis result. Where a capability was inspired by an
upstream project, that project is credited below as a *concept* source, and the
plugin either invokes the upstream tool as an external process or implements
the idea independently.

## Summary

| Capability | Repository | Author | Licence posture | Version | Evidence | Decision | Reused code | Generated component |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| frontend-implementation | fixture-org/frontend-craft-plugin | fixture-org | REUSE_WITH_CONDITIONS | v1.4.0 | VERIFIED | KEEP | None | build-surface |
| visual-design | fixture-org/frontend-craft-plugin | fixture-org | REUSE_WITH_CONDITIONS | v1.4.0 | SUPPORTED | KEEP | None | build-surface |
| responsive-design | fixture-org/frontend-craft-plugin | fixture-org | REUSE_WITH_CONDITIONS | v1.4.0 | SUPPORTED | KEEP | None | build-surface |
| browser-automation | fixture-org/browser-qa-plugin | fixture-org | REUSE_WITH_CONDITIONS | v0.9.2 | VERIFIED | KEEP | None | verification-runner, verification-agent |
| screenshot-capture | fixture-org/browser-qa-plugin | fixture-org | REUSE_WITH_CONDITIONS | v0.9.2 | SUPPORTED | KEEP | None | verification-runner, verification-agent |
| testing | fixture-org/browser-qa-plugin | fixture-org | REUSE_WITH_CONDITIONS | v0.9.2 | SUPPORTED | KEEP | None | verification-runner, verification-agent |
| accessibility-audit | GoogleChrome/lighthouse | GoogleChrome | REUSE_WITH_CONDITIONS | UNKNOWN | SUPPORTED | REMOVE | None | verification-runner, verification-agent |
| performance-audit | GoogleChrome/lighthouse | GoogleChrome | REUSE_WITH_CONDITIONS | UNKNOWN | SUPPORTED | ADD | None | verification-runner, verification-agent |
| image-comparison | americanexpress/jest-image-snapshot | americanexpress | REUSE_WITH_CONDITIONS | UNKNOWN | SUPPORTED | ADD | None | verification-runner, verification-agent |
| visual-regression | americanexpress/jest-image-snapshot | americanexpress | REUSE_WITH_CONDITIONS | UNKNOWN | SUPPORTED | ADD | None | verification-runner, verification-agent |
| visual-review | (combination) | (combination) | REUSE_OK | UNKNOWN | INFERRED | ADD | None | review-agent |
| capability-router | (none) | this project | MIT (this project) | UNKNOWN | SUPPORTED | ADD | None | skills/capability-router/SKILL.md |
| namespace-guard | (none) | this project | MIT (this project) | UNKNOWN | SUPPORTED | ADD | None | skills/namespace-guard/SKILL.md |
| evidence-ledger | (none) | this project | MIT (this project) | UNKNOWN | SUPPORTED | ADD | None | skills/evidence-ledger/SKILL.md |

## Detail

### frontend-implementation — fixture-org/frontend-craft-plugin

- **Source**: local fixture
- **Research date**: 2026-08-30
- **Adopted concept**: Write and modify HTML/CSS/JS or component-framework code for a web UI.
- **Reused code**: None
- **Modification**: Not applicable - no upstream code was copied, so there is nothing modified. The capability was re-specified for this plugin.
- **Original contribution**: Independent specification of frontend-implementation inside the frontend-quality-plugin architecture, with an evidence class attached to every result.
- **Evidence**: VERIFIED
- **Decision**: KEEP

### visual-design — fixture-org/frontend-craft-plugin

- **Source**: local fixture
- **Research date**: 2026-08-30
- **Adopted concept**: Produce and critique layout, typography, colour and visual hierarchy decisions.
- **Reused code**: None
- **Modification**: Not applicable - no upstream code was copied, so there is nothing modified. The capability was re-specified for this plugin.
- **Original contribution**: Independent specification of visual-design inside the frontend-quality-plugin architecture, with an evidence class attached to every result.
- **Evidence**: SUPPORTED
- **Decision**: KEEP

### responsive-design — fixture-org/frontend-craft-plugin

- **Source**: local fixture
- **Research date**: 2026-08-30
- **Adopted concept**: Make a UI correct across viewport sizes and input modalities.
- **Reused code**: None
- **Modification**: Not applicable - no upstream code was copied, so there is nothing modified. The capability was re-specified for this plugin.
- **Original contribution**: Independent specification of responsive-design inside the frontend-quality-plugin architecture, with an evidence class attached to every result.
- **Evidence**: SUPPORTED
- **Decision**: KEEP

### browser-automation — fixture-org/browser-qa-plugin

- **Source**: local fixture
- **Research date**: 2026-08-30
- **Adopted concept**: Drive a real browser programmatically: navigate, interact, evaluate, and read page state.
- **Reused code**: None
- **Modification**: Not applicable - no upstream code was copied, so there is nothing modified. The capability was re-specified for this plugin.
- **Original contribution**: Independent specification of browser-automation inside the frontend-quality-plugin architecture, with an evidence class attached to every result.
- **Evidence**: VERIFIED
- **Decision**: KEEP

### screenshot-capture — fixture-org/browser-qa-plugin

- **Source**: local fixture
- **Research date**: 2026-08-30
- **Adopted concept**: Capture deterministic page or element screenshots at defined viewports.
- **Reused code**: None
- **Modification**: Not applicable - no upstream code was copied, so there is nothing modified. The capability was re-specified for this plugin.
- **Original contribution**: Independent specification of screenshot-capture inside the frontend-quality-plugin architecture, with an evidence class attached to every result.
- **Evidence**: SUPPORTED
- **Decision**: KEEP

### testing — fixture-org/browser-qa-plugin

- **Source**: local fixture
- **Research date**: 2026-08-30
- **Adopted concept**: Define and execute automated tests, and report pass/fail with reproducible output.
- **Reused code**: None
- **Modification**: Not applicable - no upstream code was copied, so there is nothing modified. The capability was re-specified for this plugin.
- **Original contribution**: Independent specification of testing inside the frontend-quality-plugin architecture, with an evidence class attached to every result.
- **Evidence**: SUPPORTED
- **Decision**: KEEP

### accessibility-audit — GoogleChrome/lighthouse

- **Source**: public GitHub repository
- **Research date**: 2026-08-30
- **Adopted concept**: Detect WCAG / ARIA violations on a rendered page and report actionable fixes.
- **Reused code**: None
- **Modification**: Not applicable - no upstream code was copied, so there is nothing modified. The capability was re-specified for this plugin.
- **Original contribution**: Independent specification of accessibility-audit inside the frontend-quality-plugin architecture, with an evidence class attached to every result.
- **Evidence**: SUPPORTED
- **Decision**: REMOVE

### performance-audit — GoogleChrome/lighthouse

- **Source**: public GitHub repository
- **Research date**: 2026-08-30
- **Adopted concept**: Measure loading and runtime performance metrics for a page and report regressions.
- **Reused code**: None
- **Modification**: Not applicable - no upstream code was copied, so there is nothing modified. The capability was re-specified for this plugin.
- **Original contribution**: Independent specification of performance-audit inside the frontend-quality-plugin architecture, with an evidence class attached to every result.
- **Evidence**: SUPPORTED
- **Decision**: ADD

### image-comparison — americanexpress/jest-image-snapshot

- **Source**: public GitHub repository
- **Research date**: 2026-08-30
- **Adopted concept**: Diff two images pixel-wise or perceptually and produce a pass/fail with a diff artifact.
- **Reused code**: None
- **Modification**: Not applicable - no upstream code was copied, so there is nothing modified. The capability was re-specified for this plugin.
- **Original contribution**: Independent specification of image-comparison inside the frontend-quality-plugin architecture, with an evidence class attached to every result.
- **Evidence**: SUPPORTED
- **Decision**: ADD

### visual-regression — americanexpress/jest-image-snapshot

- **Source**: public GitHub repository
- **Research date**: 2026-08-30
- **Adopted concept**: Detect unintended visual change between a baseline and the current build.
- **Reused code**: None
- **Modification**: Not applicable - no upstream code was copied, so there is nothing modified. The capability was re-specified for this plugin.
- **Original contribution**: Independent specification of visual-regression inside the frontend-quality-plugin architecture, with an evidence class attached to every result.
- **Evidence**: SUPPORTED
- **Decision**: ADD

### visual-review — (combination)

- **Source**: public GitHub repository
- **Research date**: 2026-08-30
- **Adopted concept**: Judge a rendered UI against design intent and report concrete defects.
- **Reused code**: None
- **Modification**: Not applicable - no upstream code was copied, so there is nothing modified. The capability was re-specified for this plugin.
- **Original contribution**: Independent specification of visual-review inside the frontend-quality-plugin architecture, with an evidence class attached to every result.
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

### namespace-guard — (none)

- **Source**: original
- **Research date**: 2026-08-30
- **Adopted concept**: (none - designed for this stack)
- **Reused code**: None
- **Modification**: Not applicable.
- **Original contribution**: Sources collided on names that the host resolves globally. The guard owns the single public surface and refuses to re-emit a source-specific duplicate.
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

