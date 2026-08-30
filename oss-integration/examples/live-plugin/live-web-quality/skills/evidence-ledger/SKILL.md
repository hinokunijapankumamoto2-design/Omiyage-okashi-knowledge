---
name: evidence-ledger
description: Record what was measured versus assumed for each capability result, and refuse to report an unmeasured claim as a fact.
---

# Evidence Ledger

Every result this plugin reports carries an evidence class. This skill assigns
it and refuses to let a weaker one be presented as a stronger one.

## Classes

| Class | Means |
| --- | --- |
| VERIFIED | An executable check ran in this session and passed. |
| SUPPORTED | Source, a reproducible example, or official documentation backs it. |
| INFERRED | Derived from indirect signal. |
| CLAIMED | Only a README or a tool's own description says so. |
| UNKNOWN | Not established. Say UNKNOWN; do not fill it in. |

## Capability posture inherited from the build

| Capability | Evidence at selection | Security gate | Licence posture |
| --- | --- | --- | --- |
| image-comparison | SUPPORTED | CONDITIONAL | REUSE_WITH_CONDITIONS |
| visual-regression | SUPPORTED | CONDITIONAL | REUSE_WITH_CONDITIONS |
| performance-audit | SUPPORTED | CONDITIONAL | REUSE_WITH_CONDITIONS |
| testing | SUPPORTED | PASS | REUSE_WITH_CONDITIONS |
| browser-automation | SUPPORTED | PASS | REUSE_WITH_CONDITIONS |
| screenshot-capture | SUPPORTED | PASS | REUSE_WITH_CONDITIONS |
| accessibility-audit | SUPPORTED | PASS | REUSE_WITH_CONDITIONS |
| visual-review | INFERRED | PASS | REUSE_OK |

## Rules

1. A capability that did not run this session cannot report VERIFIED.
2. A capability whose security gate is not PASS must have that stated in the
   output whenever its result is used.
3. Never present a REFERENCE_ONLY capability as if this plugin contains the
   upstream implementation. It contains an independent implementation of the
   idea, or a call out to the upstream tool.
4. Contradiction between two capabilities is reported, not reconciled.
