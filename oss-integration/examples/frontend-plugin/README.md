# Example — SYNTHETIC_TEST

`frontend-quality-plugin/` was generated from **three synthetic fixtures**, not
from real repositories. `fixture-org` is not a real GitHub organisation.

**Nothing in this directory is a claim about any real project.** The stars,
licences, security issues and maintainer activity of the three inputs are
invented, deliberately, so that the offline regression test is deterministic and
so that the hard gates have something to block. For findings about real
repositories see `../live-plugin/`.

## The command

```bash
OSS_CHROMIUM_PATH=/path/to/chrome \
node dist/src/cli.js build --real-tasks --repeats 3 \
  --goal "Claude Codeで最高品質のWebサイトを作れるPluginを作って" \
  --repo https://github.com/fixture-org/frontend-craft-plugin \
  --repo https://github.com/fixture-org/browser-qa-plugin \
  --repo https://github.com/fixture-org/a11y-guard-plugin \
  --name frontend-quality-plugin --out examples/frontend-plugin
```

## What is real here and what is not

| Real | Synthetic |
| --- | --- |
| The browser, the page, the axe-core run, the pixel diff, the navigation timings, the execution times | The three input repositories and every fact about them |
| The capability graph, gates, selection, conflict resolution and generation logic | The capability sets the fixtures declare |

The **capability sets** are synthetic; the **execution** measuring what those
capability sets can achieve is real, in a real browser against a real page.

## What the run demonstrates

- **A BLOCK outranks a score.** `a11y-guard-plugin` has the most stars of the
  three fixtures. It is unlicensed and its README pipes a network script into
  `sudo bash`. Both hard gates fire and none of its capabilities enter the stack.
- **Gaps are closed by going shopping**, and a combination unlocks
  `visual-review`, which no input supplies.
- **Collisions are resolved, not carried**: all three declare a `review`
  command and two write to `.qa/`.
- **The verdict is not flattering.** Two material regressions are reported
  rather than tuned away. See `BENCHMARK_REPORT.md`.

## Files worth reading

| File | Why |
| --- | --- |
| `BENCHMARK_REPORT.md` | Pre-registered metric definitions beside the results, per-task outcomes, and the rubric with its evidence. |
| `VALIDATION_REPORT.md` | Package validation and the regression section. |
| `INTEGRATION_REPORT.md` | The whole decision trail, including the optimizer and the UNKNOWN section. |
| `SECURITY_REPORT.md` | Every finding, and every source that was **not** scanned. |
| `PROVENANCE.md` | Per capability: concept source, `Reused Code: None`, original contribution. |
