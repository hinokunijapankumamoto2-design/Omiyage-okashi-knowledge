# Codex independent review — how to run it

The review could not run in the environment this package was built in: OpenAI
endpoints are blocked there by organization network policy. Everything needed to
run it elsewhere is in this directory.

**Authentication stays external.** No script here reads, writes, prints or
stores a credential, and none is committed to this repository.

---

## 1. Confirm Codex is installed

```bash
codex --version
```

If it is missing:

```bash
npm install -g @openai/codex
```

## 2. Log in, if you are not already

```bash
codex login
```

Uses your existing ChatGPT subscription (Free tier included). If you would
rather use an API key, pipe it in — never paste it into a file:

```bash
# bash
printenv OPENAI_API_KEY | codex login --with-api-key
```
```powershell
# PowerShell
$env:OPENAI_API_KEY | codex login --with-api-key
```

## 3. Confirm login

```bash
codex login status
```

Must not say `Not logged in`.

## 4. Run the independent review

From the repository root:

```bash
# bash / macOS / Linux / WSL
bash reports/codex-package/RUN_CODEX_REVIEW.sh
```
```powershell
# Windows PowerShell
./reports/codex-package/RUN_CODEX_REVIEW.ps1
```

Both runners execute the **same four reviews from the same four prompt files**
in the same order, and write the same four output names.

| # | Review | Prompt | Output |
| --- | --- | --- | --- |
| 1 | Standard | `REVIEW_BRIEF.md` | `standard-review.md` |
| 2 | Adversarial | `PROMPT_ADVERSARIAL.md` | `adversarial-review.md` |
| 3 | Benchmark audit | `PROMPT_BENCHMARK_AUDIT.md` | `benchmark-audit.md` |
| 4 | Security / licence / provenance | `PROMPT_SEC_LIC_PROV.md` | `security-license-provenance-audit.md` |

## 5. Confirm results exist

```
reports/codex-results/
├── standard-review.md
├── adversarial-review.md
├── benchmark-audit.md
└── security-license-provenance-audit.md
```

## 6. Return the results

Aggregate them:

```bash
node reports/codex-package/import-codex-results.mjs
```

This rewrites `CODEX_REVIEW_REPORT.md` with every finding marked **`UNVERIFIED`**,
then hand that back to Claude Code for verification.

---

## What happens next, and what must not

Each finding is independently reproduced and reclassified:

`CONFIRMED` · `PARTIALLY_CONFIRMED` · `FALSE_POSITIVE` · `NOT_REPRODUCED` ·
`OUT_OF_SCOPE` · `UNKNOWN`

- A finding is **not** a fact because Codex said it, and **not** wrong because
  the author disagrees. Evidence decides.
- A false positive is **documented** — finding, why false, evidence — not
  silently dropped.
- Any **CRITICAL or HIGH** that verifies as `CONFIRMED` moves the ship decision
  to `DO_NOT_SHIP` until fixed and re-verified.
- **MEDIUM** enters v0.1 only when it materially affects goal, security,
  benchmark validity or provenance. Otherwise `V0.2_BACKLOG`.
- **LOW** is v0.2 by default. v0.1 is not polished indefinitely.

## Why the prompts read the way they do

They are written to be falsifying, not confirming. They never ask the reviewer
to approve, verify a conclusion, or check that something is correct. The
author's release decision is deliberately **not** included in any prompt, and
`FINAL_RELEASE_REPORT.md` is flagged in `EVIDENCE_MANIFEST.md` as read-last so
it cannot anchor the review.

If a prompt is ever edited, re-run the anchoring check:

```bash
grep -rniE "confirm that|verify .* conclusion|approve|is correct" \
  reports/codex-package/REVIEW_BRIEF.md \
  reports/codex-package/PROMPT_*.md
```

It should return nothing. Scan only the prompt files — this README describes the
check and would match itself.
