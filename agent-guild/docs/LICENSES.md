# Licence inventory

AgentGuild itself is **MIT**. This page records what comes in through the dependency tree, why each
entry is safe for commercial use, and how to re-check after any dependency change.

Regenerate with:

```bash
node scripts/license-report.mjs
```

It exits non-zero if a copyleft or non-commercial licence enters the tree, so it is safe to run in CI.

## Runtime dependencies (shipped)

| Package | Licence | Why it is here |
| --- | --- | --- |
| `express` | MIT | HTTP server |
| `cors` | MIT | development-time CORS |
| `ws` | MIT | WebSocket transport |
| `react`, `react-dom` | MIT | UI |
| `pptxgenjs` | MIT | PPTX export |

SQLite is Node 22's built-in `node:sqlite`, so there is **no native module and no build toolchain**
in the install path.

## Full tree (including dev dependencies)

330 packages as of the last audit:

| Licence | Count |
| --- | ---: |
| MIT | 274 |
| ISC | 21 |
| Apache-2.0 | 18 |
| BSD-2-Clause | 6 |
| BSD-3-Clause | 3 |
| MPL-2.0 | 3 |
| Python-2.0 | 1 |
| CC-BY-4.0 | 1 |
| (MIT OR GPL-3.0-or-later) | 1 |
| (MIT AND Zlib) | 1 |
| 0BSD | 1 |

No GPL, AGPL, SSPL, BUSL, Elastic, Commons Clause or non-commercial licence appears anywhere.

## Entries worth a note

| Package | Licence | Assessment |
| --- | --- | --- |
| `jszip` | `MIT OR GPL-3.0-or-later` | Dual-licensed. **We elect the MIT branch**, which is the recipient's choice under the dual grant. Reached only through `pptxgenjs`. |
| `lightningcss` (+ 2 platform binaries) | MPL-2.0 | File-level copyleft: obligations attach only to modified MPL files, of which there are none. Build-time only (Tailwind), never shipped. |
| `pako` | `MIT AND Zlib` | Both permissive. Build/runtime of `jszip`. |
| `caniuse-lite` | CC-BY-4.0 | A browser-support **data** set requiring attribution only. Build-time only. |
| `argparse` | Python-2.0 | PSF licence, permissive and GPL-compatible. Build-time only. |

## What is deliberately absent

| Not used | Reason |
| --- | --- |
| Remotion / `@remotion/cli` | Source-available under its own licence, which requires a paid company licence past a small-team threshold. This was the single commercial blocker in the project analysed in `ANALYSIS.ja.md`; the `film` pack produces text deliverables instead. |
| `pixi.js` | MIT and unproblematic, but the office is drawn with Canvas 2D — one fewer dependency and no sprite assets. |
| `better-sqlite3` and similar | Native build step; `node:sqlite` covers the need. |
| Bundled fonts | System font stacks only, so no font licence travels with the repository. |
| Bundled images / sprites / audio | None. Characters are generated at runtime; the logo is inline SVG. |

## Attribution obligations when you redistribute

1. Keep `LICENSE` (MIT) in any copy or derivative.
2. If you vendor `node_modules` into a distributed artefact, include the licence texts of the packages
   above — Apache-2.0 and the BSD family require the notice to travel with the binary.
3. If you re-enable a removed dependency, re-run `node scripts/license-report.mjs` and update this file.
