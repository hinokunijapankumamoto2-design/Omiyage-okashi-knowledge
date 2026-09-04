---
name: thrift
description: トークン消費を実測して削る。読む前にコストを見積もり、アウトライン→スライスの順で読み、大規模コーパスは索引化して検索で当てる。Token thrift - measure before you read, outline instead of reading whole files, index a corpus instead of loading it. 「トークンを節約したい」「コンテキストが足りない」「ファイルが大きすぎて読めない」「コストを下げたい」「context window が溢れる」「効率よく読みたい」ときに使う。
argument-hint: [ファイル or ディレクトリ]
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/kumiki.py thrift *), Read, Grep, Glob
---

# 鉋 — 削るのは木くずであって、木ではない

**In one line:** measure the cost, read the map, then read only the span you need.

節約は「短く書く」ことではない。**要らないものを読まない**ことで、ほぼ全部が決まる。
出力の圧縮で得られるのは数%、読み方の変更で得られるのは 70〜90%。

## 4つの手

### 1. 測る — 読む前に必ず

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/kumiki.py" thrift budget ./docs --top 20
```

ファイルごとの推定トークンと判定が出る：

| 判定 | 意味 |
|---|---|
| `read-whole` | 400トークン以下。分割する方が高くつく |
| `read-whole-if-central` | 2,000以下。中心的な資料なら丸ごと |
| `outline-then-slice` | 12,000以下。地図を見てから該当箇所だけ |
| `index-and-search` | それ以上。開かない。Grep か索引で当てる |

推定器は**日本語を正しく数える**。`len/4` 系の見積もりは日本語を3倍以上
過小評価するので、日本語資料の予算管理には使えない。

### 2. 地図を読む

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/kumiki.py" thrift outline big.md
```

見出し（Markdown）または定義（.py / .ts / .js / .go / .rs / .rb / .sh）を、
行範囲と区間ごとのトークン量つきで出す。実測で**本文の2〜10%**。

### 3. 一区画だけ切り出す

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/kumiki.py" thrift slice big.md "価格戦略"
```

見出し名（部分一致可）でその節を、配下の小見出しごと出す。
行番号が付くので、続きが要るときは `Read(offset=…, limit=…)` に渡せる。

### 4. コーパスは索引にする

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/kumiki.py" thrift index ./knowledge \
  --out ./knowledge/INDEX.md
```

全ファイルの「パス・トークン量・タイトル・主要見出し」を1枚の表にする。
**この表を読んでから、当たりのついたファイルだけ開く。**

まとめて方針を出すなら：

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/kumiki.py" thrift plan ./knowledge --budget 30000
```

予算内に収まる読み方（丸読み / アウトライン / 検索のみ）に仕分けし、
素直に全部読んだ場合との差を出す。

## 自動ガード（フック）

25,000トークンを超えるファイルの**丸ごと Read が1回だけ止まり、代わりに
アウトラインが返る**。同じファイルへの2回目の Read はそのまま通る。
「安い選択肢を見せる」のが目的で、判断を奪うためではない。

```bash
KUMIKI_READ_GUARD=off              # 無効化
KUMIKI_READ_GUARD_TOKENS=50000     # 閾値変更
```

## 効く順（実測ベース）

1. **読まない。** Grep / Glob / 索引で位置を特定してから開く。最大の効果。
2. **部分だけ読む。** `outline` → `slice` → `Read(offset, limit)`。
3. **サブエージェントに投げる。** 大量ページの走査は `kumiki-scout` に渡し、
   要約だけ本文脈に戻す。読んだ生データは戻ってこない。
4. **キャッシュを効かせる。** `gather` は既定24時間キャッシュ。同じ URL の
   再取得は0コスト。
5. **出力を締める。** ここまでやって、ようやく数%。最後にやること。

## やってはいけない節約

- **出典リンクを削る。** 追跡不能なナレッジは作り直しになる。差し引きで高い。
- **反証・留保を削る。** 検証していないことを隠すだけで、コストは後払いになる。
- **監査を飛ばす。** `knowledge audit` は数百トークン。壊れたナレッジの
  作り直しは数万トークン。
