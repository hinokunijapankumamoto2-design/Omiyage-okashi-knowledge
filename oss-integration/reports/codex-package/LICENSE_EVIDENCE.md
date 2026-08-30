# Licence evidence

Licence identification does **not** rely on GitHub metadata. Where a licence
file and package metadata disagree, the file wins. Verify that in
`src/repository/live-fetch.ts` (`resolveLicense`, `spdxFromText`).

## Selected upstreams, live run

| Repository | Release | Licence file fetched | Detected | Classification | Conditions |
| --- | --- | --- | --- | --- | --- |
| `americanexpress/jest-image-snapshot` | 6.5.2 | `LICENSE.txt` | Apache-2.0 | `REUSE_WITH_CONDITIONS` | retain copyright, licence and NOTICE; state significant changes |
| `GoogleChrome/lighthouse` | 13.4.1 | `LICENSE` | Apache-2.0 | `REUSE_WITH_CONDITIONS` | as above |
| `microsoft/playwright` | (npm latest) | `LICENSE` | Apache-2.0 | `REUSE_WITH_CONDITIONS` | as above |
| `microsoft/playwright-mcp` | (npm latest) | `LICENSE` | Apache-2.0 | `REUSE_WITH_CONDITIONS` | as above |

## Considered, not selected

| Repository | Detected | Classification | Why it matters |
| --- | --- | --- | --- |
| `dequelabs/axe-core` | MPL-2.0 | `REUSE_WITH_CONDITIONS`, gate `CONDITIONAL` | File-level copyleft: a copied or modified file stays MPL and its source must be offered. Avoided by not vendoring. |
| `pa11y/pa11y` | LGPL-3.0-only | `LEGAL_REVIEW`, gate `REVIEW_REQUIRED` | Linking obligations. Selecting it would have reduced the upstream project count — it was **not** selected, and that decision is `DECISIONS.md` D1. |

Exact commit SHAs are `UNKNOWN`: the GitHub API that serves them is unreachable
from the build environment. Releases are npm `dist-tags.latest` at fetch time.
**Audit whether a release tag is a sufficient version anchor for a licence
determination.**

## Classification table to audit

`src/license/gate.ts`, 12 SPDX rules.

| Identifier | Policy | Gate | May copy? |
| --- | --- | --- | --- |
| MIT, Apache-2.0, BSD-2/3-Clause, ISC | `REUSE_WITH_CONDITIONS` | PASS | yes |
| MPL-2.0 | `REUSE_WITH_CONDITIONS` | CONDITIONAL | yes, file-level copyleft |
| LGPL-3.0-only/-or-later, GPL-3.0-only, AGPL-3.0-only | `LEGAL_REVIEW` | REVIEW_REQUIRED | **no** |
| `NONE` (no licence granted) | `BLOCK` | BLOCK | **no** |
| `UNKNOWN` (not observed) | `REFERENCE_ONLY` | UNKNOWN | **no** |

## Questions

1. Are the conditions attached to each identifier legally accurate?
2. Can an `UNKNOWN` or `NONE` licence reach any code-copying path? Trace
   `mayCopyCode()`.
3. Evidence downgrade: a permissive licence backed only by a `CLAIMED`-class
   evidence is downgraded to `REFERENCE_ONLY`. Correct, or over-cautious?
4. `zz-plant/ambit` is MIT but pinned `REFERENCE_ONLY` by project policy
   regardless. Is a policy stricter than the licence recorded honestly?
5. Nothing is vendored, so most conditions are never triggered. Is the reasoning
   in `DECISIONS.md` D2 sound?
