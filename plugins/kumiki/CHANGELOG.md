# Changelog

All notable changes to Kumiki are recorded here.
Versions follow [Semantic Versioning](https://semver.org/).

## [0.1.0] — 2026-08-29

First release.

### Added

**Collection (`kumiki gather`)**
- Dependency-free HTTP fetcher: robots.txt compliance, per-host rate limiting,
  `Crawl-delay` support, exponential backoff honouring `Retry-After`,
  gzip/deflate decoding, charset detection (header → meta → UTF-8 → CP932 →
  EUC-JP), 5 MB response cap.
- Content-addressed HTTP cache with TTL and purge.
- `fetch`, `crawl` (depth/include/exclude/same-host), `sitemap` (index-aware),
  `select` (CSS-subset extraction to text/JSON/CSV), `cache`.
- Forgiving HTML tree builder with implied-close rules, plus a CSS selector
  subset: tag, `.class`, `#id`, `[attr]`, `[attr=v]`, `^= $= *= ~= |=`,
  descendant, child, and selector groups.
- Main-content detection scoring text volume, paragraph count, and link density.
- Markdown rendering with headings, nested lists, tables, blockquotes, code
  blocks, and absolutised links.
- Citation front matter on every note: title, source, canonical, site, author,
  published, modified, lang, fetched_at, content_hash, est_tokens.
- `_manifest.json` per collection run.

**Token thrift (`kumiki thrift`)**
- Script-aware token estimator (CJK and Latin counted separately).
- `budget` with per-file read verdicts.
- `outline` for Markdown headings and symbols in Python, JS/TS, Go, Rust, Ruby,
  and shell.
- `slice` by heading, with or without subsections.
- `index` to build a compact corpus map.
- `plan` to fit a corpus into a token budget.

**Knowledge (`kumiki knowledge`)**
- `init` scaffolding: `sources/`, `notes/`, `decisions/`, `outputs/`.
- `audit` with seven checks: missing-source, broken-link, unbacked-figures
  (Japanese-aware), stale, oversize, duplicate-title, orphan.
- `--strict` exits 3 on error-severity findings for CI use.

**Skills** — `start`, `gather`, `plan`, `weave`, `thrift`, `compose`, `forge`.

**Agents** — `kumiki-scout` (bulk scan, minimal return),
`kumiki-auditor` (pre-ship verification).

**Hooks**
- Read guard: one-shot interception of bulk reads over 25k estimated tokens,
  answered with the file's outline. Fails open.
- Source ledger: records WebFetch/WebSearch URLs for later provenance.
  Fails open.

**Templates** — knowledge note, research report, product proposal.

**Tests** — 78 network-free tests via `kumiki selftest`.
