# CODEX INDEPENDENT REVIEW REPORT

```
CODEX_CONNECTION: FAIL

CODEX REVIEW:     NOT_RUN
REASON:           CONNECTION_FAILED
```

**No independent review has been performed on this project by any party other
than its author.** The Claude self-review is recorded separately below and is
explicitly *not* an independent review. It is not promoted here, in the README,
or in the release report.

---

## What succeeded

| Step | Result |
| --- | --- |
| `npm install -g @openai/codex` | ✅ **codex-cli 0.151.0** installed at `/opt/node22/bin/codex` |
| `claude plugin marketplace add openai/codex-plugin-cc` | ✅ marketplace `openai-codex` added (cloned over HTTPS) |
| `claude plugin install codex@openai-codex` | ✅ **installed, scope user, status enabled**, version 1.0.6 |
| Plugin command surface read from its own manifest | ✅ `/codex:review`, `/codex:adversarial-review`, `/codex:rescue`, `/codex:transfer`, `/codex:status`, `/codex:result`, `/codex:cancel`, `/codex:setup` |

The tooling side is fully in place. Nothing about the plugin or the CLI is
broken.

## What failed

| Field | Value |
| --- | --- |
| **CAUSE** | Two independent blockers: (1) network egress to OpenAI is denied by organization policy; (2) no credentials of any kind are present. |
| **COMMAND** | `codex exec --skip-git-repo-check "Reply OK"` |
| **ERROR** | `api.openai.com:443 — connect_rejected (the egress proxy denied the CONNECT (organization policy) or could not reach the destination)`, ×20 per attempt; 29 and 23 failed connections across two attempts. The proxy status endpoint reports `gateway answered 403 to CONNECT (policy denial or upstream failure)`. |
| **AUTH STATUS** | `codex login status` → **`Not logged in`**. No `~/.codex` directory. `OPENAI_API_KEY` unset. |
| **PLUGIN STATUS** | Installed and **enabled** — the plugin is not the failure. |

### Why neither auth route is available

The plugin's own README states the requirement: *"ChatGPT subscription (incl.
Free) or OpenAI API key."* Both routes are closed here:

- **ChatGPT subscription flow** — `codex login` performs a browser OAuth
  round-trip against `auth.openai.com`, which returns the same
  `connect_rejected`. There is no browser and no reachable auth host.
- **API key flow** — `codex login --with-api-key` reads a key from stdin. No key
  exists in this environment, and **fabricating or guessing one is not an
  option**.

## Recovery attempts

| # | Attempt | Result |
| --- | --- | --- |
| 1 | Check for a pre-existing Codex CLI before installing anything | Not present; installed 0.151.0 rather than assuming |
| 2 | Check for existing ChatGPT/Codex auth so as not to demand an API key | `~/.codex` absent, `codex login status` → Not logged in |
| 3 | Probe all three OpenAI hosts (`api.` / `chatgpt.com` / `auth.`) | All three fail to connect |
| 4 | Read the proxy status endpoint for the precise cause | `403 to CONNECT`, organization policy denial — not a transient error |
| 5 | Install marketplace + plugin non-interactively via `claude plugin` | Both succeeded |
| 6 | Invoke through the plugin's own path (`codex exec`) | Same denial, 23 failed connections |
| 7 | Consider pointing Codex at an alternative OpenAI-compatible endpoint | **Rejected.** No such endpoint is reachable, and routing "Codex" through a different model would make the "independent Codex review" label false |

This is an **environment restriction, not a defect**, and not something this
project can fix from inside the sandbox.

## Ready to run the moment access exists

The full independent-review package is committed at
`reports/codex-package/`, deliberately written so the author's conclusion
cannot anchor the reviewer:

| File | Purpose |
| --- | --- |
| `REVIEW_BRIEF.md` | Standard review. Withholds the final recommendation by design; lists the six claims that must be checked rather than accepted. |
| `PROMPT_ADVERSARIAL.md` | Attacks the release conclusion, naming the six specific claims to try to break. |
| `PROMPT_BENCHMARK_AUDIT.md` | Hostile peer review of the benchmark, including the three mid-project definition changes and the n=3 sample size. |
| `PROMPT_SEC_LIC_PROV.md` | Security, licence and provenance, including the two deliberately narrowed security rules and possible cache/shared-state leakage. |
| `RUN_CODEX_REVIEW.sh` | Runs all four and writes transcripts to `reports/codex-package/out/`. |

To execute, in an environment with egress to OpenAI:

```bash
codex login                       # or: printenv OPENAI_API_KEY | codex login --with-api-key
codex login status                # must not say "Not logged in"
./reports/codex-package/RUN_CODEX_REVIEW.sh
```

Then, **before any fix**, each finding must be independently reproduced and
classified `CONFIRMED` / `PARTIALLY_CONFIRMED` / `NOT_REPRODUCED` /
`FALSE_POSITIVE` / `OUT_OF_SCOPE` / `UNKNOWN`. Codex can be wrong too.

## Findings

| ID | Source review | Severity | Category | Finding | Evidence | File | Codex recommendation | Claude verification | Final decision | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | — | — | — | _No findings: the review did not run._ | — | — | — | — | — | `NOT_RUN` |

An empty findings table here means **"nobody looked"**, not "nothing was
wrong". It must not be read as a clean bill of health.

## CLAUDE SELF REVIEW — recorded separately, not independent

**SELF_REVIEW.** Performed by the agent that wrote the code, and carrying that
bias. 19 defects found and fixed across the verification and convergence rounds
(`CHANGELOG.md`). Evidence that specific defects were found and repaired; **not**
evidence that the code is correct, and **not** a substitute for the review above.

The most consequential self-review findings — a live-fetch TDZ error that made
every live fetch silently fall back to seed data, a security rule that BLOCKed a
clean dependency because it never checked the path breadth its own description
claimed, and a benchmark that scored a subject *worse* for being able to see a
real defect — are exactly the class of defect an independent reviewer exists to
catch **that the author missed on the first pass**. That three of them were only
caught on a later self-pass is itself an argument that this project still needs
the review it could not run.
