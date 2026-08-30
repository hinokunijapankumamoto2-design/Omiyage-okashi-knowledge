# PROVENANCE — OSS Scout × Integration Architect v0.1

Provenance for **this project's own source**. Each generated plugin gets its
own `PROVENANCE.md` under `generated/plugins/<name>/`.

**Reused Code: None.**

No third-party source was read into or copied into this project. Every file
under `src/` was written for it. Where a concept has recognised prior art, it
is credited below and implemented independently.

## Prior art acknowledged

| Source | Repository | Author | License | Commit / Release | Research Date | Capability | Adopted Concept | Reused Code | Modification | Original Contribution | Evidence | Decision | Generated Component |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Public GitHub repository | zz-plant/ambit | zz-plant | MIT | UNKNOWN | 2026-08-30 | capability-orchestration, evidence-tracking | Capability DAG; prerequisite graph; combo/unlock; near-miss detection; goal routing; alternative paths; lifecycle/health | **None** | Not applicable — nothing was copied | Inverted direction: acquisition planning for a goal against the *global* ecosystem, rather than introspection of a *fixed* environment. Adds licence and security gates, duplicate/conflict resolution, and a stack optimizer, none of which arise when the capability set is fixed. | SUPPORTED (landing page read 2026-08-30) | REFERENCE_ONLY by policy | `src/graph/capability-graph.ts`, `src/gap/engine.ts`, `src/health/engine.ts` |
| Official documentation | Claude Code plugin reference | Anthropic | Documentation | n/a | 2026-08-30 | plugin packaging | Plugin directory layout and manifest/frontmatter field names | **None** | Not applicable | Generator and structural validator written against the documented format | SUPPORTED | KEEP | `src/builder/plugin-builder.ts`, `src/validation/package-validator.ts` |

## Discovery registry sources

Every entry in `data/oss-registry.json` was read from its public GitHub
repository landing page on **2026-08-30**. Licence identifiers and descriptions
are transcribed from those pages. Fields that were not visible are recorded as
`UNKNOWN` rather than filled in. **No source tree was downloaded, so no
registry-sourced capability is class VERIFIED, and their security gate returns
`UNKNOWN` because there was no artifact to scan.**

| Repository | Licence (as read) | Recorded primary capability | Reused Code |
| --- | --- | --- | --- |
| microsoft/playwright | Apache-2.0 | browser-automation | None |
| microsoft/playwright-mcp | Apache-2.0 | browser-automation | None |
| dequelabs/axe-core | MPL-2.0 | accessibility-audit | None |
| pa11y/pa11y | LGPL-3.0-only | accessibility-audit | None |
| GoogleChrome/lighthouse | Apache-2.0 | performance-audit | None |
| americanexpress/jest-image-snapshot | Apache-2.0 | image-comparison | None |
| zz-plant/ambit | MIT | capability-orchestration | None |

These are **discovery pointers**. Listing a repository here is not a claim that
its code was used, nor that its capabilities were verified.

## Synthetic fixtures

`tests/fixtures/repos/*.json` describe repositories under `fixture-org`, which
is **not a real GitHub organisation**. They exist so the acceptance tests are
deterministic and offline. They are not claims about any real project — in
particular `fixture-org/a11y-guard-plugin` is deliberately unlicensed and
unsafe so the hard gates have something real to block.

## Dependencies

| Package | Purpose | Licence | Scope |
| --- | --- | --- | --- |
| typescript | Build | Apache-2.0 | devDependency |
| @types/node | Types | MIT | devDependency |

No runtime dependency. Tests run on Node's built-in `node:test`.
