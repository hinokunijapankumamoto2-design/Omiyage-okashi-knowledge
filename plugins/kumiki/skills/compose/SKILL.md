---
name: compose
description: ナレッジベースから成果物（市場調査レポート・新商品企画書・提案書・比較表）を組み立てる。全ての数値に出典を紐付け、構成の型に沿って書き、出す前に検証する。Build reports and proposals from a knowledge base with every figure traced to a source. 「レポートを書きたい」「企画書を作りたい」「提案書にまとめたい」「調査結果を報告書にしたい」「比較表を作りたい」ときに使う。
argument-hint: [成果物の種類]
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/kumiki.py *), Read, Write, Edit, Grep, Glob
---

# 仕上げ — 組んだものを、読む人の形に整える

**In one line:** the output is assembled from notes, never typed from memory.

成果物は `notes/` から**組み立てる**。記憶や推測から書き起こさない。
書き起こした瞬間、出典の鎖が切れて、次の改訂で全部作り直しになる。

## 手順

### 1. 材料が揃っているか確認する

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/kumiki.py" knowledge audit knowledge --strict
```

エラーがある状態で書き始めない。**出典のない数値は、成果物に入った時点で
検証不能になる。**

### 2. 型を選ぶ

`${CLAUDE_PLUGIN_ROOT}/templates/` に骨格がある。

| 成果物 | テンプレート |
|---|---|
| 市場調査レポート | `research-report.md` |
| 新商品企画書 | `product-proposal.md` |
| 個別ナレッジノート | `knowledge-note.md` |

型は縮めてよいが、**`出典一覧` と `留保・限界` は落とさない**。この2節が
ないものは資料であって報告書ではない。

### 3. 書く

各節の数値に、`notes/` 経由で `sources/` へ辿れるリンクを付ける。

```markdown
駅ナカチャネルの構成比は 21%（[notes/ekinaka-share.md](../notes/ekinaka-share.md)）。
なお A社調査は 32% としているが、これは空港内駅売店を算入した定義差。
```

**書けない数値は書かない。** 概算しか出せないなら「推定」と明記し、
推定方法を1行で書く。

### 4. 出す前に検証する

- [ ] 全ての数値に出典リンクがあるか（`grep -oE '[0-9]+(\.[0-9]+)?%' 出力.md` で数を数え、リンク数と突き合わせる）
- [ ] `留保・限界` に、この報告で答えられないことが書かれているか
- [ ] 結論が、依頼された**決定**に答えているか（`/kumiki:plan` の1行に戻る）
- [ ] 反対意見が最強の形で書かれているか
- [ ] 数値の時点が明記されているか（「2026年上期時点」）

### 5. 記録する

結論は `knowledge/decisions/` にも残す。成果物は配布されて散逸するが、
`decisions/` は残る。

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/kumiki.py" thrift index knowledge/outputs \
  --out knowledge/outputs/INDEX.md
```

## 分量の決め方

「1万文字で」と指定されたときも、**中身が5千文字分しかないなら5千文字で出す**。
埋めるために書いた段落は、読み手に必ず見抜かれ、報告全体の信頼を落とす。
足りないと判断したら、何が足りないかを書いて `/kumiki:gather` に戻る。

## よくある失敗

| 失敗 | 直し方 |
|---|---|
| 数値が本文にだけあり、出典が末尾にまとめてある | 数値の直後にリンクを置く |
| 「〜と言われている」 | 誰が言ったかを書く。書けないなら削る |
| 全部の章を同じ厚さで書く | 決定に効く章を厚くし、他を削る |
| 反対意見が弱い形で書かれている | 最強の反論を自分で書く |
| 出典が二次情報（まとめ記事） | 一次資料に当たる。当たれないなら「未確認」と書く |
