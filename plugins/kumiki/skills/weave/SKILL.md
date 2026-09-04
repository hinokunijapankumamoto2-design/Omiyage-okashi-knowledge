---
name: weave
description: 収集した素材を、主張単位の再利用可能なナレッジノートに組み直す。出典の紐付け、矛盾検出、鮮度チェック、孤立ノート検出、監査を行う。Turn gathered sources into a citable knowledge base - provenance, contradiction checks, staleness, orphan detection, audit. 「集めた情報を整理したい」「ナレッジ化したい」「第2の脳を作りたい」「資料がバラバラで使えない」「出典を紐付けたい」「ナレッジを監査したい」ときに使う。
argument-hint: [ナレッジベースのパス]
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/kumiki.py *), Read, Write, Edit, Grep, Glob
---

# 組む — 素材を、判断に使える形に組み替える

**In one line:** a note that cannot be traced to a source is not knowledge, it is a rumour with formatting.

集めただけの資料は使えない。ページ単位で並んでいるものを、**主張単位**に
組み替える工程。

## 四層

```
sources/    取得したまま。手で編集しない。1ページ1ファイル。
notes/      あなたの解釈。1主張1ファイル。数値は必ず sources/ を指す。
decisions/  結論と理由。日付必須。覆すときは削除せず上書き記録。
outputs/    成果物。notes/ から組み立てる。ここを直接直さない。
```

**`sources/` と `notes/` を混ぜない。** 混ぜた瞬間、どこまでが事実でどこからが
解釈か分からなくなる。この境界がナレッジベースの価値そのもの。

## 手順

### 1. 索引を作り、それだけを読む

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/kumiki.py" thrift index knowledge/sources \
  --out knowledge/sources/INDEX.md
```

索引に「何がどこにあるか」が出る。**本文は必要になってから開く。**
30ページの収集物なら、索引は約2%のコストで全体像を与える。

### 2. 主張を抜き出す

`sources/` を横断して、繰り返し出てくる主張・数値・対立点を拾う。
Grep が効く。

```bash
grep -rn "前年比\|構成比\|シェア\|%" knowledge/sources --include='*.md' | head -50
```

### 3. 1主張1ノートで書く

```markdown
---
title: 駅ナカ土産菓子の売上は2024→2026で年平均5%成長
source: knowledge/sources/kashi-shimbun-ekinaka.md
supporting:
  - knowledge/sources/jr-east-ir-2026.md
updated: 2026-08-29
confidence: medium
---

## 主張
駅ナカチャネルの土産菓子売上は 2024→2026 で年平均 5.2% 成長している。

## 根拠
- 菓子新聞 2026-08-01: 2026上期 前年比112% ([出典](../sources/kashi-shimbun-ekinaka.md))
- JR東日本 IR 2026: 駅ナカ商業 売上前年比108% ([出典](../sources/jr-east-ir-2026.md))

## 反証・留保
- 2024年は前年の反動増を含む。2019年比では 96%。
- 「土産菓子」の定義が資料間で一致していない（菓子新聞は生菓子を除外）。

## この主張が効く判断
新商品を駅ナカ主体で出すかどうか。
```

**`## 反証・留保` を空にしない。** 空のノートは、検証していないことの証拠。

### 4. 監査する

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/kumiki.py" knowledge audit knowledge --strict
```

7つの腐り方を検出する：

| 検査 | 意味 | 対応 |
|---|---|---|
| `missing-source` | front matter に `source:` がない | 出典を付ける、または主張を削る |
| `broken-link` | 相対リンク先が存在しない | パスを直す |
| `unbacked-figures` | 出典なしノートに数値が3件以上 | 出典を付ける |
| `stale` | 日付が閾値（既定180日）より古い | 再取得するか「時点情報」と明記 |
| `oversize` | 1ノートが4,000トークン超 | 主張ごとに割る |
| `duplicate-title` | 同名ノートが複数 | 統合するか名前を分ける |
| `orphan` | どこからもリンクされていない | 索引か関連ノートから張る |

`--strict` はエラー検出時に終了コード 3 を返す。CI に載せられる。

閾値は `knowledge/kumiki.json` で変える：

```json
{ "stale_days": 180, "max_note_tokens": 4000, "require_source_in": ["notes", "sources"] }
```

### 5. 矛盾を潰す

同じ論点で反対の数値が出たら、**片方を消さない**。両方残して、差の理由を書く。

```markdown
## 矛盾
- A社調査: 駅ナカ構成比 32%
- B社調査: 駅ナカ構成比 21%
- 差の理由: A社は空港内の駅売店を駅ナカに算入。定義差であり、どちらも誤りではない。
- 本ナレッジでの採用: B社定義（空港と分離）。理由は判断が空港との比較だから。
```

定義差を潰さずに数字だけ並べた資料は、必ず後で誤読される。

## 完了条件

- `knowledge audit --strict` が終了コード 0
- 全 `notes/` に `## 反証・留保` がある
- 採用した定義が1箇所に書かれている

次工程は `/kumiki:compose`。
