# AgentGuild

**AI エージェントの仮想会社シミュレーター。ローカルファースト、依存クリーン、MIT ライセンス。**

CLI エージェント（Claude Code / Codex / Gemini CLI / OpenCode ほか）と HTTP API（OpenAI 互換 /
Anthropic / Ollama）を「社員」として編成し、部署・タスクボード・レビュー・git worktree 分離を備えた
仮想的な会社として運用する。利用者は CEO として指示を出すだけでよい。

> 本プロジェクトは `GreenSheep01201/claw-empire` の機能セットを参考に、
> **コード・素材ともに一から独自実装した別プロジェクト**である。
> 経緯と設計判断は [`docs/ANALYSIS.ja.md`](docs/ANALYSIS.ja.md) を参照。

- 画像・フォント・音声ファイルを**一切同梱しない**（キャラクターは実行時に手続き的に描画）
- 実行時依存は 7 パッケージ、すべて MIT
- SQLite は Node 22 標準の `node:sqlite`。ネイティブビルド不要

---

## 必要環境

- Node.js **22.5 以上**（`node:sqlite` を使用）
- git（worktree 分離を使う場合）
- 任意: `claude` / `codex` / `gemini` / `opencode` のいずれかの CLI

## セットアップ

```bash
cd agent-guild
npm install
cp .env.example .env
# 推奨: 資格情報の暗号鍵を生成して .env の AG_SECRET_KEY に設定
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

### 開発モード

```bash
npm run dev
# フロント: http://127.0.0.1:5310  (API を 5311 にプロキシ)
```

### 本番モード

```bash
npm run build
npm start
# http://127.0.0.1:5311 で SPA と API を同一オリジン配信
```

初回起動時に 6 パック分の部署・18 名の社員・24 個の標準スキルが自動投入される。

---

## 使い方

### 1. プロジェクトを登録する

`Projects` タブでエージェントに作業させるディレクトリの**絶対パス**を登録する。
git リポジトリなら `worktree` 分離が既定になり、タスクごとに独立したブランチと作業ツリーが作られる。

### 2. タスクを出す

CEO チャットから `$` ディレクティブで指示する。

```
$task レート制限を追加 --brief "公開 API を保護する" --accept "10 req/s 超で 429" --dept build --prio 3
$plan  tsk_xxx      # 企画リードにサブタスクへ分解させる
$run   tsk_xxx      # 実行キューに投入
$review tsk_xxx     # レビュー担当に回す
$merge tsk_xxx      # 承認済みの worktree を取り込む
$discard tsk_xxx    # worktree とブランチを破棄
$help               # 全ディレクティブ
```

ボードからカードをドラッグしても同じ状態遷移が行える。

### 3. 進行を見る

`Office` タブで社員が自席に着き、作業中はモニタが光る。カードを開くと実行中の
ターミナル出力が WebSocket でそのまま流れる。

---

## 仕組み

```
CEO 指示
  └─ ディレクティブ解析 (server/engine/directives.ts)
      └─ タスク生成 (stage: planning)
          ├─ $plan → 企画リードが JSON でサブタスクを返す → 自動生成
          └─ $run  → ディスパッチャ
                ├─ 担当者選定（部署 → 空き状況 → 負荷）
                ├─ git worktree を開く（タスク専用ブランチ）
                ├─ プロンプト組み立て（パック規約 + 習得スキル + 受入基準）
                ├─ ランナー実行（CLI プロセス or HTTP API）
                ├─ GUILD-REPORT ブロックを解析
                ├─ 変更をコミット
                └─ stage: review → レビュー担当が GUILD-REVIEW を返す
                      accept → done / revise → 差し戻して再実行 / reject → blocked
```

### ギルドパック

会社のプロファイル。部署構成・ルーティング順・レビュー観点・プロンプト規約をまとめて切り替える。

| キー | 名称 | 用途 |
| --- | --- | --- |
| `software` | ソフトウェアスタジオ | 標準の開発ベースライン |
| `document` | ドキュメント編集局 | レポート・仕様書・マニュアル |
| `research` | リサーチデスク | 出典重視の調査 |
| `narrative` | ナラティブハウス | 長編フィクション（設定整合性重視） |
| `film` | 映像プリプロ班 | 企画・脚本・ショットリスト |
| `persona` | ペルソナラボ | キャラクター対話 |

追加は `server/domain/packs.ts` にデータを 1 件足すだけでよい。

### ランナー（実行プロバイダー）

`server/providers/registry.ts` の宣言的レジストリで管理する。

- **CLI**: `claude` / `codex` / `gemini` / `opencode` / 任意のカスタム CLI
- **HTTP**: OpenAI 互換（OpenAI, OpenRouter, Together, Groq, Cerebras, vLLM …）、Anthropic、Ollama

API キーは AES-256-GCM で暗号化して SQLite に保存し、ブラウザには一切返さない（マスク表示のみ）。

### エージェントの応答契約

エージェントは応答の末尾に次のブロックを付けることを求められる。パーサは緩く、
ブロックが無い場合もフォールバックするが、レビューが読み取れない場合は
**自動承認せず CEO の判断待ちで停止する**。

```
GUILD-REPORT
status: done | blocked
summary: <1〜2 文>
changed: <パスのカンマ区切り、無ければ none>
verified: <実行した検証コマンド、無ければ none>
blocker: <status が blocked のときのみ>
```

---

## 安全側の既定

- `AG_ENABLE_EXECUTION=0` にするとプロセスを起動せず、パイプライン全体をシミュレートする
- `AG_ALLOWED_ROOTS` で書き込み可能なパス接頭辞を制限できる（未設定時は登録済みプロジェクトのみ）
- CLI は `shell: false` で起動する（プロンプト文字列がシェルに解釈されない）
- worktree 分離により、失敗した実行は元のチェックアウトに触れずに破棄できる
- `AG_RUN_TIMEOUT_MS`（既定 30 分）で暴走プロセスを打ち切る

## 環境変数

| 変数 | 既定 | 説明 |
| --- | --- | --- |
| `AG_HOST` / `AG_PORT` | `127.0.0.1` / `5311` | API の待受 |
| `AG_DB_PATH` | `.data/agent-guild.sqlite` | SQLite の場所 |
| `AG_SECRET_KEY` | (未設定) | 資格情報の暗号鍵。未設定時はマシン固有値から導出し UI で警告する |
| `AG_MAX_CONCURRENT_RUNS` | `3` | 同時実行数 |
| `AG_RUN_TIMEOUT_MS` | `1800000` | 1 実行の上限時間 |
| `AG_ENABLE_EXECUTION` | `1` | `0` でシミュレーション |
| `AG_ALLOWED_ROOTS` | (空) | 書き込み許可する絶対パス接頭辞（カンマ区切り） |

---

## ドキュメント

- [`docs/ANALYSIS.ja.md`](docs/ANALYSIS.ja.md) — 元リポジトリ分析とライセンス判断
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — 内部構造
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — 実装済み / 未実装の一覧
- [`docs/LICENSES.md`](docs/LICENSES.md) — 依存ライセンス内訳

## ライセンス

MIT。`LICENSE` を参照。
