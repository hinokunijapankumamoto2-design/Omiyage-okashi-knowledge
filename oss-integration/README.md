# OSS Scout × Integration Architect

**v0.1 MVP** — Take a goal (and optionally some GitHub repositories you like),
break the world's OSS down into *capabilities*, verify and gate them, pick the
strong ones, resolve what collides, and **generate a new plugin** — then check
whether it is actually better than what you started with.

The output is not a list of repositories. It is an **OPTIMIZED PLUGIN**.

```
Repositoryを集めるな。Capabilityを理解せよ。
Capabilityを並べるな。Goalに対して最適化せよ。
Pluginを束ねるな。再設計せよ。
統合して終わるな。改善を検証せよ。
```

[日本語版 README](./README.ja.md)

## Reproduce a full run

```bash
cd oss-integration
npm install
npm run build
npm test          # 63 tests: unit, goal cases, schema conformance, acceptance
```

### MODE C — bring your own tools and optimize (the important one)

```bash
node dist/src/cli.js build \
  --goal "Claude Codeで最高品質のWebサイトを作れるPluginを作って" \
  --repo https://github.com/fixture-org/frontend-craft-plugin \
  --repo https://github.com/fixture-org/browser-qa-plugin \
  --repo https://github.com/fixture-org/a11y-guard-plugin \
  --name frontend-quality-plugin
```

Writes `generated/plugins/frontend-quality-plugin/` containing a real Claude
Code plugin plus `INTEGRATION_REPORT.md`, `VALIDATION_REPORT.md` and
`PROVENANCE.md`.

### MODE A — goal only

```bash
node dist/src/cli.js goal "Claude Codeで最高品質のWebサイトを作れるPluginを作って"
```

### MODE B — analyse one repository

```bash
node dist/src/cli.js analyze --repo https://github.com/fixture-org/a11y-guard-plugin
```

### Options

| Flag | Meaning |
| --- | --- |
| `--live` | Allow GitHub API calls. **Off by default** so runs are reproducible; without it an unknown repository resolves to an explicit `UNKNOWN` instead of a guess. Set `GITHUB_TOKEN` for rate limits. |
| `--out <dir>` | Output root (default `generated/plugins`). |
| `--name <name>` | Generated plugin name. |
| `--json` | Machine-readable output. |

## What actually happens

```
USER GOAL + OPTIONAL USER-SUPPLIED OSS
  → Goal Engine ─ capability decomposition (never repository names)
  → Repository Analyzer ─ fixture / seed registry / live GitHub
  → Capability Extractor
  → Evidence Engine ─ VERIFIED > SUPPORTED > INFERRED > CLAIMED > UNKNOWN
  → License Gate + Security Gate ─ a BLOCK outranks any score
  → Capability Graph ─ REQUIRES / COMPLEMENTS / ALTERNATIVE_TO /
                       CONFLICTS_WITH / UNLOCKS, plus near-miss detection
  → Gap Engine ─ required − held = missing (minus what the combination unlocks)
  → Global Discovery ─ go shopping for what is missing
  → Duplicate + Conflict Detection
  → KEEP / REPLACE / ADD / REMOVE / WATCH / REJECT / UNKNOWN, each with a reason
  → Best Capability Stack
  → Stack Optimizer ─ consolidate sources without weakening evidence
  → Integration Architect ─ dependencies, conflicts, workflow, architecture
  → Original Layer ─ only where this stack demands it
  → Plugin Builder ─ a real .claude-plugin/ package
  → Validator ─ originals vs integrated, on the same task suite
  → FINAL PLUGIN
```

## Three things this refuses to do

**It will not rank on stars.** Popularity is 5% of the Scout Score and
`classifyEvidence(['social-popularity'])` returns `UNKNOWN`. In the acceptance
fixture the most-starred repository (4,300 stars) is rejected outright, because
a hard gate outranks a score.

**It will not guess a licence.** An unobserved licence is `UNKNOWN`, and
`UNKNOWN` never permits copying code — only referencing the idea and
implementing it independently. v0.1 copies no third-party source at all, so
`Reused Code: None` is structurally true rather than a promise.

**It will not claim an improvement it did not measure.** The v0.1 benchmark is
static capability coverage. Output quality, reliability, UX and token usage are
reported as `NOT_VERIFIED`, and a measured regression is reported as
`REGRESSION DETECTED`.

## Benchmark result on the reference build

| Metric | Best original | Integrated | Verdict |
| --- | --- | --- | --- |
| Task Completion (9 tasks) | 0.222 | **0.889** | IMPROVED |
| Maintainability (dupes + unresolved conflicts) | 3 | **1** | IMPROVED |
| Security (high/critical findings) | 0 | 0 | EQUIVALENT |
| Error Rate | 0 | 0.5 | REGRESSION |
| Capability Coverage per Install Source | 0.222 | 0.178 | REGRESSION |
| Output Quality / Reliability / UX / Token Usage | — | — | NOT_VERIFIED |

**Overall: REGRESSION**, and that is the honest answer, not a broken run. The
integrated plugin covers four times as many tasks with a sixth of the
integration debt, but two costs are real:

- **Error Rate.** Half its completable tasks depend on a capability whose
  upstream source was never security-scanned, because offline runs have no
  artifact to scan. Those capabilities carry `securityStatus: UNKNOWN`, and
  UNKNOWN is not PASS.
- **Coverage per install source.** The v0.1 no-vendoring policy means the
  plugin orchestrates upstream tools rather than containing them, so each
  selected source stays a separate install.

Both have named remedies in [CHANGELOG.md](./CHANGELOG.md). Reporting them
rather than tuning the metrics is the point of rule 30.

## Layout

```
oss-integration/
├── CLAUDE.md              Mission, principles, prohibitions, invariants
├── ASSUMPTIONS.md         Every default adopted, and how to overturn it
├── PROVENANCE.md          Prior art, registry sources, dependencies
├── CHANGELOG.md           Including the independent-review findings
├── skills/
│   ├── oss-scout/SKILL.md            Discovery, evidence, gates, stack
│   └── integration-architect/SKILL.md Integration, redesign, generation
├── src/                   16 modules — see CLAUDE.md
├── schemas/               JSON Schemas for the four core records
├── data/                  Capability taxonomy + seed OSS registry
├── generated/plugins/     Build output
├── tests/                 Fixtures, benchmark suite, unit + acceptance tests
├── examples/              A committed reference run
└── references/ambit.md    Prior-art record
```

## Status against the v0.1 definition of done

All 24 conditions met. `npm run verify` builds and runs the full suite; the
`build` command produces a plugin that passes structural validation.

## Licence

MIT. See [LICENSE](./LICENSE).
