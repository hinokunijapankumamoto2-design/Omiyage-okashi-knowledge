# Plugin anatomy — 配布可能なプラグインの全部品

`SKILL.md` から必要になったときだけ読む参照資料。Kumiki 自身がこの構造の実例。

## ディレクトリ

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json          マニフェスト（name のみ必須）
├── skills/<name>/SKILL.md   スキル。/my-plugin:<name> で起動
├── agents/<name>.md         サブエージェント
├── hooks/hooks.json         フック設定
├── scripts/                 フックとツールの実体
├── templates/               出力の骨格
├── tests/                   テスト
├── .mcp.json                MCP サーバー定義（任意）
├── README.md
├── LICENSE
└── CHANGELOG.md
```

配布するリポジトリの**直下**に `.claude-plugin/marketplace.json` を置く。
プラグイン本体はサブディレクトリでよい（`metadata.pluginRoot` で基準を指定）。

## plugin.json

| フィールド | 必須 | 内容 |
|---|---|---|
| `name` | ✓ | kebab-case。コマンドの接頭辞になる |
| `displayName` | | UI 表示名 |
| `version` | | セマンティックバージョン |
| `description` | | 一覧に出る説明 |
| `author` | | `{name, email, url}` |
| `homepage` / `repository` / `license` | | |
| `keywords` | | 検索用 |
| `defaultEnabled` | | `false` で無効状態から開始 |
| `skills` / `commands` / `agents` | | 既定パス以外を使うとき |
| `hooks` | | `"./hooks/hooks.json"` またはインライン |
| `mcpServers` | | `"./.mcp.json"` またはインライン |
| `userConfig` | | 有効化時にユーザーへ聞く設定項目 |
| `dependencies` | | 依存プラグイン |

`skills/` `agents/` `commands/` は既定パスにあれば自動検出されるので、
`plugin.json` に書かなくてよい。

### userConfig（API キーを預かるとき）

```json
{
  "userConfig": {
    "api_token": {
      "type": "string",
      "title": "API token",
      "description": "認証トークン",
      "sensitive": true
    }
  }
}
```

`sensitive: true` で入力がマスクされ、安全な保管領域に入る。
型は `string` `number` `boolean` `directory` `file`。

## marketplace.json

```json
{
  "name": "my-marketplace",
  "owner": { "name": "…", "url": "…" },
  "metadata": { "pluginRoot": "./plugins" },
  "plugins": [
    {
      "name": "my-plugin",
      "source": "./plugins/my-plugin",
      "version": "0.1.0",
      "description": "…",
      "category": "…",
      "keywords": ["…"]
    }
  ]
}
```

`source` は相対パスのほか、`{"source":"github","repo":"owner/repo","ref":"v1.0.0"}`
や `{"source":"archive","url":"…","sha256":"…"}` も取れる。

利用側:

```
/plugin marketplace add <owner>/<repo>
/plugin install <plugin-name>@<marketplace-name>
```

## パス変数

| 変数 | 指す場所 | 用途 |
|---|---|---|
| `${CLAUDE_PLUGIN_ROOT}` | プラグインの設置先 | 同梱スクリプト・テンプレート |
| `${CLAUDE_PLUGIN_DATA}` | 更新をまたいで残る領域 | キャッシュ・状態 |
| `${CLAUDE_PROJECT_DIR}` | プロジェクトルート | プロジェクト側の設定 |

SKILL.md 本文と `allowed-tools` の両方で展開される。同じ変数を両方に書けば、
同梱スクリプトを許可プロンプトなしで実行できる：

```yaml
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/kumiki.py *)
```

## hooks.json

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"${CLAUDE_PLUGIN_ROOT}/scripts/hooks/guard.py\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

### 出力仕様（command フック）

stdin に JSON が来る（`session_id` `tool_name` `tool_input` `cwd`、
PostToolUse では `tool_response` も）。stdout に返せるのは：

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow" | "deny" | "block",
    "permissionDecisionReason": "Claude に見せる説明"
  },
  "systemMessage": "ユーザーに見せる文字列"
}
```

- `additionalContext` は **PreToolUse / PostToolUse では無視される**。
  Claude に何か伝えたいなら `permissionDecisionReason`（deny 時のみ）を使う。
- 終了コード `0` = 正常、`2` = PreToolUse をブロック、それ以外 = 非ブロックエラー。
- **必ず fail-open にする。** 例外を握って `exit 0`。フックがセッションを
  壊すと、プラグイン全体が信用を失う。

## agents/<name>.md

```yaml
---
name: my-agent
description: 何を専門にするか
model: sonnet
effort: medium
maxTurns: 30
tools: Bash, Read, Grep, Glob
disallowedTools: Write, Edit
---

システムプロンプト本文。
```

対応フィールド: `name` `description` `model` `effort` `maxTurns` `tools`
`disallowedTools` `skills` `memory` `background` `isolation`。

## 配布前チェック

- [ ] `plugin.json` と `marketplace.json` が JSON として妥当
- [ ] 全スキルの `description` に、ユーザーが実際に打つ言い回しが入っている
- [ ] 同梱スクリプトが依存パッケージなしで動く（または依存を README に明記）
- [ ] フックが不正入力・欠損ファイルで exit 0 する
- [ ] `LICENSE` がある
- [ ] README に導入コマンドが1行で書いてある
- [ ] テストが1コマンドで走る
