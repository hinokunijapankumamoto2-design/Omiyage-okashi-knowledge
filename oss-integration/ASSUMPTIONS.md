# ASSUMPTIONS — v0.1

Reasonable defaults adopted where the specification left a choice, per rule 44.
Each one is a decision, not a fact. Overturn any of them by saying so.

## Scope and placement

| # | Assumption | Why | How to overturn |
| --- | --- | --- | --- |
| A1 | The project lives in `oss-integration/` inside this repository rather than in a new repository. | The instruction names `oss-integration/` as the root layout and gives no new-repository instruction. Creating a repository is hard to reverse. | Move the directory; nothing outside it is referenced. |
| A2 | Nothing outside `oss-integration/` was modified. | The existing repository is an unrelated knowledge base. | — |

## Data and network

| # | Assumption | Why | How to overturn |
| --- | --- | --- | --- |
| A3 | Runs are **offline and deterministic by default**; `--live` is the only network path. | An analysis that silently depends on network state is not reproducible, and REPRODUCIBILITY is one of the four hard gates. | Pass `--live` (and `GITHUB_TOKEN` for rate limits). |
| A4 | The seed registry (`data/oss-registry.json`) holds seven real repositories whose licence and description were **read from their public GitHub landing pages on 2026-08-30** and transcribed. Nothing was inferred. | Discovery needs real candidates, and a registry of invented ones would violate "Evidenceを捏造しない". | Extend the registry, or use `--live` to query GitHub search directly. |
| A5 | Because only landing pages were read, **no registry-sourced capability is class VERIFIED**, and their security gate returns `UNKNOWN` (no artifact was available to scan). | Scanning nothing is UNKNOWN, never PASS. | Run with `--live`, which fetches the README and gives the security gate something to scan. Full source scanning is v0.2. |
| A6 | The acceptance-test repositories under `tests/fixtures/repos/` are **synthetic**. `fixture-org` is not a real GitHub organisation and each file says so. | Tests must be deterministic and offline, and asserting facts about real repositories' internals without reading them would be fabrication. | Point `--repo` at real URLs with `--live`. |

## Goal interpretation

| # | Assumption | Why | How to overturn |
| --- | --- | --- | --- |
| A7 | Default evidence standard is `SUPPORTED`. | `VERIFIED` requires an executable test, which v0.1 cannot run against third-party repositories; requiring it would empty every stack. | Set `GoalSpec.evidenceStandard`. |
| A8 | **Goal archetypes** may expand a goal's capability set (e.g. "a high-quality web site" ⇒ ten capabilities). The matched archetype and its rationale are recorded on the GoalSpec and printed. | Rule 39 expects that expansion. Keyword matching alone cannot produce it. Recording it keeps it auditable rather than invented. | Remove the archetype from `data/capability-registry.json`, or reject the expansion after reading it in the report. |
| A9 | `commercialUse` defaults to `UNKNOWN`, and the licence gate stays conservative rather than assuming internal-only use. | Rule 6: do not create conditions the user did not state. | State it in the goal text. |

## Build policy

| # | Assumption | Why | How to overturn |
| --- | --- | --- | --- |
| A10 | **The builder copies no third-party source at all**, whatever the licence permits. Every generated file is written from the analysis result. | Rule 28 pins v0.1 to `Reused Code: None`. Enforcing it in the generator makes the provenance structurally true instead of a promise. | v0.2: gate vendoring on `mayCopyCode()` and update PROVENANCE generation. |
| A11 | Consequently the generated plugin **orchestrates** upstream tools rather than vendoring them, so each selected source remains a separate install. | Follows from A10. | See A10. This is the direct cause of the install-source cost reported in the benchmark. |
| A12 | The generated plugin targets the documented Claude Code plugin layout (`.claude-plugin/plugin.json`, `skills/<name>/SKILL.md`, `agents/<name>.md`, `hooks/hooks.json`). | Read from the official plugin reference on 2026-08-30. | Update `src/builder/plugin-builder.ts` and the package validator together. |

## Benchmark

| # | Assumption | Why | How to overturn |
| --- | --- | --- | --- |
| A13 | The benchmark is **static capability coverage**, not a runtime benchmark. The generated plugin was not executed against a live target. | v0.1 has no harness for executing plugins against real pages. Reporting runtime quality without running anything would violate rule 30. | v0.2: execute the task suite against a real page and record real output. |
| A14 | Output Quality, Reliability, UX, Token Usage and plugin runtime are reported as `NOT_VERIFIED`, never estimated. | Rule 30. | See A13. |
| A15 | Raw **Install Sources** is reported but excluded from the overall verdict, with the exclusion and its justification printed in the report. The normalized *Capability Coverage per Install Source* is what counts. | Comparing raw install counts across subjects that deliver 2 vs 8 tasks rewards the subject that does least. The raw number is still shown, and any rise in it is called out. | Set `countsTowardVerdict: true` in `src/validation/benchmark.ts`. |
| A16 | Subjects are compared against the **best** individual original, not the average. | The bar should be the strongest thing the user already has. | — |

## Verification round (v0.2 of the assumptions)

| # | Assumption | Why | How to overturn |
| --- | --- | --- | --- |
| A18 | `--live` uses **`raw.githubusercontent.com` and `registry.npmjs.org`**, not the GitHub REST API. | The REST API returns HTTP 403 through this environment's egress proxy. The two reachable sources establish licence text, README, package metadata, release, publish date, dependencies, install scripts and the published source. | If the REST API is reachable for you, add an adapter; the analyzer's resolution order already isolates the fetch behind `fromLive`. |
| A19 | The **latest commit SHA is always `UNKNOWN`** and the default branch is recorded as "the branch that served content", not a confirmed default. | Neither is obtainable from the two reachable sources. Recording a probe result as a confirmed default would be a guess. | See A18. |
| A20 | The real-task suite runs against a **locally served fixture page**, not a remote site. | Remote sites are unreachable here, and a page that changes under the benchmark would make it unreproducible. The browser, axe-core, pixel diff and timings are all real. | Point `startSite()` at a different origin. |
| A21 | For the executed suite, a subject's **capability set** is the variable under test; all subjects share the same page, implementations and viewports. | Rule 10 requires identical task conditions. | — |
| A22 | **Reliability requires `--repeats > 1`.** With a single run it stays `NOT_VERIFIED` rather than being reported as 1.0. | One run cannot measure variance. | Pass `--repeats`. |
| A23 | Two metrics carry **no verdict**: `UX` and `Setup Time` and `Token Usage`. They are not measured *for any subject*, so there is no result to exclude. | Rule 22 forbids excluding a regression. A metric with no measurement for anyone has no verdict to exclude. | Measure them. |
| A24 | The **materiality rule was pre-registered before re-measurement** and is applied as written, including where it works against the integrated plugin. | Rule 22. | It is data, in `data/benchmark-metrics.json`. |
| A25 | Three metric definitions were corrected this round (`install-actions`, `upstream-projects`, `output-quality`). Each correction fixes an **asymmetry or ambiguity** that measured different subjects by different rules, and each is recorded in `changedFromV01` with its justification. The `upstream-projects` correction makes the integrated plugin's number **larger**. | A definition that measures subject A by one rule and subject B by another is defective regardless of which way the defect points. | Read `changedFromV01` in `data/benchmark-metrics.json` and disagree in writing. |

## Release gate round (benchmark policy v0.1.1)

| # | Assumption | Why | How to overturn |
| --- | --- | --- | --- |
| A26 | **`benchmark/baseline-v0.1.json` is immutable.** v0.1's REGRESSION/CONDITIONAL verdict stands as recorded and is never recomputed. | A verdict that can be edited after the fact is not a verdict. | It cannot be. New policy versions produce new results in new files. |
| A27 | Benchmark changes go into **`BENCHMARK_POLICY_v0.1.1.md`** as additions, never edits: nothing removed, no threshold relaxed, no regression moved out of the verdict. The policy states in writing both how it could favour and how it could hurt the integrated plugin. | Rule 22. | Read the policy and disagree in writing. |
| A28 | **FULL-CAPABILITY is the headline comparison; SAME-TASK is diagnostic.** They are reported separately and never blended. | SAME-TASK removes work the baselines cannot do, so it favours the integrated plugin by construction. Presenting it as the headline would be exactly that manipulation. | — |
| A29 | Normalized time metrics are **added beside** raw Execution Time, which keeps its own verdict and materiality. | Rule 8: a normalized metric may not replace a raw one. | — |
| A30 | One browser is shared across subjects (one context each), and a **discarded warm-up pass** absorbs cold start. | Launching per subject charged 100–670 ms of process start-up to whichever subject ran first, so ordering rather than capability was moving the numbers. This fix works *against* the integrated plugin, since baselines ran first. | Set repeats to 1 and compare orderings. |
| A31 | **Vendoring is rejected** even where Apache-2.0 permits it. | It would not reduce the project count, and it would move security responsibility and licence-notice duty onto this project. `DECISIONS.md` D2. | An offline-operation requirement would change this. |
| A32 | `REMOTE_REAL_SITE: NOT_VERIFIED — ENVIRONMENT_RESTRICTION`. The real-task page is served from localhost. | Remote sites are unreachable from this sandbox, and a page that changes under the benchmark would make it unreproducible. | Run the suite where outbound HTTP to a public page is permitted. |

## Codex review round

| # | Assumption | Why | How to overturn |
| --- | --- | --- | --- |
| A33 | With Codex unreachable, the round proceeds and reports `NOT_RUN / CONNECTION_FAILED` rather than stopping or substituting. | Development must not halt on an environment restriction, and a substitute reviewer would make the "independent" label false. | Run `reports/codex-package/RUN_CODEX_REVIEW.sh` where egress to OpenAI is permitted. |
| A34 | **Routing Codex at a different reachable model was rejected.** | It would produce a review labelled "Codex" that Codex did not perform. | — |
| A35 | The review package deliberately **withholds the author's final recommendation** from the reviewer. | Confirmation bias: a reviewer handed the conclusion tends to confirm it. | The recommendation is in `FINAL_RELEASE_REPORT.md` for reading *after* forming a view. |
| A36 | The Codex CLI and plugin were installed into the **user's environment**, outside the project tree, and nothing in `src/` imports them. | The user asked for the plugin to be installed. It is inert with respect to the build. | `claude plugin uninstall codex@openai-codex` |
| A37 | Same-task 252 ms vs 256 ms is reported as **EQUIVALENT**, not as the integrated plugin being faster. | The difference is inside run-to-run noise, and n=3 on one machine does not support a directional claim. | Larger n with p95 reported. |

## Not built (deferred per rule 43)

SaaS, authentication, billing, enterprise governance, web UI, microservices,
Kubernetes, vector database, a large GitHub index, HMAC approval, incident
management.

## Codex

| # | Assumption | Why |
| --- | --- | --- |
| A17 | Codex was **not available**. `CODEX REVIEW = NOT_RUN, REASON = CODEX_UNAVAILABLE`. The adversarial pass performed instead is recorded as **CLAUDE SELF REVIEW** in `CHANGELOG.md` and is explicitly *not* an independent review — it was done by the author of the code. The earlier build report called it independent; that was wrong. | Rule 34's fallback clause allows development to continue; it does not allow self-review to be relabelled. |
