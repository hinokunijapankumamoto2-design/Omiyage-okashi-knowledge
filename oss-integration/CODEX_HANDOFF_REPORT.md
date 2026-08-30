# CODEX HANDOFF REPORT

```
STATUS                     READY
BASELINE COMMIT            04fab5b51b62dbba03d744e50b03ee1ea1c80a33
PRODUCT CODE               FROZEN
CURRENT ENVIRONMENT        BLOCKED
INDEPENDENT REVIEW         PENDING
```

## CODEX CLI

Installed — `codex-cli 0.151.0`.

## CODEX PLUGIN

Installed and enabled — `codex@openai-codex` v1.0.6, user scope, from the
`openai/codex-plugin-cc` marketplace.

## CURRENT ENVIRONMENT

**BLOCKED.**

## BLOCK REASON

Organization network policy on the execution environment's egress proxy.
`api.openai.com`, `auth.openai.com` and `chatgpt.com` all answer **403 to
CONNECT**; `codex login status` reports **Not logged in**; no `~/.codex`;
`OPENAI_API_KEY` unset. Classified `ENVIRONMENT_RESTRICTION` — **not a product
defect**. No further connection attempts are made from here.

## REVIEW PROMPTS

**4 / 4 READY** — standard, adversarial, benchmark audit, security/licence/provenance.

Each carries the read-only rule, the baseline SHA, the finding schema, and an
index of the evidence files.

## ANCHORING AUDIT

**PASS.** No confirm-seeking phrasing, no statement of the author's ship
decision or improvement verdict, no stale benchmark numbers, in any of the four
prompts. Three leaks were found and removed in an earlier pass: two stated
conclusions and one stale timing pair. The same-task figures are now handed over
as raw numbers with **no interpretation attached**, and the reviewer is asked to
decide independently what they support — including whether the sample supports
any directional conclusion at all.

Re-runnable:

```bash
grep -rniE "confirm that|verify .* conclusion|approve|is correct" \\
  reports/codex-package/REVIEW_BRIEF.md reports/codex-package/PROMPT_*.md
```

Returns nothing.

**Adversarial framing is deliberate but not rejection-forcing:** the adversarial
prompt asks the reviewer to try to prove the MVP should not ship, and its verdict
scale explicitly includes *attack failed* and *inconclusive*. An attack that
fails is recorded as evidence.

## FACT / CLAIM SEPARATION

`EVIDENCE_CLASSIFICATION.md` splits everything handed over into `FACT`,
`MEASURED_RESULT`, `CLAIM_TO_AUDIT`, `ASSUMPTION` and `UNKNOWN`. The author's
interpretations are filed as claims — **inputs to the review, not premises of it**
— and `CLAIMS_TO_AUDIT.md` lists ten of them for a
`SUPPORT` / `PARTIALLY_SUPPORT` / `REFUTE` / `NOT_VERIFIED` verdict.

## WINDOWS RUNNER

`reports/codex-package/RUN_CODEX_REVIEW.ps1` — uses existing Codex
authentication, embeds no key, exports no credential, runs no destructive
command, modifies no tracked file, writes only to `reports/codex-results/`.
Stops with `CODEX_NOT_AUTHENTICATED` (exit 3) or `CODEX_CONNECTION_UNAVAILABLE`
(exit 2). `Join-Path` nested so Windows PowerShell 5.1 works.

**Limitation, stated rather than glossed:** `pwsh` is not installed in this
environment, so the PowerShell syntax could **not** be machine-verified. Written
and reviewed by hand, with prompt/output/order and metadata-key parity against
the Bash runner verified automatically. Run it once on Windows before relying on it.

## BASH RUNNER

`reports/codex-package/RUN_CODEX_REVIEW.sh` — same four prompts, same four
output names, same order, same metadata keys, same exit codes. Syntax verified
with `bash -n`. Failure behaviour tested live:

| Condition | Result |
| --- | --- |
| Codex present, not logged in | `ERROR: CODEX_NOT_AUTHENTICATED`, exit **3** |
| Codex absent from PATH | `ERROR: CODEX_CONNECTION_UNAVAILABLE`, exit **2** |
| Either failure | **No files written**, no fallback to an API key |
| Importer with no transcripts | Exit **1**, `CODEX_REVIEW_REPORT.md` left unchanged |

## OUTPUT STRUCTURE

```
reports/codex-results/
├── standard-review.md
├── adversarial-review.md
├── benchmark-audit.md
├── security-license-provenance-audit.md
└── RUN_METADATA.json
```

`RUN_METADATA.json` records timestamp, git commit, baseline commit, codex
version, review package version, benchmark policy version, source tree hash,
runner and failure count. **No credential is ever written.**

## BASELINE LOCK

`reports/codex-package/BASELINE.json` pins `BASELINE_GIT_COMMIT` and a source
tree hash. Both runners compare the working tree against it and warn on drift,
so source that was reviewed is never confused with source that was later fixed.

## READ-ONLY REVIEW

Codex is instructed to `ANALYZE` · `CHALLENGE` · `FIND` · `REPORT` only.
Automatic fixes are out of scope; every change is made afterwards, by the
author, only after independently reproducing the finding.

## SECRET SCAN

**PASS** — 131 tracked and new files. No credential-shaped content, no hardcoded
key assignment, no `~/.codex` copying, no suspicious filenames. Every
`OPENAI_API_KEY` mention is documentation of its absence, pipe-from-environment
guidance, or the project's own security-gate detection pattern.

## PRODUCT CODE CHANGED

**NO.** `src/`, `data/`, `schemas/`, `tests/`, `skills/`, `benchmark/`,
`package.json`, `tsconfig.json` and both generated example plugins are unchanged
since the freeze. Only review prompts, runners, review documentation, result
structure and this report were touched.

## INDEPENDENT REVIEW

**PENDING.** No party other than the author has reviewed this code. That remains
the largest limitation on confidence in the release. The self-review is **not**
promoted to fill the gap.

## CURRENT RELEASE STATUS

```
BUILD STATUS               CONDITIONAL
IMPROVEMENT VERDICT        REGRESSION (full-capability)
RELEASE READINESS          READY_WITH_KNOWN_TRADEOFFS
INDEPENDENT CODEX REVIEW   NOT_RUN
```

## CURRENT SHIP DECISION

```
SHIP_WITH_LIMITATIONS
```

Unchanged, and it stays unchanged until the external review returns. Neither
zero findings nor a single HIGH finding decides it on its own: zero findings
requires checking review completeness first, and a HIGH is reproduced, fixed and
re-verified before any verdict moves.

## NEXT ACTION

Run the Codex package in a Codex-connected environment:

```bash
codex login && codex login status
bash reports/codex-package/RUN_CODEX_REVIEW.sh     # or ./RUN_CODEX_REVIEW.ps1
node reports/codex-package/import-codex-results.mjs
```

Then return `CODEX_REVIEW_REPORT.md` to Claude Code and follow
`reports/codex-package/POST_CODEX_INSTRUCTIONS.md`.
