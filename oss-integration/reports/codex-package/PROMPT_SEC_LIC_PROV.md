# Security / Licence / Provenance audit

Audit these three independently. **Do not assume the current gates are correct.**

## Security — `src/security/gate.ts`, `src/repository/live-fetch.ts`

- Are BLOCK conditions too broad (false positives that would reject safe code)
  or too weak (false negatives)?
- Two rules were deliberately narrowed: `destructive-rm` was split into a
  broad-path critical rule and a medium rule, and a regex dependency rule was
  replaced by a structured `package.json` check. **Independently determine
  whether either narrowing created a false negative.**
- Is `UNKNOWN` ever treated as safe, anywhere in the pipeline?
- The task suite shares one browser across subjects and caches the axe-core
  source. Can that leak state, credentials or a measurement between subjects?
  Is the cache invalidated correctly?
- What classes of attack does the scanner miss entirely? Obfuscation, base64,
  dynamic `import()`, path traversal, prototype pollution, ReDoS, homoglyphs,
  install-time network fetches.
- Does anything execute downloaded code? Trace the tarball path in
  `src/repository/tar.ts` — is extraction safe against path traversal
  (`../`, absolute paths, symlinks) and zip-bomb style inputs?

## Licence — `src/license/gate.ts`

- Are the conditions attached to each SPDX identifier actually correct?
- MPL-2.0 is classified `REUSE_WITH_CONDITIONS` with file-level copyleft;
  LGPL-3.0-only is `LEGAL_REVIEW`. Are those readings defensible?
- Can an `UNKNOWN` or `NONE` licence reach any code-copying path?
- Is a licence ever inferred rather than read? Where does the identifier come
  from, and what happens when the licence file and the package metadata disagree?

## Provenance — `src/builder/plugin-builder.ts`, `tests/provenance-audit.test.ts`

- Is the `Reused Code: None` claim actually supported by the audit, or does the
  audit have a hole? What would it fail to catch?
- Can every generated component be traced to its source inspiration?
- Is attribution complete for concept-only sources?
- Are the "original contribution" claims supportable, or is any of them a
  rename or a wrapper?

## Output

Per finding: `FINDING / SEVERITY / EVIDENCE / FILE:LINE / IMPACT /
RECOMMENDED ACTION / CONFIDENCE`.
