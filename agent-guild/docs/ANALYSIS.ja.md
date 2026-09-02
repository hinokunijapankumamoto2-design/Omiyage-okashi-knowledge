# 元リポジトリ分析と「商用フリー・完全オリジナル」化の設計判断

対象: `https://github.com/GreenSheep01201/claw-empire.git` (v2.0.4, Apache-2.0)
分析日: 2026-09-02

---

## 1. 元リポジトリは何をするソフトか

CLI / OAuth / API 経由で接続した AI コーディングエージェントを「仮想ソフトウェア会社の社員」として
運用するローカルファーストのオーケストレーターである。利用者は CEO 役となり、ピクセルアートの
オフィス画面越しに、部署をまたいだ委任・会議・レビュー・成果マージを指揮する。

### 規模

| 領域 | ファイル数 | 行数 |
| --- | ---: | ---: |
| `server/` (Express + node:sqlite + ws) | 221 | 59,326 |
| `src/` (React 19 + Vite + Tailwind 4 + PixiJS) | 190 | 43,699 |
| `scripts/` (QA・移行・OpenAPI 契約) | 31 | 7,258 |
| `tests/` (Playwright E2E) | 7 | 2,168 |
| 合計 | 449 | **約 112,000 行** |

### 中核機能（README の機能一覧と実装の突き合わせ結果）

1. ピクセルアートオフィス（部署ごとの部屋・移動・会議アニメーション）
2. ワークフローパック 6 種 (`development` / `report` / `web_research_report` / `novel` / `video_preprod` / `roleplay`)
3. カンバンボード（受信箱 → 計画 → 協議 → 進行 → レビュー → 完了）
4. CEO チャットと `$` ディレクティブ言語
5. マルチプロバイダー実行（Claude Code / Codex / Gemini / OpenCode / Kimi / Copilot / Antigravity）
6. 外部 LLM API 直結（OpenAI / Anthropic / Google / Ollama / OpenRouter ほか）
7. OAuth 連携（GitHub / Google、トークンを AES 暗号化して SQLite に保存）
8. WebSocket によるリアルタイム同期
9. git worktree による作業分離と CEO 承認後マージ
10. スキルライブラリ（600+）とカスタムスキルアップロード
11. 会議システムと AI 議事録生成、PowerPoint エクスポート
12. 社員/部署管理、XP・ランキング
13. 多言語 UI (en / ko / ja / zh)
14. メッセンジャー連携 (Telegram / Discord / Slack)
15. アプリ内アップデート通知

DB は SQLite（`node:sqlite`）で 28 テーブル、REST API は約 90 エンドポイント。

---

## 2. 「商用フリー」の観点で実際に何が問題なのか

ここが本件の核心である。**元リポジトリ自身のライセンスは Apache-2.0 であり、商用利用は既に許諾されている。**
README にも "Free for personal and commercial use" と明記されている。
つまり「Apache-2.0 だから商用で使えない」という前提は成り立たない。

実際の障害は、**同梱される依存関係と外部素材の側**にある。

### 2.1 最大の論点 — Remotion

`package.json` の `dependencies` に `remotion` と `@remotion/cli` (^4.0.429) が含まれ、
`video_preprod` パックの実行ゲート・レビュー判定・スキルブートストラップ（13 ファイル）から参照される。
`scripts/ensure-remotion-runtime.mjs` は `prestart` で自動実行され、Remotion CLI の存在を前提にする。

Remotion は MIT ではなく独自の **Remotion License**（ソース公開だが、一定規模を超える企業での利用に
有償の Company License を要求する）で配布されている。したがって、

- 元リポジトリの**自作コード**は Apache-2.0 で商用自由
- しかし**そのまま `pnpm install` して社内配布・製品組み込み**すると、Remotion の商用条件が別途かかる

という二層構造になっている。企業で使う場合はここを必ず確認すべきである。
（Remotion の条件は改定されうるため、実際の判断前に https://remotion.dev/license を確認すること。）

### 2.2 その他の要確認事項

| 項目 | 内容 | 本プロジェクトでの扱い |
| --- | --- | --- |
| `public/sprites/*.png` (71 枚) | キャラクタースプライト。著作権表記なし、出所不明 | **不採用**。全キャラを実行時に手続き的に描画し、画像ファイルを 1 枚も持たない |
| `Sample_Img/*` (23 点 + mp4) | スクリーンショット・紹介動画 | 不採用 |
| `tools/ppt_team_agent` (submodule) | 同作者の別リポジトリ。ライセンス未確認 | 不採用。PPTX 出力は `pptxgenjs` (MIT) で自前実装 |
| `tools/playwright-mcp` (submodule) | Microsoft、Apache-2.0 | 不採用（必要なら任意で追加可能） |
| フォント `Sora` / `IBM Plex Sans KR` | OFL 系だが CSS でハードコード参照 | 不採用。システムフォントスタックのみ |
| `pixi.js` | MIT。商用問題なし | 不採用（Canvas 2D で自前描画。依存を 1 つ減らすため） |
| ブランド名 "Claw-Empire" / ロゴ SVG | 著作物・呼称 | 不採用。別名・別ロゴ |

### 2.3 結論

「機能はそのまま、商用フリーで完全オリジナル」を満たすには次の 3 点が必要だった。

1. **コードをクリーンルームで書き直す** — 機能仕様（何ができるか）は著作権の保護対象ではないが、
   コードそのものは Apache-2.0 の帰属義務を負う。帰属義務ごと外すなら独自実装が必要。
2. **Remotion を排除する** — 商用条件が別建てになる唯一の実行時依存だったため、機能ごと再設計した。
3. **出所不明のバイナリ素材をゼロにする** — 画像・音声・フォントファイルを一切同梱しない構成にした。

---

## 3. 本プロジェクト (AgentGuild) の設計方針

### 3.1 ライセンス

**MIT**。帰属表示だけで商用利用・改変・再配布・クローズドソース化が可能。

### 3.2 依存関係（実行時）

| パッケージ | ライセンス | 用途 |
| --- | --- | --- |
| express | MIT | HTTP |
| cors | MIT | 開発時 CORS |
| ws | MIT | WebSocket |
| zod | MIT | 入力検証 |
| react / react-dom | MIT | UI |
| pptxgenjs | MIT | PPTX 出力 |

データベースは Node 22 標準の `node:sqlite` を使うため、`better-sqlite3` 等のネイティブ依存が無く、
ビルドツールチェーンも不要である。
開発依存も含めた 330 パッケージの内訳は MIT 274 / ISC 21 / Apache-2.0 18 / BSD 9 / MPL-2.0 3 / その他 5 で、
コピーレフト（GPL/AGPL/SSPL/BUSL）や非商用条項を含むものは無い。
`jszip` のみ `(MIT OR GPL-3.0-or-later)` のデュアルライセンスであり、**MIT 側を選択して利用する**。
詳細は `docs/LICENSES.md`。

### 3.3 素材

画像・フォント・音声ファイルを一切同梱しない。

- キャラクター: `src/office/sprite.ts` が 10×14 のドットを実行時に矩形描画。配色は `avatar_seed` から
  xorshift32 で決定するため、同じ社員は常に同じ見た目になる。
- オフィス: `src/office/renderer.ts` が Canvas 2D で床・壁・机・モニタ・観葉植物を描画。
- ロゴ: `src/App.tsx` 内のインライン SVG。
- フォント: システムフォントスタックのみ。

### 3.4 アーキテクチャ上の意図的な差異

元実装と同じ機能を、別の構造で組み直している。

| 観点 | 元実装 | AgentGuild |
| --- | --- | --- |
| 部署・ワークフロー | DB シード + `workflow_packs` テーブル | `server/domain/packs.ts` の宣言的データ。パック追加はデータ追加のみ |
| プロバイダー | プロバイダーごとの分岐コード | `server/providers/registry.ts` のレジストリ + 2 種のアダプタ（CLI / HTTP）。追加は 1 エントリ |
| スキーマ | `base-schema.ts` + 個別マイグレーションファイル | 順序付き冪等マイグレーション配列 + `applied_migrations` |
| エージェント出力の解釈 | 各所に散在 | `GUILD-REPORT` / `GUILD-REVIEW` の 2 ブロックに統一し `report-parser.ts` に集約 |
| 描画 | PixiJS + PNG スプライト | Canvas 2D + 手続き的スプライト（依存・素材ともゼロ） |
| リアルタイム | WebSocket | WebSocket + `lastEventId` によるリプレイ（再接続時に全再取得しない） |

