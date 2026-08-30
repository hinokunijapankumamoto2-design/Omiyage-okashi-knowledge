# Security evidence

Enough detail to audit the **rules themselves**, not only their verdicts. Every
row below is a real finding from the committed live run.

## Gate results, live run

| Repository | Artifacts scanned | Gate | Findings | In final stack |
| --- | --- | --- | --- | --- |
| `dequelabs/axe-core` | 28 | REVIEW_REQUIRED | 1 | no |
| `americanexpress/jest-image-snapshot` | 11 | CONDITIONAL | 1 | yes |
| `GoogleChrome/lighthouse` | 63 | CONDITIONAL | 2 | yes |
| `microsoft/playwright` | 4 | PASS | 0 | yes |
| `microsoft/playwright-mcp` | 8 | PASS | 0 | yes |
| `pa11y/pa11y` | 18 | PASS | 0 | no |
| `reshotdev/screenshot` | 63 | **BLOCK** | 2 | no |
| 4 discovered repositories | 0 | **UNKNOWN** | 0 | no |

Full table, including every discovered repository, in each build's
`SECURITY_REPORT.md`.

## Findings with matched rule, source and context

Each finding records the matched rule, the file, and the matched excerpt. Two
worth attacking specifically:

**`dequelabs/axe-core` — high, `arbitrary-command-execution`**
- Rule: `arbitrary-eval: Evaluates code at runtime.`
- File: `npm:package/axe.min.js`
- Matched: ``t,text:n}}),r in o||(o[r]=n)):new Function("def","def['"+r+"']="+n)(o)),``
- Rationale: `new Function` constructs code at runtime.
- **Audit question:** is flagging a minified vendor bundle a false positive, and
  does the resulting `REVIEW_REQUIRED` correctly exclude axe-core from the
  stack, or wrongly?

**`americanexpress/jest-image-snapshot` — medium, `destructive-file-operations`**
- Rule: `recursive-force-delete: Recursive force delete whose target path was not evaluated by this scan.`
- File: `npm:package/src/diff-snapshot.js`
- Matched: ``fs.rmSync(receivedSnapshotPath, { recursive: true, force: true })``
- Rationale: recursive+force delete of a path this scan does not evaluate.
- **Audit question:** this rule was deliberately **narrowed**. It previously
  fired `critical` on any recursive+force delete and BLOCKed this dependency;
  it was split so only a broad literal path (`/`, `~`, `$HOME`, `*`) is
  critical. Was that narrowing correct, or does it now miss a real case?

## Rules to audit directly

`src/security/gate.ts`. Ten risk categories; nine pattern rules plus a
structured `package.json` inspection covering suspicious dependencies and
install scripts.

Two deliberate changes to attack:

1. **`destructive-rm` was split** into a critical broad-path rule and a medium
   "path not evaluated" rule. False negative introduced?
2. **A regex dependency rule was replaced** by a structured `package.json`
   check, because the regex fired on any value starting with `http://` —
   including author URLs. Does the structured check miss cases the regex caught?

## Invariants that should hold — verify or refute

- Scanning zero artifacts yields `UNKNOWN`, **never** `PASS`.
- `UNKNOWN` is never treated as safe anywhere downstream.
- A `BLOCK` outranks any Scout Score.
- The shared browser and cached axe-core source leak no state between subjects
  (asserted by the cache-safety test in `tests/real-task.test.ts` — audit the
  test as well as the code).

## Known scanner limits, stated rather than discovered

Static pattern matching over fetched text. It does **not** attempt obfuscated
code, base64 payloads, dynamic `import()`, prototype pollution, ReDoS,
homoglyphs, or install-time network fetches. `src/repository/tar.ts` reads
archive entries **into memory only** and never writes them to disk — confirm
that, and say whether path-traversal handling is nonetheless required.
