---
name: forge
description: 繰り返している作業を Claude Code のスキル（SKILL.md）として切り出し、発火条件・進行手順・検証を設計する。プラグイン化・配布・スキルの改善も扱う。Author and improve Agent Skills - description design for reliable triggering, progressive disclosure, verification, packaging as a plugin. 「スキルを作りたい」「同じ指示を毎回貼っている」「プラグインにまとめたい」「スキルが発火しない」「SKILL.md を書きたい」ときに使う。
argument-hint: [切り出したい作業]
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/kumiki.py *)
---

# 鍛冶 — 3回やった作業は、道具にする

**In one line:** the description decides whether a skill ever runs; write it last, and write it as trigger phrases.

## 作る条件

- 同じ手順を**3回以上**やった
- CLAUDE.md の一節が、事実ではなく**手順**に育った
- 手順に「これを満たさないと次に進まない」ゲートがある

満たさないなら作らない。使われないスキルは、一覧に載るだけでコストになる。

## 構造

```
skills/<name>/
├── SKILL.md          本体。300行を超えたら分割の合図
└── references/       重い参照資料。必要になってから読ませる
```

**段階開示。** `SKILL.md` は「いつ・何を・どの順で」だけ。長い表、
テンプレート、例外一覧は `references/` に出し、本文からは
「詳細は `references/xxx.md`」と指す。呼ばれるまでコストは0。

## frontmatter

```yaml
---
name: gather                    # プラグイン内では /plugin:name になる
description: <発火条件がすべて>
argument-hint: [URL]
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/x.py *), Read
disable-model-invocation: true  # 副作用があり、人が起動を決めるべきもの
user-invocable: false           # 背景知識で、コマンドとしては無意味なもの
context: fork                   # 大量読み込みを別コンテキストで走らせる
---
```

### description が9割

description は**唯一、常時コンテキストに載る部分**。ここが弱いスキルは
一生発火しない。3要素を必ず入れる：

1. **何をするか**（動詞で）
2. **いつ使うか**（ユーザーが実際に打つ言い回しで）
3. **同義の言い換え**（日本語と英語の両方）

```yaml
# ✗ 発火しない
description: ナレッジ管理を支援します

# ✓ 発火する
description: 収集した素材を主張単位のナレッジノートに組み直し、出典紐付け・矛盾検出・
  監査を行う。Turn gathered sources into a citable knowledge base.
  「情報を整理したい」「ナレッジ化したい」「資料がバラバラ」「出典を紐付けたい」ときに使う。
```

`description` と `when_to_use` の合計は 1,536 文字で切られる。**重要な
発火語を先頭に置く。**

## 本文の書き方

- **手順は番号付き。** 判断の分岐は表にする。散文にしない。
- **完了条件を書く。** 「〜が揃っていること」まで書いて初めて手順になる。
- **やってはいけないことを書く。** 禁止は許可より情報量が多い。
- **コマンドはコピペで動く形で。** 変数は `${CLAUDE_PLUGIN_ROOT}` で書く。
- **例は1つだけ、実物で。** 抽象例は読み飛ばされる。

## プラグインにまとめる

```
my-plugin/
├── .claude-plugin/plugin.json
├── skills/<name>/SKILL.md
├── agents/<name>.md
├── hooks/hooks.json
├── scripts/
└── README.md
```

配布するなら、リポジトリ直下に `.claude-plugin/marketplace.json` を置く。
利用側は `/plugin marketplace add <owner>/<repo>` → `/plugin install <name>`。

Kumiki 自身がこの構造の実例。`${CLAUDE_PLUGIN_ROOT}` 以下を読めば全部ある。
詳細な項目一覧は `references/plugin-anatomy.md`。

## 検証

作ったら必ず：

1. **発火するか。** description に書いた言い回しで実際に呼び出してみる。
   呼ばれなければ description を直す。本文ではない。
2. **手順どおりに動くか。** 書いたコマンドを1つずつ実行する。
3. **落ちたときに壊れないか。** フックとスクリプトは fail-open にする。
   セッションを壊すスキルは、無いより悪い。

## やってはいけない

| 失敗 | 理由 |
|---|---|
| description に「〜を支援します」 | 発火語がない。一生呼ばれない |
| SKILL.md に参照資料を全部書く | 呼ばれるたびに全部コンテキストに載る |
| 破壊的操作を model invocation で許す | `disable-model-invocation: true` を付ける |
| フックが例外で落ちる | セッションが止まる。必ず exit 0 で握る |
| 1スキルに複数の目的 | どちらでも発火せず、どちらもうまくやらない |
