# Example — committed reference run

The plugin in `frontend-quality-plugin/` was **generated**, not written by
hand. It is committed so the output can be read without running anything, and
so a change in generator behaviour shows up as a diff.

## The command that produced it

```bash
node dist/src/cli.js build \
  --goal "Claude Codeで最高品質のWebサイトを作れるPluginを作って" \
  --repo https://github.com/fixture-org/frontend-craft-plugin \
  --repo https://github.com/fixture-org/browser-qa-plugin \
  --repo https://github.com/fixture-org/a11y-guard-plugin \
  --name frontend-quality-plugin \
  --out examples/frontend-plugin
```

The three inputs are the **synthetic fixtures** in `tests/fixtures/repos/`, so
this run is offline and reproducible. `fixture-org` is not a real GitHub
organisation; see `ASSUMPTIONS.md` (A6).

## What to look at

| File | Why it is interesting |
| --- | --- |
| `INTEGRATION_REPORT.md` | The whole decision trail: gates, graph, gap, near misses, duplicates, conflicts, KEEP/REPLACE/ADD/REMOVE, the stack, the optimizer's consolidation, and an UNKNOWN section. |
| `VALIDATION_REPORT.md` | Originals vs integrated on the same nine tasks — including the two metrics that **regressed**, which are reported rather than tuned away. |
| `PROVENANCE.md` | Per capability: the concept source, `Reused Code: None`, and what is original. |
| `skills/capability-router/SKILL.md` | The generated routing table, with an evidence class and a concept source per capability. |
| `skills/evidence-ledger/SKILL.md` | The original component that keeps "measured" and "assumed" apart at runtime. |
| `capability-manifest.json` | The machine-readable version of all of the above. |

## What the run demonstrates

- **A BLOCK outranks a score.** `a11y-guard-plugin` has the most stars of the
  three inputs (4,300). It is unlicensed and its README pipes a network script
  into `sudo bash`. Both hard gates fire and none of its capabilities enter the
  stack.
- **Gaps are closed by going shopping.** `accessibility-audit`,
  `performance-audit` and `image-comparison` were missing after the gates, so
  discovery supplied Lighthouse and jest-image-snapshot.
- **A combination unlocks something nobody supplied.** `visual-regression` is
  unlocked once browser automation, screenshot capture and image comparison are
  all present; `visual-review` is delivered by the combination itself and is
  marked `INFERRED`, not `VERIFIED`, because it was reasoned about rather than
  executed.
- **Collisions are resolved, not carried.** All three inputs declare a `review`
  command and two write to `.qa/`. The generated plugin exposes one surface.
- **The verdict is not flattering.** Overall is `REGRESSION`, driven by error
  rate and setup efficiency, with the causes named. That is the validator
  working, not failing.
