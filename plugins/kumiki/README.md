# Kumiki 組木

**Research → Knowledge → Output, joined without waste.**
A Claude Code plugin that collects web sources into citable Markdown, weaves them
into an auditable knowledge base, composes reports from it, and measures token
spend at every step.

Standard library only. **No pip install. No API keys. No external paid service.**

> 組木 (kumiki) is Japanese joinery: pieces interlock and hold without nails.
> Same idea here — the pipeline holds together without renting anyone's API.

---

## Why this exists

Three failures cost more than anything else in agentic research work:

| Failure | What it costs | What Kumiki does |
|---|---|---|
| Reading whole files to find one section | 70–90% of a context window | Measures before reading; hands you the outline, then the slice |
| Claims that lose their sources | The entire knowledge base, later | Every gathered page carries a citation record; the audit fails loudly without one |
| Re-fetching pages you already have | Requests, rate-limit budget, goodwill | Content-addressed cache, robots.txt, per-host pacing |

Token estimation is **script-aware**: `len(text)/4` undercounts Japanese by 3×,
which makes English-tuned budget tools useless for bilingual corpora.

---

## Install

```
/plugin marketplace add hinokunijapankumamoto2-design/Omiyage-okashi-knowledge
/plugin install kumiki@omiyage-okashi-lab
```

Requires Python 3.8+ on PATH as `python3`. Nothing else.

Verify:

```bash
python3 ~/.claude/plugins/*/kumiki/scripts/kumiki.py selftest
```

78 tests, no network, under a second.

---

## The five stages

| Stage | Skill | Does | Done when |
|---|---|---|---|
| 集材 gather | `/kumiki:gather` | Fetch, crawl, sitemap, CSS-selector extraction | `sources/` holds notes with front matter and `_manifest.json` |
| 木取り plan | `/kumiki:plan` | Decompose the question, set falsifiable claims | "What would prove me wrong" is written down |
| 組む weave | `/kumiki:weave` | Rebuild sources into one-claim-per-note knowledge | `knowledge audit --strict` exits 0 |
| 鉋 thrift | `/kumiki:thrift` | Measure, outline, slice, index | Read strategy chosen before reading |
| 仕上げ compose | `/kumiki:compose` | Assemble reports and proposals from notes | Every figure links to a source |

Plus `/kumiki:start` (routing) and `/kumiki:forge` (turn a repeated task into a skill).

---

## Quick start

```bash
K=~/.claude/plugins/*/kumiki/scripts/kumiki.py

# 1. What would reading this corpus cost me?
python3 $K thrift budget ./docs --top 20

# 2. Collect sources, politely
python3 $K knowledge init ./knowledge
python3 $K gather crawl https://example.com/news \
  --depth 2 --max-pages 30 --include '/news/2026/' \
  --out ./knowledge/sources/

# 3. Map instead of reading
python3 $K thrift index ./knowledge/sources --out ./knowledge/sources/INDEX.md

# 4. Check it before trusting it
python3 $K knowledge audit ./knowledge --strict
```

---

## What ships

```
kumiki/
├── skills/          7 skills — start, gather, plan, weave, thrift, compose, forge
├── agents/          kumiki-scout (read a lot, return little)
│                    kumiki-auditor (find what should not ship)
├── hooks/           read guard + source ledger
├── scripts/
│   ├── kumiki.py    the CLI
│   └── kumikilib/   tokens · htmldom · extract · fetcher · cache · gather
│                    thrift · knowledge
├── templates/       knowledge note · research report · product proposal
└── tests/           78 tests, network-free
```

### CLI

```
kumiki gather     fetch · crawl · sitemap · select · cache
kumiki thrift     budget · outline · slice · index · plan
kumiki knowledge  init · audit
kumiki selftest
```

### Hooks

**Read guard** (`PreToolUse` on `Read`) — the first bulk read of a file over
25,000 estimated tokens is intercepted **once** and answered with the file's
outline instead. The second identical read goes through. The point is to make
the cheap option visible, not to override your judgement.

```bash
KUMIKI_READ_GUARD=off            # disable
KUMIKI_READ_GUARD_TOKENS=50000   # raise the threshold
```

**Source ledger** (`PostToolUse` on `WebFetch`/`WebSearch`) — records which URLs
entered the session, so a note written mid-conversation can still be sourced.
`KUMIKI_LEDGER=off` disables it.

Both hooks fail open: any error exits 0 and the tool call proceeds.

---

## Politeness, by default

| Behaviour | Default | Override |
|---|---|---|
| robots.txt | respected | `--ignore-robots` (sites you own) |
| Per-host interval | 1.5 s | `--delay` |
| `Crawl-delay` directive | obeyed, longer value wins | — |
| 429 / 5xx | exponential backoff, honours `Retry-After` | `--timeout` |
| HTTP cache | 24 h, content-addressed | `--cache-ttl`, `--no-cache` |
| Response cap | 5 MB/page | — |
| Crawl scope | same host only | `--allow-offsite` |

`--ignore-robots` exists for pages you own, and the caller has to type it.

---

## What the audit catches

`kumiki knowledge audit` reports seven ways a knowledge base rots:

`missing-source` · `broken-link` · `unbacked-figures` · `stale` · `oversize` ·
`duplicate-title` · `orphan`

`--strict` exits 3 on any error-severity finding, so it drops into CI.

The `unbacked-figures` check understands Japanese: `駅ナカは32%` matches, where a
`\b`-anchored pattern would not, because Japanese particles are word characters.

---

## 日本語

Kumiki は「調べる → 束ねる → 出す」を1本の工程として扱う Claude Code プラグインです。

- **集材** — robots.txt 尊重・レート制限・キャッシュ付きの自作フェッチャーで
  一次情報を取得し、出典メタ付き Markdown にします。外部の有料 API に依存しません。
- **木取り** — 問いを反証可能な主張に割り、「何が出たら否定するか」を先に決めます。
- **組む** — 素材を1主張1ノートに再構成し、7種類の腐り方を機械監査します。
- **鉋** — 読む前にコストを測ります。日本語を正しく数えるトークン推定器を積んでいます。
- **仕上げ** — ノートから成果物を組み立てます。数値には必ず出典リンクが付きます。

`sources/`（取得したまま）と `notes/`（あなたの解釈）を混ぜないこと、
出典のない数値を書かないこと。この2つがこのプラグインの背骨です。

各スキルの本文は日本語で書かれています。`/kumiki:start` から入ってください。

---

## License

Source-available, **not** open source. Free for personal use, evaluation, and
internal use inside one organisation; commercial redistribution or resale needs a
licence. See [LICENSE](LICENSE).

To ship this as MIT instead, replace `LICENSE` and the `license` field in
`.claude-plugin/plugin.json` and the marketplace entry — nothing else depends on it.

© Omiyage Okashi Lab / お土産お菓子研究所
