# Session Record — OSS Scout × Integration Architect MVP v0.1

Branch `claude/oss-scout-integration-mvp-514zru`. This file is the index for the
whole session: what was decided, what was measured, what failed, and where each
piece of evidence lives.

## Current status

```
BUILD STATUS               CONDITIONAL
IMPROVEMENT VERDICT        REGRESSION   (full-capability, both runs)
RELEASE READINESS          READY_WITH_KNOWN_TRADEOFFS
SHIP DECISION              SHIP_WITH_LIMITATIONS
INDEPENDENT CODEX REVIEW   NOT_RUN      (ENVIRONMENT_RESTRICTION)
V0.1 PRODUCT DEVELOPMENT   FROZEN
```

Nothing here upgrades a status. The Codex review has not happened; the package
to run it is finished and waiting for a host with authentication and egress.

## Baselines

```
SOURCE_BASELINE_COMMIT   04fab5b   product source frozen here — immutable
SOURCE_CONTENT_HASH      a3c8652d4a6e94d5350bf86a16e036281575479a01428565ad2043caf1dcabca
REVIEW_PACKAGE_HASH      see reports/codex-package/REVIEW_PACKAGE_MANIFEST.json
HASH MODEL               git-canonical-v2
```

Product source is byte-identical to `04fab5b`; every commit after it is
documentation, evidence or review tooling. The integrity authority is
`reports/codex-package/REVIEW_PACKAGE_MANIFEST.json`, not a commit SHA.

## How to run the independent review

On a Windows host with `codex login` completed and OpenAI egress permitted:

```powershell
cd C:\Work\Repositories\GitHub-project
git checkout claude/oss-scout-integration-mvp-514zru
.\oss-integration\reports\codex-package\RUN_CODEX_REVIEW.ps1
```

Then drop the four transcripts into `reports/codex-results/`, run
`node reports/codex-package/import-codex-results.mjs`, and follow
`reports/codex-package/POST_CODEX_INSTRUCTIONS.md`.

Findings are **not** automatically correct. Every one must be reproduced against
the frozen baseline and classified before any fix:

```
CODEX FINDS -> CLAUDE REPRODUCES -> EVIDENCE DECIDES -> THEN FIX
```

## Where everything is

| Topic | File |
| --- | --- |
| Release verdict and full reasoning | `FINAL_RELEASE_REPORT.md` |
| Codex environment blocker, recovery attempts | `CODEX_REVIEW_REPORT.md` |
| Handoff, baseline model, gate design | `CODEX_HANDOFF_REPORT.md` |
| Chronological history incl. evidence changes | `CHANGELOG.md` |
| Standing assumptions A1–A37 | `ASSUMPTIONS.md` |
| Decisions D1–D7 | `DECISIONS.md` |
| Benchmark policy | `BENCHMARK_POLICY_v0.1.1.md` |
| Provenance and reuse audit | `PROVENANCE.md`, `ORIGINAL_CONTRIBUTIONS.md` |
| Frozen v0.1 evidence | `benchmark/baseline-v0.1.json` |
| Review package (prompts, evidence, runners) | `reports/codex-package/` |
| Drop zone for Codex output | `reports/codex-results/` |

## Session commits

| Commit | What |
| --- | --- |
| `8a778c3` | Final convergence: freeze v0.1, verify both regressions, issue verdict |
| `fb76b8a` | Codex round: install succeeded, connection failed, no substitution |
| `1169ab5` | External Codex review handoff; freeze v0.1 |
| `04fab5b` | **Product source freeze point** |
| `8dc0d5c` | Build the external review package |
| `45625e7` | Evidence reorganised; per-repeat timings marked NOT_AVAILABLE; CLAIM 11 |
| `946158a` | Refresh Codex auth/environment evidence after the CLI was installed |
| `3d2c6a2` | Separate source baseline from review-package baseline |
| `e023389` | Content-based gate; fail closed without a tag |
| `9b86468` | Harden baseline with content hashes |
| `ab860b2` | Canonicalize hashing across git checkouts (v1 → v2) |
| `66a0353` | Check the review runner out with LF on every platform |
| `3735c60` | Narrow `.gitattributes` to the single path that needs it |
| `3a61f6f` | Report file-set failures by name before hash comparison |

## Things that were wrong and were corrected

Recorded because each was found by testing, not by inspection, and each would
otherwise have been believed.

1. **TDZ bug in `live-fetch.ts`** made every live fetch silently fall back to
   seed data. Caught only because the fallback reported itself honestly.
2. **Security rule false positive** — a regex matched any JSON value starting
   with `http://`, flagging author URLs. Replaced with structured inspection.
3. **`destructive-rm` BLOCKed a clean dependency** — the rule claimed "broad
   path" without ever checking breadth.
4. **Output Quality punished breadth** — a subject scored *worse* for detecting
   a real accessibility defect.
5. **Cold start was charged to whichever subject ran first**, so ordering rather
   than capability moved the numbers. The warm-up fix works *against* the
   integrated plugin.
6. **Per-repeat timings never existed.** Reported `NOT_AVAILABLE` and every
   dispersion statistic `NOT_COMPUTABLE_FROM_AVAILABLE_DATA` rather than
   reconstructed. CLAIM 11 exists so Codex can rule the evidence insufficient.
7. **"no `~/.codex`" went stale** once the CLI was installed. Evidence corrected,
   conclusion unchanged, earlier observation scoped rather than deleted.
8. **`HEAD == recorded SHA` is unimplementable** — a commit cannot contain its
   own hash.
9. **`git ls-files -s` reads the index**, so an uncommitted source edit passed
   the gate. Switched to working-tree content.
10. **"Cross-platform parity: PASS (structural)" was wrong reasoning.** One
    shared hasher fixes the algorithm, not the input. The same commit checks out
    as 12009 bytes / 0 CRLF on Linux and 12455 / 446 on Windows, and the v1
    hashes differed. Fixed by hashing git-canonical content.
11. **The runner script itself was unrunnable on Windows** — CRLF checkout,
    `$'\r': command not found`, exit 2 before any gate. Correct hashes said
    nothing about it.
12. **Untracked in-scope files were invisible to the hash**, so smuggled evidence
    would not have been caught. Gate now fails `FILE_SET_MISMATCH`.

## What was refused

- Substituting another model for Codex and calling the result an independent
  review.
- Promoting the self-review to fill the gap. It stays labelled `SELF_REVIEW`.
- Vendoring under UNKNOWN / REFERENCE_ONLY / LEGAL_REVIEW / BLOCK licences.
- Weakening the security or licence gate to reduce the upstream project count.
- Fabricating per-repeat timings from a single aggregate.
- Reporting a PASS that the evidence did not support.
