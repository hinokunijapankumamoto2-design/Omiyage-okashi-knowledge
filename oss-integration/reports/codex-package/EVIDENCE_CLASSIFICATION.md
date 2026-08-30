# Evidence classification

Everything handed to the reviewer is classified so that a **conclusion is never
passed off as a fact**. The distinction that matters most:

| Class | Meaning |
| --- | --- |
| `FACT` | Directly observable in the artifacts. Countable, checkable, not an opinion. |
| `MEASURED_RESULT` | A number produced by an execution, with its method recorded. The number is the fact; what it *means* is not. |
| `CLAIM_TO_AUDIT` | An interpretation the author drew. **Not evidence.** Treat as the thing under test. |
| `ASSUMPTION` | A choice made without proof, recorded so it can be rejected. |
| `UNKNOWN` | Not established. Not to be filled in. |

---

## FACT

- The repository is frozen at commit `04fab5b51b62dbba03d744e50b03ee1ea1c80a33`.
- The generated synthetic plugin contains 16 files; the live plugin 15.
- The synthetic plugin emits 5 skills and 2 agents; the live plugin emits 3 skills.
- 4 upstream projects appear in the live stack: `americanexpress/jest-image-snapshot`, `GoogleChrome/lighthouse`, `microsoft/playwright`, `microsoft/playwright-mcp`.
- 0 conflicts are reported unresolved in either build.
- The licence gate holds 12 SPDX rules.
- The security gate reported: axe-core REVIEW_REQUIRED (1 finding), jest-image-snapshot CONDITIONAL (1), lighthouse CONDITIONAL (2), playwright PASS (0), playwright-mcp PASS (0).
- `reshotdev/screenshot`, found by discovery, was BLOCKed by the security gate.
- Test counts at freeze: 86 offline, 4 live-repository, 10 real-browser.

## MEASURED_RESULT

Each of these is a number with a recorded method. **No interpretation is
attached here on purpose.**

- Per-subject execution times, full-capability and same-task, in each plugin's `BENCHMARK_REPORT.md` § Results and § SAME-TASK comparison.
- Per-task outcomes with evidence fields, § Per-task outcomes.
- Phase profile across all measured passes, § Execution profile.
- Task completion, integration debt, quality-criteria coverage, install actions, upstream projects, unscanned dependencies — § Results.
- axe-core violation count on the fixture page: 1 (`image-alt`).
- Pixel diff ratio between two captures of the static page: 0.
- Reliability across 3 repeats: 1.0 for every subject that attempted a task.

## CLAIM_TO_AUDIT

**These are the author's interpretations. They are the subject of the review,
not input to it.** See `CLAIMS_TO_AUDIT.md` for the full list and the verdict
scale.

Examples: that the integration adds no material orchestration overhead; that the
upstream project count is irreducible without weakening a gate; that
full-capability time regression is extra work rather than architectural waste;
that all four original contributions carry measurable value; that
`Reused Code: None` is supported.

## ASSUMPTION

Recorded in full in `ASSUMPTIONS.md` (A1–A37). The ones most likely to matter
to a reviewer:

- The benchmark task suite represents relevant usage.
- `originals-union` is the realistic alternative, and therefore the right
  counterfactual for cost metrics.
- Materiality was pre-registered before measurement and applied as written.
- Discarding cold start in a warm-up pass removes an ordering effect rather than
  hiding a real user-facing cost.
- A locally served fixture page is an acceptable stand-in for a real page for
  execution measurement.
- n=3 repeats on one machine is enough for the directional conclusions drawn.

## UNKNOWN

- Behaviour against remote public sites. Never tested — the environment blocks it.
- Latest commit SHA and true default branch of analysed repositories (the API that serves them is unreachable).
- UX, setup wall-clock time, token usage. Never measured; no proxy substituted.
- Per-repeat execution times and variance. **Only the median was retained** — see `RAW_BENCHMARK_DATA.md`.
- Whether an unsearched ecosystem holds a permissively-licensed, PASS-grade accessibility engine.
