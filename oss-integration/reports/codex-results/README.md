# Codex review results

These files contain **independent Codex review outputs**.

```
standard-review.md
adversarial-review.md
benchmark-audit.md
security-license-provenance-audit.md
RUN_METADATA.json
```

**Do not treat findings as automatically correct.**

Claude must reproduce and classify each finding as:

```
CONFIRMED
PARTIALLY_CONFIRMED
FALSE_POSITIVE
NOT_REPRODUCED
OUT_OF_SCOPE
UNKNOWN
```

A finding is not a fact because Codex said it, and not wrong because the author
disagrees. Evidence decides. False positives are **documented** — finding, why
false, evidence — never silently dropped.

## Rules

- Transcripts are raw output and are the evidence of record. **Do not edit
  them.** Disagreements belong in `CODEX_REVIEW_REPORT.md` beside the finding.
- `RUN_METADATA.json` records the commit the review actually examined. Check it
  against `reports/codex-package/BASELINE.json` before acting on any finding.
- No credential is ever written here.

## Next step

```bash
node reports/codex-package/import-codex-results.mjs
```

Then follow `reports/codex-package/POST_CODEX_INSTRUCTIONS.md`.
