# Codex review results — drop zone

The four runners write here:

```
standard-review.md
adversarial-review.md
benchmark-audit.md
security-license-provenance-audit.md
```

Transcripts are **raw Codex output**. Do not edit them: they are the evidence.
Corrections and disagreements belong in `CODEX_REVIEW_REPORT.md`, alongside the
finding they refer to.

Once the files are here:

```bash
node reports/codex-package/import-codex-results.mjs
```

That aggregates every finding into `CODEX_REVIEW_REPORT.md` with each one marked
`UNVERIFIED`. Nothing is treated as correct on arrival — Codex can be wrong, and
so can the author. Each finding is then reproduced and reclassified as
`CONFIRMED` / `PARTIALLY_CONFIRMED` / `FALSE_POSITIVE` / `NOT_REPRODUCED` /
`OUT_OF_SCOPE` / `UNKNOWN`.
