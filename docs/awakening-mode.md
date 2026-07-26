# Claude Code 覚醒モード 設計書

> Codex の「Personal Codex Operating Policy + `$codex-awakening`」を Claude Code に移植したもの。
> 本設計はユーザーとの共同設計で確定した（2026-07-26）。

---

## 1. 構成（3ファイル）

| ファイル | 配置先 | 役割 |
|---|---|---|
| `templates/global-CLAUDE.md.template` | `~/.claude/CLAUDE.md` に追記 | 常駐ポリシー。毎セッション自動読み込みされ、タスクを単純/複雑に振り分ける |
| `skills/awakening/SKILL.md` | `~/.claude/skills/awakening/` | 覚醒スキル本体。複雑タスクの実作業前に6ステップの覚醒手順を実行 |
| `install/install-awakening.ps1` | （実行するだけ） | 上記2つを配置するWindows用インストーラー。冪等（二重実行しても重複しない） |

## 2. 動作フロー

```
タスク受領
  └─ 常駐ポリシーで振り分け（毎回の再監査はしない）
      ├─ 単純なタスク → 覚醒手順を挟まず直接実行
      └─ 複雑なタスク → awakening スキル発動
            ├─ Step 1: 目的と完了条件の言語化（曖昧なら質問）
            ├─ Step 2: コンテキスト装填（mistakes.md + wiki/INDEX.md）
            ├─ Step 3: 前提の検証（事実と推測の区別）
            ├─ Step 4: リスク・盲点・代替案（不可逆操作の有無を判定）
            ├─ Step 5: 実行計画 + 検証計画（今やる/今はやらない）
            ├─ Step 6: リソース設定の監査（思考深度・サブエージェント）
            └─ 覚醒ブリーフィング提示
                  ├─ リスク高（不可逆操作あり）→ ユーザー承認を待って実行
                  └─ それ以外 → そのまま実行
タスク完了
  └─ ミスがあれば反省ノート（mistakes.md）に追記
      → 次回の覚醒（Step 2）がさらに賢くなる複利ループ
```

## 3. 確定した設計判断

共同設計で決めた内容の記録:

- **設置場所**: 全プロジェクト共通（`~/.claude/` 配下）。Codex版と同じユーザー共通設定方式
- **起動方式**: 自動振り分け。常駐ポリシーが単純/複雑を判定し、複雑なら自動発動。「覚醒」と明示すれば規模にかかわらず発動
- **覚醒手順の追加要素**: 反省ノート読み込み / 第2の脳(wiki)参照 / リソース設定の監査 / 検証計画の明文化 — 4つすべて採用
- **実行ゲート**: リスク高（不可逆操作を含む）の時だけ承認待ち。それ以外はブリーフィング提示後に即実行
- **判定が微妙な場合**: 失敗コストと不可逆性を基準に、高ければ複雑扱い
- **優先順位**: ユーザーの明示的な指示 > プロジェクト固有の指示（CLAUDE.md） > 本ポリシー

## 4. Codex → Claude Code 対応表

| Codex の仕組み | Claude Code での対応物 |
|---|---|
| ユーザー共通設定（Operating Policy） | `~/.claude/CLAUDE.md` |
| `$codex-awakening` スキル | `~/.claude/skills/awakening/SKILL.md` |
| reasoning effort（low〜max） | 拡張思考の深さ（Step 6 で監査） |
| Ultra（並列サブエージェント） | サブエージェント並列実行（Step 6 で要否判断） |
| `config.toml` の personality / verbosity | CLAUDE.md のトーン規則 / output styles |
| 危険コマンド検出 | Step 4 の不可逆操作判定 + 実行ゲート |

※ Codex 側の `$codex-awakening` スキル本体は空だったため、覚醒手順（6ステップ）は
Operating Policy の「複雑なタスクの品質基準」を元に Claude Code 版で新規設計した。

## 5. 導入手順（Windows）

```powershell
git pull
.\install\install-awakening.ps1
```

動作確認:
1. 任意のプロジェクトで Claude Code を起動
2. 「覚醒」と入力 → 覚醒手順が発動すればOK
3. 複雑なタスクを依頼 → 自動でブリーフィングが提示されればOK

手動導入する場合:
1. `skills/awakening/` を丸ごと `~/.claude/skills/` にコピー
2. `templates/global-CLAUDE.md.template` の内容を `~/.claude/CLAUDE.md` に追記
