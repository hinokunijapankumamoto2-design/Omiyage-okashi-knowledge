Independently audit SECURITY, LICENCE and PROVENANCE. Do not assume the current
gates are correct.

SECURITY — read `src/security/gate.ts`:
- Are BLOCK conditions too broad or too weak? Two rules were deliberately
  narrowed (`destructive-rm` split; the regex dependency rule replaced by a
  structured `package.json` check). Verify those narrowings did not create
  false negatives.
- Is UNKNOWN ever treated as safe, anywhere in the pipeline?
- Does the shared browser or the cached axe-core source create state leakage
  or cache contamination between subjects?
- What does the scanner miss entirely? (obfuscation, base64, dynamic import,
  prototype pollution, path traversal, ReDoS)

LICENCE — read `src/license/gate.ts`:
- Are the conditions attached to each SPDX id actually correct?
- MPL-2.0 is treated as file-level copyleft and avoided by not vendoring;
  LGPL-3.0-only is LEGAL_REVIEW. Are those readings right?
- Can an UNKNOWN licence reach a code-copying path?

PROVENANCE — read `src/builder/plugin-builder.ts` and
`tests/provenance-audit.test.ts`:
- Is `Reused Code: None` actually supported by the audit, or does the audit
  have a hole?
- Can every generated component be traced to its source inspiration?
- Is attribution complete for concept-only sources?
