# CODEX HANDOFF STATUS

```
STATUS                     READY
CLASSIFICATION             ENVIRONMENT_RESTRICTION  (not a product defect)
INDEPENDENT REVIEW         Pending
v0.1                       FROZEN at fb76b8a
```

## CODEX CLI

**Installed** — `codex-cli 0.151.0`, at `/opt/node22/bin/codex`.

## CODEX PLUGIN

**Installed and enabled** — `codex@openai-codex` v1.0.6, user scope, added from
the `openai/codex-plugin-cc` marketplace. Command surface read from its own
manifest: `/codex:review`, `/codex:adversarial-review`, `/codex:rescue`,
`/codex:transfer`, `/codex:status`, `/codex:result`, `/codex:cancel`,
`/codex:setup`.

## CURRENT ENVIRONMENT CONNECTION

**Blocked.**

| Endpoint | Result |
| --- | --- |
| `api.openai.com:443` | `connect_rejected` — gateway answered **403 to CONNECT** |
| `auth.openai.com:443` | same |
| `chatgpt.com:443` | same |

`codex login status` → **`Not logged in`**. No `~/.codex`. `OPENAI_API_KEY`
unset. Both auth routes the plugin documents — ChatGPT subscription OAuth and
API key — are therefore unavailable here.

## CAUSE

Organization network policy on the execution environment's egress proxy. Not
transient, not a misconfiguration of the plugin, and not fixable from inside
the sandbox. **No further connection attempts will be made from here.**

## PRODUCT IMPACT

**None detected.** The blocker is entirely outside the project: nothing in
`src/` imports, calls or depends on Codex, and the full test matrix passes
unchanged at the freeze commit. This is recorded as `ENVIRONMENT_RESTRICTION`,
not as a product defect.

## INDEPENDENT REVIEW

**Pending.** No party other than the author has reviewed this code. That remains
the single largest limitation on confidence in the release, and it is stated as
such in `README.md`, `FINAL_RELEASE_REPORT.md` and `CODEX_REVIEW_REPORT.md`.
The self-review is **not** promoted to fill the gap.

## REVIEW PACKAGE

**Ready** — `reports/codex-package/`.

| File | Purpose |
| --- | --- |
| `README.md` | Six-step local run instructions |
| `EVIDENCE_MANIFEST.md` | Every required evidence item mapped to its real path |
| `REVIEW_BRIEF.md` | Standard review |
| `PROMPT_ADVERSARIAL.md` | Adversarial — "try to prove this should not ship" |
| `PROMPT_BENCHMARK_AUDIT.md` | Hostile benchmark peer review |
| `PROMPT_SEC_LIC_PROV.md` | Security / licence / provenance |
| `RUN_CODEX_REVIEW.sh` | Bash runner |
| `RUN_CODEX_REVIEW.ps1` | PowerShell runner |
| `import-codex-results.mjs` | Aggregates transcripts into `CODEX_REVIEW_REPORT.md` |

**Anchoring removed.** The prompts contain no confirm-seeking phrasing and no
statement of the author's conclusions — verified by a grep check documented in
the package README, currently returning nothing. The same-task timing figures
are handed over as raw numbers with **no interpretation**, and the prompt asks
the reviewer to decide independently what they support. `FINAL_RELEASE_REPORT.md`
is flagged read-last in the manifest so it cannot anchor the review.

## BASH RUNNER

`bash reports/codex-package/RUN_CODEX_REVIEW.sh` — syntax verified with
`bash -n`. Refuses to run if `codex` is missing or reports `Not logged in`.
Keeps the transcript even when a review fails, so the error is evidence too.

## POWERSHELL RUNNER

`./reports/codex-package/RUN_CODEX_REVIEW.ps1` — same four prompt files, same
four output names, same order, verified by an automated parity check.
`Join-Path` is nested so it also works on Windows PowerShell 5.1.

**Honest limitation:** `pwsh` is not installed in the environment this was
authored in, so the PowerShell script's syntax could **not** be machine-verified.
It was written and reviewed by hand. Run it once on Windows before relying on it.
The Bash runner is machine-verified.

## AUTHENTICATION

**External by design.** No script reads, writes, prints or stores a credential.
No `.env`, key, token, cookie or `~/.codex` content is committed. Secret scan
over all 121 tracked and new files: **clean** — every `OPENAI_API_KEY` mention is
either documentation of its *absence*, the pipe-from-environment guidance, or
the project's own security-gate detection pattern.

## EXPECTED OUTPUT

```
reports/codex-results/
├── standard-review.md
├── adversarial-review.md
├── benchmark-audit.md
└── security-license-provenance-audit.md
```

## HOW TO RETURN RESULTS

1. Run the review in a Codex-connected environment (see the package README).
2. `node reports/codex-package/import-codex-results.mjs` — rewrites
   `CODEX_REVIEW_REPORT.md` with every finding marked **`UNVERIFIED`**.
3. Hand that back to Claude Code for verification.

Each finding is then reproduced and reclassified `CONFIRMED` /
`PARTIALLY_CONFIRMED` / `FALSE_POSITIVE` / `NOT_REPRODUCED` / `OUT_OF_SCOPE` /
`UNKNOWN`. **A finding is not a fact because Codex said it, and not wrong
because the author disagrees.** False positives are documented, not dropped.

Post-import flow: A import · B verify · C fix confirmed CRITICAL/HIGH ·
D full test matrix · E security/licence/provenance audit · F benchmark re-run ·
G PRE/POST comparison · H final release decision.

Any **CRITICAL or HIGH** that verifies as `CONFIRMED` moves the ship decision to
`DO_NOT_SHIP` until fixed and re-verified.

## CURRENT RELEASE STATUS — unchanged until the external review returns

```
BUILD STATUS               CONDITIONAL
IMPROVEMENT VERDICT        REGRESSION (full-capability)
RELEASE READINESS          READY_WITH_KNOWN_TRADEOFFS
SHIP DECISION              SHIP_WITH_LIMITATIONS
INDEPENDENT CODEX REVIEW   NOT_RUN
```

Frozen at `fb76b8a`, with generated-plugin content hashes recorded in
`reports/PRE_EXTERNAL_CODEX_REVIEW.md` and re-verified as matching at handoff.
**No product code will change while this freeze holds.**

## NEXT ACTION

Run the review in a Codex-connected environment:

```bash
codex login && codex login status
bash reports/codex-package/RUN_CODEX_REVIEW.sh     # or the .ps1 on Windows
node reports/codex-package/import-codex-results.mjs
```

Then return `CODEX_REVIEW_REPORT.md` to Claude Code for verification.
