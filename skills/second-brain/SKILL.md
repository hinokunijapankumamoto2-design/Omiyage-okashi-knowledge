---
name: second-brain
description: Karpathy式個人ナレッジベース"Second Brain"を任意のObsidian Vault上に構築・運用するスキル。raw/wiki/outputs の3フォルダ構成で散在するメモ・記事・PDFをAIが整理し、質問→回答保存ループで複利的に成長する第二の脳を作る。ユーザーが「ナレッジベース」「セカンドブレイン」「Second Brain」「Karpathy式」「個人Wiki」「ナレッジ整理」「情報をまとめたい」などに言及した場合に発火。
---

# Second Brain (Karpathy式)

Andrej Karpathy (OpenAI創設メンバー) が提唱した個人ナレッジベース構築手法をObsidian Vault上で実現するスキル。

## Vault パスの解決手順

以下の順で Vault パスを取得する：

1. **環境変数** `KNOWLEDGE_VAULT_PATH` があればそれを使う
2. **設定ファイル** `~/.claude/knowledge-config.json` の `vault_path` を読む
3. どちらもなければ、**ユーザーに質問**する：
   ```
   「Obsidian Vault のパスを教えてください（例: C:/Users/xxx/Documents/my-vault/）。
    Vaultをまだ作っていない場合は新規作成します。」
   ```
4. 回答を元に `~/.claude/knowledge-config.json` に保存して再利用

```json
{
  "vault_path": "C:/path/to/your/vault",
  "language": "ja",
  "created_at": "2026-04-16"
}
```

## フォルダ構成（Vault内に作成）

- `raw/` — 生の素材（記事・メモ・スクショ・PDF）
- `wiki/` — AIが整理した構造化知識（`INDEX.md` + トピック別ファイル）
- `outputs/` — 生成物（レポート・要約・記事ドラフト）

## 実行モード

ユーザーの依頼内容から以下のいずれかに分岐する：

### モード A: 初期セットアップ（未構築の場合）

1. Vault の有無を確認（`{vault_path}/raw`, `{vault_path}/wiki`, `{vault_path}/outputs` があるか）
2. なければ3フォルダ＋`CLAUDE.md`＋`wiki/INDEX.md` を作成
3. スキーマ（AIへの指示ルール）を `CLAUDE.md` に記述（templates/CLAUDE.md.template参照）
4. ユーザーに「raw/ に素材を投入してください」と案内

### モード B: Wikiコンパイル（素材は揃っている）

1. `{vault_path}/raw/` 内の全素材を読み込む
2. トピック抽出 → `{vault_path}/wiki/` にトピック別 `.md` を生成
3. 各Wikiページは以下を遵守：
   - 冒頭に要約セクション（3行以内）
   - 末尾に `[[関連ページ]]` 形式のリンク
   - 出典URLまたは `raw/` 内の元ファイル名を保持
   - トーンは事実ベース・簡潔・設定言語
4. `{vault_path}/wiki/INDEX.md` にカテゴリ別リンク集を作成・更新
5. 既存Wikiがあれば統合（重複ページを作らない）

### モード C: 質問→蓄積ループ（日常運用）

1. ユーザーの質問に対し `{vault_path}/wiki/` 全体を横断検索して回答
2. 回答内容を `wiki/` の該当トピック（または新規ページ）に追記
3. 追記箇所には更新日を記録（`_updated: YYYY-MM-DD_`）
4. 使えば使うほど複利的に成長することを意識

### モード D: ヘルスチェック（月1回推奨）

以下3点を検査し、レポートを `{vault_path}/outputs/healthcheck-YYYY-MM-DD.md` に保存：

1. **矛盾**: 同一トピックで矛盾する記述がないか
2. **抜け漏れ**: `raw/` にあるが `wiki/` に反映されていない重要情報
3. **出典不明**: URLや元ファイル名が欠けている主張

### モード E: 出力物生成

ユーザーの依頼に応じて `{vault_path}/wiki/` の内容を編集し、`{vault_path}/outputs/` に保存（レポート、要約、記事、プレゼン素材など）。

## 素材自動収集（オプション）

大量のWebコンテンツを収集したい場合、Vercel Labs の `agent-browser` CLI を提案する（Playwright MCPの82%少ないトークンで動作）。ただし手動投入で十分な場合は不要。

## Vault側の CLAUDE.md スキーマ

Vault 内の `CLAUDE.md` に詳細ルールが記述されている（初回セットアップ時に `templates/CLAUDE.md.template` から生成）。本スキル実行時は必ずそれを尊重すること。
