---
name: start
description: Kumiki のパイプライン全体（集材→木取り→組む→鉋→仕上げ）の入口。調査・リサーチ・ナレッジ構築・レポート/企画書作成をどの順で進めるか決めるときに使う。Entry point for the Kumiki research-to-output pipeline; routes a request to gather / plan / weave / compose / thrift. 「調査したい」「ナレッジを作りたい」「レポートを書きたい」「何から始めればいい」といった、工程がまだ決まっていない依頼で最初に読む。
argument-hint: [調査テーマ or 作りたい成果物]
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/kumiki.py *), Read, Grep, Glob
---

# 組木 — 素材を集め、釘を使わず組み上げる

**In one line:** collect sources, keep every claim traceable, spend tokens on purpose.

Kumiki は「調べる → 束ねる → 出す」を1本の工程として扱う。各工程は独立したスキルで、
このスキルは**どの工程に入るかを決めるだけ**。決まったら該当スキルを読み、ここには戻らない。

## 五工程

| 工程 | スキル | やること | 完了の定義 |
|---|---|---|---|
| 集材 | `/kumiki:gather` | 一次情報を取得し、出典付き Markdown にする | `sources/` に出典メタ付きノートと `_manifest.json` がある |
| 木取り | `/kumiki:plan` | 問いを分解し、検証ゲートを先に決める | 「何が言えたら完了か」が文章で書けている |
| 組む | `/kumiki:weave` | 素材を主張単位のノートに再構成する | `knowledge audit` がエラー0 |
| 鉋 | `/kumiki:thrift` | 読む前にコストを測り、読み方を選ぶ | 読む対象と読み方が決まっている |
| 仕上げ | `/kumiki:compose` | ノートから成果物を組み上げる | 全ての数値に `sources/` へのリンクがある |

## 入口の決め方

依頼を読んで、**今ないもの**から始める。工程は飛ばしてよいが、順序は入れ替えない。

```
一次情報がない                 → /kumiki:gather
一次情報はあるが問いが曖昧      → /kumiki:plan
素材はあるが整理されていない    → /kumiki:weave
整理済みで成果物を作る          → /kumiki:compose
既存資料が多すぎて読み切れない  → /kumiki:thrift
同じ作業を3回以上繰り返している → /kumiki:forge
```

判断に迷うときの既定は `/kumiki:plan`。問いが定まっていない調査は、
何を集めても終わらない。

## 最初にやること（毎回）

対象ディレクトリのコストを測る。読む前に測るのがこのプラグインの原則。

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/kumiki.py" thrift budget . --top 15
```

ナレッジベースが未作成なら作る：

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/kumiki.py" knowledge init ./knowledge
```

`sources/` `notes/` `decisions/` `outputs/` の4層ができる。役割は
`knowledge/README.md` に書き出される。

## 全工程で破らない規則

1. **出典のない数値を書かない。** 出せないなら数値ごと落とす。推定値は
   「推定」と明記し、根拠を併記する。
2. **読む前にコストを測る。** 25k トークン級のファイルを丸ごと読む前に
   `thrift outline` を通す。フックが1回だけ自動で止める。
3. **`sources/` は手で編集しない。** 一次情報は取得したまま置く。解釈は
   `notes/` に書く。両者を混ぜた瞬間に、何が事実か分からなくなる。
4. **結論は `decisions/` に日付付きで残す。** 覆すときは削除ではなく上書き記録。

## ツール一覧

```
kumiki gather    fetch / crawl / sitemap / select / cache
kumiki thrift    budget / outline / slice / index / plan
kumiki knowledge init / audit
kumiki selftest
```

`python3 "${CLAUDE_PLUGIN_ROOT}/scripts/kumiki.py" --help` で全オプション。
標準ライブラリのみで動く。pip install も API キーも不要。
