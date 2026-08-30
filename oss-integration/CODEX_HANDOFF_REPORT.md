# EXTERNAL CODEX REVIEW HANDOFF

```
STATUS                     READY
BASELINE COMMIT            8dc0d5cb23f83914b4151f121cf2e546086191f2
PRODUCT CODE               FROZEN
CURRENT ENVIRONMENT        BLOCKED
INDEPENDENT REVIEW         PENDING
```

## CODEX CLI

`codex-cli 0.151.0` — installed, advanced runtime available.
Installed only; **not authenticated**, and no independent review has been run through it.

## CODEX PLUGIN

Installed and enabled — `codex@openai-codex` v1.0.6, user scope, from the
`openai/codex-plugin-cc` marketplace.

## BLOCK REASON

Organization network policy on the execution environment's egress proxy.
`api.openai.com`, `auth.openai.com` and `chatgpt.com` all answer **403 to
CONNECT**; `codex login status` reports **Not logged in**. `~/.codex` is present
because the Codex CLI was installed, but it holds **no credential material** — no
`auth.json`, no token cache, only local state (sqlite logs, sessions,
`installation_id`). `OPENAI_API_KEY`, `CODEX_API_KEY` and `CODEX_ACCESS_TOKEN` are
unset. Both auth routes the plugin documents are therefore
closed. Classified `ENVIRONMENT_RESTRICTION` — **not a product defect**. No
further connection attempts are made from here.

## EGRESS EVIDENCE (single re-check, not retried)

```
TIMESTAMP       2026-08-30T08:45:51Z
TARGET          https://api.openai.com/v1/models
RESULT          no connection established (curl exit 56)
ERROR / STATUS  CONNECT tunnel failed, response 403
                proxy log: "gateway answered 403 to CONNECT
                (policy denial or upstream failure)"
CLASSIFICATION  ENVIRONMENT_RESTRICTION
```

The cause was already established; this is one confirming observation with a
current timestamp, not a retry loop. `ENVIRONMENT_RESTRICTION` is the correct
classification — this is **not** a Codex product failure.

## BASELINE MODEL — TWO BASELINES, DELIBERATELY

The product baseline was **not** moved after freeze.

```
SOURCE_BASELINE_COMMIT   04fab5b   product source frozen here — immutable
REVIEW_PACKAGE_COMMIT    tag codex-review-package/v1.1.0
                                   documentation-only evidence corrections
SOURCE_TREE_IDENTICAL    YES
```

`04fab5b` remains the immutable product source baseline. The review-package
commit carries documentation-only evidence corrections made after the freeze —
the handoff package itself, and the refresh that replaced the stale `no
~/.codex` statement. The product source tree is verified identical between both
commits, under two independent scopes:

| Scope | At 04fab5b | At review package |
| --- | --- | --- |
| `src data schemas tests package.json tsconfig.json` | `6247cfff…f69c23` | `6247cfff…f69c23` |
| + `skills generated examples benchmark package-lock.json` | `c07efa36…e75b294a` | `c07efa36…e75b294a` |

So Codex reviews **frozen product code plus the latest accurate evidence**. This
is classified `REVIEW_PACKAGE_VERSION_LOCK`, not a baseline relock: overwriting
`SOURCE_BASELINE_COMMIT` with the newer SHA would have erased the record of
where the product was actually frozen, and would have made a documentation
commit look like a product change.

### Why this is better than a single moving baseline

A single `BASELINE_GIT_COMMIT` forces a false choice: either freeze the evidence
along with the code — so Codex reads a package containing a statement now known
to be false — or move the baseline and lose the freeze point. Splitting the two
keeps both true at once, and makes any future product change immediately visible
as a source-hash mismatch rather than being absorbed into a moved baseline.

### Gate logic — content-addressed

Integrity is proved by **content**, not by a commit SHA and not by a tag:

```
A. product source working-tree hash == SOURCE_BASELINE_CONTENT_HASH
B. review package content hash      == REVIEW_PACKAGE_CONTENT_HASH
```

Both must hold, or the gate stops with exit 4. There is no fallback that trusts
`HEAD`, a branch name, or a "documentation-only" judgement.

Two things forced this design, and both are worth recording because each was a
dead end first:

**A commit cannot contain its own SHA.** Recording `review_package_commit` inside
a file that ships in that same commit is self-referential and can never match
`HEAD`. A git tag solves it — the tag lives outside commit content.

**But the tag cannot be pushed.** A local review-package tag was created as an
integrity mechanism, and the remote tag push was rejected by repository
permissions. Requiring it would fail every fresh clone through no fault of its
own. So the tag is downgraded to `OPTIONAL_PROVENANCE_SIGNAL`: its state is
recorded (`ABSENT` / `PRESENT_MATCHES_HEAD` / `PRESENT_DIFFERENT_COMMIT`) and its
absence never fails the gate. The final gate uses deterministic content hashes,
which work in a fresh clone without any remote tag.

Commit SHA and content hash are now separate kinds of evidence:

| | Role |
| --- | --- |
| `SOURCE_BASELINE_COMMIT` `04fab5b` | provenance / history evidence |
| `SOURCE_BASELINE_CONTENT_HASH` | artifact identity evidence — **the gate** |
| review-package tag | optional provenance signal |

**Source hashing uses working-tree file content**, not `git ls-files -s`. The
index-based form was tried first and rejected: it reports staged blobs, so an
uncommitted edit to `src/` passed the gate. That was caught by a negative test,
not by reading the code.

**One hasher, two runners.** `hash-manifest.mjs` is called by both
`RUN_CODEX_REVIEW.sh` and `.ps1`, so there is no second implementation to drift.
`BASELINE.json` and `REVIEW_PACKAGE_MANIFEST.json` are excluded from the package
hash so the manifest cannot contain its own hash.

### Hash model v1 → v2: a corrected claim

An earlier round reported cross-platform parity as `PASS (structural)` on the
grounds that both runners call one hasher. **That reasoning was wrong**, and
testing showed it. One hasher guarantees the same *algorithm*; it says nothing
about the *input*.

v1 hashed raw working-tree bytes. This repository has no `.gitattributes` and
sets no `core.autocrlf`, so Git for Windows applies its default
`core.autocrlf=true` and checks text files out with CRLF, while Linux checks the
same commit out with LF. Measured on the same commit:

| | `autocrlf=false` | `autocrlf=true` |
| --- | --- | --- |
| `src/types.ts` | 12009 bytes, 0 CRLF | 12455 bytes, 446 CRLF |
| v1 source hash | `3da63a6b…fb56a6` | `a8debd75…9769ab` |

A Windows reviewer would have failed the gate on an untouched checkout.

**v2 hashes git-canonical content.** Each file's value is its Git blob id from
`git hash-object --path=<path>`, which applies the same attributes and clean
filters Git would apply when storing it. Identical repository content therefore
hashes identically on every platform, while any real edit — staged, unstaged, or
binary — still changes it. Files marked `-text` or binary are not normalised,
matching Git. `git` is invoked through `execFile`, never a shell.

Verified by hashing two clones of the same commit, `core.autocrlf=false` and
`core.autocrlf=true`, with the same hasher: identical source and package hashes.
v1 is retained in the manifest as a superseded record with the reason.

### The runner itself must check out with LF

Fixing the hash was not enough. In an `autocrlf=true` clone the **runner script**
is written with CRLF and bash refuses to execute it:

```
RUN_CODEX_REVIEW.sh: line 13: $'\r': command not found
RUN_CODEX_REVIEW.sh: line 14: set: pipefail: invalid option name
exit 2
```

That breaks the review under Git Bash and WSL, and it was found by *running* the
runner in such a clone — the hashes were already correct and said nothing about
it.

`oss-integration/.gitattributes` pins exactly one path:

```gitattributes
reports/codex-package/RUN_CODEX_REVIEW.sh text eol=lf
```

Nothing else is normalised, deliberately:

- No `* text=auto` and no `*.ts` / `*.json` rules. Product source is frozen; its
  checkout semantics are not this fix's business, and the v2 canonical hash is
  line-ending independent, so nothing needs them.
- No `*.ps1` rule. PowerShell reads either ending, and a repo-wide rule would
  also reach `install/install.ps1`, outside review scope.
- No `*.mjs` rule. Node executes CRLF scripts correctly — verified, not assumed.

Classified **`REVIEW_INFRASTRUCTURE_FIX`**: it restores the runner's
executability. It is not a product capability or architecture change. It sits
inside the review-package lock because it governs how the runner is checked out,
and it is not a self-reference exclusion because it contains no hash.

### File-set integrity

Hashes cover **tracked** files only. An untracked file dropped into
`reports/codex-package/` was verified **not** to change the package hash — so
the hash alone could not have caught smuggled evidence. Gate 1 now also fails
`FILE_SET_MISMATCH` on any tracked-but-missing file and on any untracked file
inside a scoped directory.

## REVIEW PACKAGE

**READY** — `reports/codex-package/`, 15 files.

## REVIEW PROMPTS

**4 / 4** — standard, adversarial, benchmark audit, security/licence/provenance.
Each carries the read-only rule, the baseline SHA, the finding schema and an
index of the evidence files.

## ANCHORING AUDIT

**PASS.** No confirm-seeking phrasing, no ship decision, no improvement verdict,
no stale benchmark numbers in any prompt. Three leaks were found and removed
earlier: two stated conclusions and one stale timing pair. Same-task figures are
handed over as raw numbers with **no interpretation**.

Adversarial framing is deliberate but **not rejection-forcing**: its verdict
scale includes *attack failed* and *inconclusive*, and a failed attack is
recorded as evidence.

Re-runnable check (prompt files only — the package README describes the check
and would match itself):

```bash
grep -rniE "confirm that|verify .* conclusion|approve|is correct" \\
  reports/codex-package/REVIEW_BRIEF.md reports/codex-package/PROMPT_*.md
```

## FACT / CLAIM CLASSIFICATION

**READY** — `evidence/evidence-classification.md` separates `FACT`,
`MEASURED_RESULT`, `CLAIM_TO_AUDIT`, `ASSUMPTION` and `UNKNOWN`. The author's
interpretations are filed as claims — **inputs to the review, never premises**.

## CLAIMS TO AUDIT

**11** — ten about the product, plus **CLAIM 11**, which asks whether the
available benchmark evidence is even sufficient to support the performance
interpretation drawn from it. Verdict scale: `SUPPORT` / `PARTIALLY_SUPPORT` /
`REFUTE` / `NOT_VERIFIED`, with `NOT_VERIFIED` stated as legitimate.

## BENCHMARK RAW DATA

**PARTIAL**, and the gap is disclosed rather than papered over.

| | |
| --- | --- |
| Per-task evidence | AVAILABLE |
| Per-subject aggregates | AVAILABLE |
| Phase profile | AVAILABLE |
| Rubric per criterion | AVAILABLE |
| **PER_REPEAT_TIMINGS** | **NOT_AVAILABLE** |
| MEAN / MEDIAN / VARIANCE / STDDEV / P50 / P95 / CI | **NOT_COMPUTABLE_FROM_AVAILABLE_DATA** |

Runs used `--repeats 3`, but the harness reduced them to a single median and
discarded the three underlying values. The reported figure *is* a median, yet it
**cannot be recomputed or checked** from the artifacts, and no dispersion
statistic can be derived from it. **Nothing is estimated or back-filled from the
aggregate.** n = 3, one machine, no platform metadata recorded for the timing runs.

## SECURITY EVIDENCE

**READY** — per finding: repository, file, path, matched rule, matched source,
context, classification, rationale, confidence. Includes the two rules
deliberately **narrowed** (`destructive-rm` split; regex dependency rule
replaced by a structured `package.json` check) so the narrowing itself can be
attacked for false negatives, and the scanner's stated blind spots.

## LICENCE EVIDENCE

**READY** — per repository: release, licence **file path**, detected licence,
licence source, reuse classification, conditions. The licence **file** is the
primary evidence, not GitHub metadata; where file and metadata disagree the file
wins. Commit SHAs are recorded as `UNKNOWN` — the API that serves them is
unreachable.

## PROVENANCE EVIDENCE

**READY** — claim, method (artifact-level audit), method detail (8-word shingle
comparison), parameters, result (zero overlap), and explicit limitations:

- Zero shingle overlap **does not prove legal non-copying**.
- It does not detect conceptual or structural reuse.
- It does not prove independent invention.
- It is **one technical signal only**.

## POWERSHELL RUNNER

**READY** — `RUN_CODEX_REVIEW.ps1`. Uses existing Codex authentication, embeds
no key, exports no credential, runs no destructive command, modifies no tracked
file, writes only to `reports/codex-results/`. Stops with
`CODEX_NOT_AUTHENTICATED` (exit 3) or `CODEX_CONNECTION_UNAVAILABLE` (exit 2).
Nested `Join-Path` and no ternary operator, so it runs on Windows PowerShell 5.1
as well as pwsh 7+.

**Limitation, stated not glossed:** `pwsh` is absent from this environment, so
the PowerShell syntax could **not** be machine-verified. Written and reviewed by
hand; prompt/output/order, all 14 metadata keys, per-review status keys and exit
codes verified identical to the Bash runner automatically. Run it once on
Windows before relying on it.

## BASH RUNNER

**READY** — `RUN_CODEX_REVIEW.sh`, `bash -n` verified. Failure behaviour tested
live in this blocked environment:

| Condition | Result |
| --- | --- |
| Codex present, not logged in | `ERROR: CODEX_NOT_AUTHENTICATED`, exit **3** |
| Codex absent from PATH | `ERROR: CODEX_CONNECTION_UNAVAILABLE`, exit **2** |
| Either failure | **No transcript, no metadata written**; no API-key fallback |
| Importer with no transcripts | exit **1**, `CODEX_REVIEW_REPORT.md` unchanged |

## RESULT SCHEMA

**READY** — `FINDING_SCHEMA.md`: ID, REVIEW_TYPE, SEVERITY, CATEGORY,
CLAIM_ATTACKED, FINDING, EVIDENCE, FILE, LINE, REPRODUCTION, EXPECTED, ACTUAL,
IMPACT, CONFIDENCE, RECOMMENDATION. Severity `CRITICAL` / `HIGH` / `MEDIUM` /
`LOW` / `INFO`.

## RUN METADATA

**READY** — `reports/codex-results/RUN_METADATA.json`, 14 keys: timestamp,
status (`COMPLETE`/`INCOMPLETE`), git_commit, baseline_git_commit,
baseline_mismatch, codex_version, review_package_version,
benchmark_policy_version, source_tree_hash, runner_type, runner, platform,
per-review results, reviews_failed.

Review completeness is tracked individually: each review starts `NOT_RUN` and
only becomes `PASS` on a clean exit, so an interrupted run cannot be mistaken
for a complete one. A failed review also gets an `INCOMPLETE` marker written
into its own transcript. **No credential is ever written.**

## BASELINE LOCK

`reports/codex-package/BASELINE.json` pins `BASELINE_GIT_COMMIT` and a source
tree hash. Both runners compare the working tree against it and record
`baseline_mismatch` plus a `BASELINE_MISMATCH` warning on drift, so reviewed
source is never confused with later-fixed source.

## READ-ONLY GUARANTEE

Codex is instructed to `READ` · `ANALYZE` · `CHALLENGE` · `REPORT` only. No
`EDIT`, `WRITE`, `COMMIT`, `PUSH` or auto-fix. Every change is made afterwards,
by the author, only after independently reproducing the finding.

## SECRET SCAN

```
STATUS              PASS
REAL SECRETS FOUND  0
```

Documentation examples are distinguished from real secrets: every
`OPENAI_API_KEY` occurrence is either a statement that no key is set, the
pipe-from-environment guidance (`printenv OPENAI_API_KEY | codex login`), or
the project's own security-gate detection pattern. No `~/.codex` credential
content, auth token, cookie or session material exists to copy, and none is
copied: `~/.codex` was searched by filename and contains no `auth.json` and no
token cache. Secret values are never printed or stored — presence is recorded,
values are not.

## PRODUCT CODE CHANGED

**NO.** `src/`, `generated plugin implementation`, `core capability logic`,
`security engine`, `licence engine`, `benchmark implementation`, `schemas/`,
`tests/`, `skills/` and both generated example plugins are unchanged since the
freeze. Only review prompts, the evidence package, runners, result schema,
handoff documentation and the README link were touched.

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
zero findings nor a single HIGH decides it alone: zero findings requires
checking review completeness first (`RUN_METADATA.json` → `status` and the
per-review results), and a HIGH is reproduced, fixed and re-verified before any
verdict moves.

## NEXT ACTION

Run the review package in a Codex-connected environment:

```bash
codex login && codex login status
bash reports/codex-package/RUN_CODEX_REVIEW.sh     # or ./RUN_CODEX_REVIEW.ps1
node reports/codex-package/import-codex-results.mjs
```

Then return `CODEX_REVIEW_REPORT.md` to Claude Code and follow
`reports/codex-package/POST_CODEX_INSTRUCTIONS.md`.
