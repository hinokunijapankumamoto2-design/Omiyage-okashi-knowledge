# After the Codex review returns

Hand this file to Claude Code together with `CODEX_REVIEW_REPORT.md`.

**Nothing in `src/` changes until step 5.** The product is frozen until findings
have been reproduced.

---

### 1. Verify the baseline SHA

Compare `reports/codex-results/RUN_METADATA.json` → `git_commit` against
`reports/codex-package/BASELINE.json` → `BASELINE_GIT_COMMIT`.

If they differ, the review examined **different source than the freeze**. Say so
explicitly and diff the two before treating any finding as applying to the
current tree.

### 2. Read all four Codex results

`standard-review.md`, `adversarial-review.md`, `benchmark-audit.md`,
`security-license-provenance-audit.md`. Read the transcripts, not just the
aggregate — the importer is forgiving and may have merged or missed a block.

Also read the verdicts on `CLAIMS_TO_AUDIT.md`: a claim marked `REFUTE` or
`PARTIALLY_SUPPORT` is a finding even if it was not filed as one.

### 3. Aggregate

```bash
node reports/codex-package/import-codex-results.mjs
```

Every finding lands as `UNVERIFIED`. Cross-check the count against the
transcripts by hand.

### 4. Reproduce every finding

For each, independently:

- Write the reproduction as a **failing test or a runnable command** where
  possible. A finding you cannot reproduce is not confirmed.
- Record `EXPECTED` vs `ACTUAL` from your own run, not from Codex's report.

Classify:

| Class | Meaning |
| --- | --- |
| `CONFIRMED` | Reproduced. Real. |
| `PARTIALLY_CONFIRMED` | The defect is real but narrower than described. State the true scope. |
| `FALSE_POSITIVE` | Reproduced the scenario; the behaviour is correct. **Record finding, why false, and evidence.** |
| `NOT_REPRODUCED` | Could not reproduce. Say what you tried. Not the same as false. |
| `OUT_OF_SCOPE` | Real, but a v0.2 feature request rather than a v0.1 defect. |
| `UNKNOWN` | Insufficient information. Say what would settle it. |

**A finding is not a fact because Codex said it, and not wrong because the
author disagrees. Evidence decides.** Do not fix a false positive to be
agreeable, and do not dismiss a true finding to protect a verdict.

### 5. Fix only confirmed, release-relevant findings

Priority: CRITICAL security/licence → core correctness → benchmark validity →
provenance integrity → unsafe behaviour → HIGH architecture → HIGH
reproducibility → MEDIUM affecting the goal → LOW only if cheap and safe.

| Severity | Policy |
| --- | --- |
| `CRITICAL` / `HIGH`, CONFIRMED | Fix in v0.1. Ship decision is `DO_NOT_SHIP` until fixed and re-verified. |
| `MEDIUM` | v0.1 **only** if it materially affects goal, security, benchmark validity or provenance. Otherwise `V0.2_BACKLOG.md`. |
| `LOW` | v0.2 by default. |
| Feature requests (web UI, SaaS, more agents, vector DB) | `REJECT` or `V0.2_BACKLOG` — v0.1 scope is frozen. |

Record per fix in `CHANGELOG.md`: FINDING · ROOT CAUSE · CHANGE · TEST ·
RESULT · REGRESSION RISK.

**Do not polish v0.1 indefinitely.**

### 6–9. Re-verify

```bash
npm run verify                                             # build + offline tests
OSS_LIVE_TEST=1  node --test "dist/tests/live-repository.test.js"
OSS_REAL_TASK=1  node --test "dist/tests/real-task.test.js"
```

Then re-run both reference builds, and re-run the security, licence and
provenance audits. A fix that worsens a security or licence gate is **rejected**,
whatever it does for a metric.

### 10. Compare PRE / POST

Against `reports/PRE_EXTERNAL_CODEX_REVIEW.md`. Record PRE, POST and DELTA for
every metric. **Do not overwrite the frozen baseline.** A regression introduced
by a fix is disclosed, not absorbed.

### 11. Issue a new release verdict

Separately, as three axes:

```
BUILD STATUS          PASS | CONDITIONAL | FAIL
IMPROVEMENT VERDICT   IMPROVED | EQUIVALENT | REGRESSION | NOT_VERIFIED
RELEASE READINESS     READY | READY_WITH_KNOWN_TRADEOFFS | NOT_READY
SHIP DECISION         SHIP | SHIP_WITH_LIMITATIONS | DO_NOT_SHIP
```

Two traps to avoid, in both directions:

- **Zero findings does not equal SHIP.** Check review completeness first: did
  all four reviews run, did they reach the artifacts, are the transcripts
  substantive? A review that failed to load the code produces zero findings too.
- **One HIGH is not permanent failure.** Reproduce, fix, re-verify, then decide.

Update `README.md` to state **Independent Codex Review: Completed** — only if it
genuinely ran.
