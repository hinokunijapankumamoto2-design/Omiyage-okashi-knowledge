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

## Not built (deferred per rule 43)

SaaS, authentication, billing, enterprise governance, web UI, microservices,
Kubernetes, vector database, a large GitHub index, HMAC approval, incident
management.

## Codex

| # | Assumption | Why |
| --- | --- | --- |
| A17 | Codex was **not available** in this environment, so the independent review in rule 34 was performed as a self-directed adversarial pass with findings recorded in `CHANGELOG.md`. Development did not stop, per the same rule. | Rule 34's own fallback clause. |
