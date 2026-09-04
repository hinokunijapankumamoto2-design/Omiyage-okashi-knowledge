---
name: gather
description: Web から一次情報を収集し、出典メタデータ付き Markdown に変換する。スクレイピング、クローリング、サイトマップ収集、CSSセレクタでの構造化抽出、robots.txt 尊重、レート制限、キャッシュを扱う。Collect web sources into citable Markdown - scraping, crawling, sitemaps, CSS-selector extraction. 「ページを取得したい」「サイトを巡回したい」「商品情報を一覧で抜きたい」「競合サイトを調べたい」「一次情報を集めたい」ときに使う。外部の有料APIは使わず自作フェッチャーで完結する。
argument-hint: [URL または調査対象]
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/kumiki.py gather *), Read, Write, Grep, Glob
---

# 集材 — 一次情報を、あとで引用できる形で取る

**In one line:** every page you fetch comes back with the metadata that makes it citable.

`WebFetch` との違いは3つ。**出典メタが構造化される**、**キャッシュが効く**、
**同じ抽出を再現できる**。単発の確認は `WebFetch` で十分。ナレッジに積むなら
このスキルを使う。

## 使い分け

| 状況 | コマンド |
|---|---|
| URL が分かっている（1〜数十件） | `gather fetch` |
| 起点だけ分かっていて周辺も要る | `gather crawl` |
| サイト全体から条件で絞る | `gather sitemap --match` |
| 決まった項目を表にしたい | `gather select` |
| 1ページ読んで終わり | Kumiki を使わず `WebFetch` |

## 1. fetch — URL指定で取る

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/kumiki.py" gather fetch \
  https://example.com/a https://example.com/b \
  --out knowledge/sources/
```

1URL につき 1 つの `.md` が書かれ、先頭に front matter が付く：

```yaml
title / source / canonical / site / author / published / modified
lang / fetched_at / content_hash / est_tokens
```

`_manifest.json` に全件の一覧とトークン総量が残る。**これが引用台帳になる。**

## 2. crawl — 起点から辿る

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/kumiki.py" gather crawl \
  https://example.com/news --depth 2 --max-pages 30 \
  --include '/news/2026/' --exclude '/tag/|/author/' \
  --out knowledge/sources/
```

- `--depth` は起点からのリンク段数。2 を超える指定はほぼ常に間違い。
- `--max-pages` は目標ではなく**上限**。既定 25。先に小さく回して確かめる。
- 既定で同一ホストのみ。外部に出るなら `--allow-offsite` を明示。

## 3. sitemap — サイト全体から絞る

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/kumiki.py" gather sitemap \
  https://example.com/sitemap.xml --match '/products/' --limit 200
```

URL 一覧が出る。中身も要るなら `--fetch --max-pages 30 --out …` を足す。
サイトマップインデックスは1階層だけ自動で辿る。

## 4. select — 項目を決めて表にする

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/kumiki.py" gather select \
  https://shop.example/item/1 https://shop.example/item/2 \
  --field name=h1 \
  --field price='.price' \
  --field maker='[itemprop=brand]' \
  --format csv
```

対応セレクタ: `tag` `.class` `#id` `[attr]` `[attr=v]` `[attr^=v]` `[attr$=v]`
`[attr*=v]`、子孫（空白）、直下（`>`）、グループ（`,`）。
擬似クラスと `:nth-child` は非対応 — 必要なら JSON で出して後段で絞る。

セレクタが分からないときは、まず 1 ページ `fetch` して構造を見る。

## 礼儀（既定で有効、外すには明示指定が要る）

| 項目 | 既定 | 変更 |
|---|---|---|
| robots.txt | 尊重する | `--ignore-robots`（自社サイトのみ） |
| 同一ホストへの間隔 | 1.5秒 | `--delay` |
| Crawl-delay 宣言 | 従う（既定値より長い方を採用） | — |
| 429 / 5xx | 指数バックオフ、`Retry-After` 順守 | `--timeout` |
| キャッシュ | 24時間 | `--cache-ttl` / `--no-cache` |
| 取得上限 | 5MB / ページ | — |

**`--ignore-robots` を自分の判断で付けない。** ユーザーが対象サイトの所有者
であると明言した場合にのみ使う。

## 取ったあと

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/kumiki.py" thrift index knowledge/sources \
  --out knowledge/sources/INDEX.md
```

**収集物を丸ごと読まない。** 索引を読み、必要なノートだけ開く。
30ページ取ったら、索引は 1〜2k トークン、本文合計は 50k を超える。

次工程は `/kumiki:weave`。
