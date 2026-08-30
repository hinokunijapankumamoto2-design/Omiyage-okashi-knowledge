# Adversarial review

**Your position: try to prove this MVP should NOT ship.**

You are not looking for balance. You are looking for the evidence that would
change a release decision. Assume the implementation and its reports may be
wrong. Do not optimize for agreement with the author.

## Output format, one block per attack

```
CLAIM OR ASSUMPTION ATTACKED
EVIDENCE
SEVERITY          CRITICAL | HIGH | MEDIUM | LOW
REPRODUCTION
EXPECTED
ACTUAL
VERDICT           attack succeeded | attack failed | inconclusive
FIX OR EXPERIMENT REQUIRED
```

## Attack surface

- **Hidden regression** — a metric that got worse and is not in the verdict.
- **Benchmark gaming** — any definition, threshold, baseline or aggregation
  that flatters the integrated plugin.
- **Acceptance-test overfitting** — behaviour that exists to pass a test rather
  than to serve the goal. `tests/acceptance.test.ts` versus `src/`.
- **False live verification** — anything reported as network-verified that was
  not actually fetched. Cross-check `LIVE_REPOSITORY_REPORT.md` fetch logs
  against `src/repository/live-fetch.ts`.
- **Synthetic/live contamination** — `fixture-org` data reported as a fact
  about a real project, anywhere.
- **Unsafe dependency** — anything installed, executed or trusted without a gate.
- **Incorrect licence assumption** — `src/license/gate.ts` conditions per SPDX id.
- **Missing provenance** — a generated component with no traceable source.
- **Dead original layer** — a component that exists for appearance. Audit
  `tests/ablation.test.ts` itself: could it pass for a component that does
  nothing?
- **Fragile heuristics** — goal archetypes, alias matching, licence-text
  matching, the tar reader, the security regexes.
- **Security false negative** — what does `src/security/gate.ts` miss?
  Obfuscation, base64, dynamic import, path traversal, prototype pollution,
  ReDoS, unicode tricks.
- **Misleading claim** — every superlative or comparative in `README.md`,
  `README.ja.md` and the reports, checked against its cited measurement.
- **Untested failure mode** — what happens on network partial failure, a
  malformed tarball, a cyclic capability graph, a zero-capability goal, a
  repository with no licence, two sources declaring the same capability at
  identical evidence.
- **Conditions where the generated plugin is WORSE than its originals** — find
  and characterise at least one, or state that you could not.

## Evidence handed to you

Read these before forming a view. They separate what was observed from what was
concluded:

| File | What it is |
| --- | --- |
| `evidence/evidence-classification.md` | Facts, measured results, claims, assumptions and unknowns, kept apart |
| `evidence/claims-to-audit.md` | 11 claims to judge `SUPPORT` / `PARTIALLY_SUPPORT` / `REFUTE` / `NOT_VERIFIED` |
| `evidence/benchmark-evidence.md` | Where every raw measurement is — **and what was not retained** |
| `evidence/security-evidence.md` | Matched rules, files, excerpts, and the two rules deliberately narrowed |
| `evidence/license-evidence.md` | Per-repository licence file, detection, classification, conditions |
| `evidence/provenance-evidence.md` | The `Reused Code: None` method, its parameters and its stated limits |
| `EVIDENCE_MANIFEST.md` | Everything else, mapped to its real path |
| `FINDING_SCHEMA.md` | The output shape |

## Read-only review

**Do not modify, create or delete any file in this repository.** Your role is
`ANALYZE` · `CHALLENGE` · `FIND` · `REPORT`. Automatic fixes are out of scope:
every change is made later, by the author, only after independently reproducing
the finding.

If you would normally apply a patch, describe it under `RECOMMENDATION` instead.

**Baseline:** this review applies to commit `04fab5b51b62dbba03d744e50b03ee1ea1c80a33`. Record that SHA in your
output so reviewed source and later-fixed source are never confused.

## Finding format

Use the schema in `FINDING_SCHEMA.md` for every finding. Reporting **no
finding** in an area is a valid, useful result — say so rather than padding.
