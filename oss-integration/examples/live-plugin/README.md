# Example — LIVE_REPOSITORY_TEST

`live-web-quality/` was generated from **three real public GitHub
repositories**, analysed over the network in this run. Nothing here is
synthetic.

## The command

```bash
OSS_CHROMIUM_PATH=/path/to/chrome \
node dist/src/cli.js build --live --real-tasks --repeats 3 \
  --goal "Claude Codeで最高品質のWebサイトを作れるPluginを作って" \
  --repo https://github.com/dequelabs/axe-core \
  --repo https://github.com/americanexpress/jest-image-snapshot \
  --repo https://github.com/GoogleChrome/lighthouse \
  --name live-web-quality --out examples/live-plugin
```

## What was verified live

| Repository | Licence (read from its LICENSE file) | Release | Artifacts scanned |
| --- | --- | --- | --- |
| `dequelabs/axe-core` | MPL-2.0 | from npm `dist-tags.latest` | README, LICENSE, package.json, published source |
| `americanexpress/jest-image-snapshot` | Apache-2.0 | from npm `dist-tags.latest` | README, LICENSE, package.json, published source |
| `GoogleChrome/lighthouse` | Apache-2.0 | from npm `dist-tags.latest` | README, LICENSE, package.json, published source |

Licences are identified from the licence **text** that ships with each project,
not from a metadata field that a project can set to anything. Where the two
disagree, the file wins.

See `live-web-quality/LIVE_REPOSITORY_REPORT.md` for the full fetch log —
every URL, whether it succeeded, and what it returned — and for the list of
fields that remain `UNKNOWN` because no reachable source establishes them
(notably the latest commit SHA).

## Why this differs from the synthetic run

In this run the three inputs are **libraries**, not plugins, and none of them
drives a browser. So each one alone can attempt no task at all, and the
integrated plugin has to discover a browser-automation source to reach the
goal. That is a genuine finding about these inputs, not a defect: the
comparison shows what integration adds when the inputs are individually
insufficient.

The synthetic run in `../frontend-plugin/` uses fixture inputs with richer,
overlapping capability sets, which is what makes a head-to-head executed
comparison possible there. Neither run's numbers are transferable to the other.
