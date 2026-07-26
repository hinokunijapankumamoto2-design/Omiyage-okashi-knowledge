# Claude Code 覚醒モード設計書

> Codex の「Personal Codex Operating Policy + `$codex-awakening`」を
> Claude Code に移植し、KENGOODメソッド（第2の脳・反省ノート）と統合した設計。

---

## 1. Codex 版の構造分析

Codex 覚醒モードは 3 層で構成されている。

| 層 | Codex での実体 | 役割 |
|---|---|---|
| ❶ 常駐ポリシー | Personal Codex Operating Policy（ユーザー共通設定） | タスクを「単純/複雑」に振り分ける判定基準。毎回は再監査しない |
| ❷ 覚醒スキル | `$codex-awakening` | 複雑タスクの実作業前にだけ発動する品質チェック手順 |
| ❸ 優先順位 | ポリシー末尾の規定 | ユーザー明示指示 > プロジェクト指示 > 本ポリシー |

設計思想のポイント:

- **常時全開にしない。** 単純タスクで毎回モデル・設定を再監査するとオーバーヘッドになるため、覚醒は複雑タスク限定
- **判定が微妙なら「失敗コストと不可逆性」で決める**
- **明示呼び出し（`$codex-awakening`）は規模にかかわらず必ず発動**

## 2. Codex → Claude Code 対応表

| Codex の仕組み | Claude Code での対応物 |
|---|---|
| ユーザー共通設定（Operating Policy） | `~/.claude/CLAUDE.md`（全プロジェクト共通）/ プロジェクトの `CLAUDE.md` |
| `$codex-awakening` スキル | `/awakening` スキル（`skills/awakening/SKILL.md`） |
| reasoning effort（low〜max） | 拡張思考の深さ（「考えて」→「深く考えて」→ ultrathink） |
| Sol / Terra / Luna のモデル階級 | Opus / Sonnet / Haiku の使い分け（`/model`） |
| Ultra（並列サブエージェント） | Agent ツール（サブエージェント並列実行） |
| `config.toml` の personality / verbosity | output styles（`/output-style`）と CLAUDE.md のトーン規則 |
| 危険コマンド検出 | permission mode + PreToolUse フック |
| プラグイン自動提案 / MCP ツール検索 | Claude Code plugins（`/plugin`）+ MCP + ToolSearch |
| セッション開始時の初期化 | **SessionStart フック**（Codex に無い優位点） |

## 3. Claude Code 覚醒モードの3層設計

### 層❶ 常駐ポリシー（CLAUDE.md）

`templates/CLAUDE.md.template` の「覚醒モード」セクションに記載。
毎セッション自動読み込みされ、タスク振り分けだけを行う軽量ルール。

- 単純なタスク → 覚醒手順を挟まず直接実行
- 複雑なタスク → 実作業前に `/awakening` を実行
- 判定が微妙 → 失敗コストと不可逆性で判定。高ければ複雑扱い
- ユーザーが「覚醒」「覚醒モード」と明示 → 規模にかかわらず発動

### 層❷ 覚醒スキル（/awakening）

`skills/awakening/SKILL.md`。複雑タスク前に 6 ステップの覚醒手順を実行し、
「覚醒ブリーフィング」を提示してから実作業に入る。

KENGOODメソッドとの統合が Codex 版との最大の差分:

- 覚醒時に `mistakes.md`（反省ノート）を必ず読み込み、過去のミスルールを適用
- 覚醒時に `wiki/INDEX.md`（第2の脳）を参照し、関連ナレッジを実作業に持ち込む
- タスク完了後の検証結果は Stop フック経由で `mistakes.md` に還流

つまり「覚醒 → 実行 → 反省 → 次回の覚醒がさらに賢くなる」という複利ループになる。

### 層❸ 自動起動（SessionStart フック）

`templates/settings.json.template` の SessionStart フック。
セッション開始時に反省ノートを自動注入する「軽い覚醒」。
Codex では手動だった初期化が、Claude Code では完全自動化できる。

## 4. 運用フロー

```
セッション開始
  └─ SessionStart フック: mistakes.md を自動読み込み（軽い覚醒）
       │
タスク受領 → CLAUDE.md のポリシーで振り分け
  ├─ 単純 → そのまま実行
  └─ 複雑 → /awakening（完全覚醒）
             ├─ 1. 目的と完了条件の言語化
             ├─ 2. コンテキスト装填（mistakes.md / wiki）
             ├─ 3. 前提の検証（事実と推測の区別）
             ├─ 4. リスク・盲点・代替案
             ├─ 5. 実行計画（今やる / 今はやらない）
             └─ 6. リソース設定（思考深度・モデル・サブエージェント）
       │
実行 → 検証 → 完了
  └─ Stop フック: ミスがあれば mistakes.md に自動蓄積 → 次回の覚醒が賢くなる
```

## 5. 導入手順

1. `skills/awakening/` を `~/.claude/skills/` にコピー（全プロジェクト共通にする場合）
2. `templates/CLAUDE.md.template` の「覚醒モード」セクションを CLAUDE.md に反映
3. `templates/settings.json.template` の SessionStart フックを `.claude/settings.json` にマージ
