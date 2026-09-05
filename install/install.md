# 導入手順（手動セットアップ）

お土産お菓子ナレッジ構築システムのセットアップ手順。所要時間 約10分。

## 前提条件

- [Obsidian](https://obsidian.md/) インストール済み
- [Claude Code](https://www.anthropic.com/claude-code) インストール済み
- Git（コマンドラインで利用可能）

## Step 1: リポジトリ取得

```bash
git clone https://github.com/hinokunijapankumamoto2-design/Omiyage-okashi-knowledge.git
cd Omiyage-okashi-knowledge
```

## Step 2: Obsidian Vault の準備

任意のディレクトリに Vault を作成。推奨パス例：

| OS | 推奨パス |
|---|---|
| Windows | `C:/Users/<ユーザー名>/Documents/OmiyageVault/` |
| Mac | `~/Documents/OmiyageVault/` |
| Linux | `~/OmiyageVault/` |

```bash
# Windows (PowerShell または Git Bash)
mkdir -p ~/Documents/OmiyageVault/{raw,wiki,outputs}
```

## Step 3: テンプレートを配置

```bash
# 変数定義（適宜書き換え）
VAULT_PATH="C:/Users/あなたのユーザー名/Documents/OmiyageVault"
LANGUAGE="ja"
TODAY=$(date +%Y-%m-%d)

# CLAUDE.md をコピー（プレースホルダ置換）
sed -e "s|{{VAULT_PATH}}|$VAULT_PATH|g" \
    -e "s|{{LANGUAGE}}|日本語|g" \
    templates/CLAUDE.md.template > "$VAULT_PATH/CLAUDE.md"

# mistakes.md をコピー
sed -e "s|{{CREATED_DATE}}|$TODAY|g" \
    templates/mistakes.md.template > "$VAULT_PATH/mistakes.md"

# INDEX.md をコピー
cp templates/INDEX.md.template "$VAULT_PATH/wiki/INDEX.md"
```

## Step 4: スキルを登録

Claude Code が読み込むユーザー階層にスキルをコピー：

```bash
# Windows (Git Bash)
mkdir -p ~/.claude/skills
cp -r skills/second-brain ~/.claude/skills/
cp -r skills/reflection-notes ~/.claude/skills/
cp -r skills/x-buzz ~/.claude/skills/          # Xバズskill
```

## Step 5: Vault パス設定

`~/.claude/knowledge-config.json` を作成：

```json
{
  "vault_path": "C:/Users/あなたのユーザー名/Documents/OmiyageVault",
  "language": "ja",
  "created_at": "2026-04-16"
}
```

## Step 6: Stop Hook 登録

`~/.claude/settings.json` をエディタで開き、`hooks` セクションを追加（既存設定とマージ）：

```json
{
  "hooks": {
    "Stop": [
      {
        "type": "prompt",
        "prompt": "セッション中の会話を振り返り、以下の3条件をすべて満たすミスがあったか確認してください：\n1. ユーザーが明示的に訂正した\n2. 同じミスが今後も起きそうなパターン\n3. 具体的な「する/しない」として書ける\n\n条件を満たすミスがあった場合のみ、C:/Users/あなたのユーザー名/Documents/OmiyageVault/mistakes.md に以下のフォーマットで追記してください：\n\n## YYYY-MM-DD: [ミスの一言説明]\n**やったこと（NG）**: [AIがした間違い]\n**正しい動作**: [次回からの正しい対応]\n**トリガー**: [このルールが適用される状況]\n\n条件を満たすミスがなかった場合は何もしないでください。"
      }
    ]
  }
}
```

※ パスは実際の Vault パスに置き換えること。

## Step 7: 動作確認

```bash
claude
```

Claude Code が起動したら：

```
> /second-brain
```

と入力し、反応があればセットアップ成功。

## トラブルシューティング

### スキルが認識されない

- `ls ~/.claude/skills/` で `second-brain` `reflection-notes` `x-buzz` があるか確認
- Claude Code を再起動

### Stop Hook が発火しない

- `~/.claude/settings.json` の JSON 構文エラーがないか確認（JSONLintで検証）
- mistakes.md のパスが絶対パスになっているか確認

### Windows でパス区切り文字エラー

- バックスラッシュ `\` ではなくスラッシュ `/` を使用
- または `\\` でエスケープ
