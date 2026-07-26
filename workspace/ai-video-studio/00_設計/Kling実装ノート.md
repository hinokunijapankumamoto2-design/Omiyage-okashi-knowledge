# Kling 実装ノート

工程3（フォールバック）と工程4（生成モーション）で使う Kling MCP の実装記録。
ペイロード構築は `src/adapters/kling.ts`。仕様は who_am_i の実測値（2026-07-26、Free プラン）。

## 接続状態

- **MCP コネクタ**: 接続済み（`mcp__kling__*` 系ツールが使える）
- **kling-cli スキル**: リポジトリに導入済み（`.agents/skills/kling-cli/`）。
  ただし `kling login` はブラウザ OAuth が必要で、リモートコンテナでは egress 遮断
  （kling.ai への CONNECT が 403）とヘッドレスの二重の理由で完了できない。
  ローカルマシン専用の経路。

## ツールカタログ（実測）

| ツール | 用途 | 本スタジオでの役割 |
|---|---|---|
| `who_am_i` | モデル・引数仕様の取得（無償） | 仕様変更時の照合 |
| `query_membership_and_credits` | 残高確認（無償） | **生成前に必ず呼ぶ** |
| `file_upload` | ローカル画像の URL 化 | 工程4の前段 |
| `text_to_image` | 文生図 | 工程3フォールバック |
| `image_to_video` | 図生視頻 | 工程4（生成モーション） |
| `text_to_video` | 文生視頻 | （現状未使用） |
| `query_tasks` | generationId のポーリング | 生成の完了待ち |

## 採用モデル

| 用途 | モデル | 根拠 |
|---|---|---|
| 工程3: 静止画 | `gpt-image-2` | **codex exec と同じ GPT Image 2 が Kling MCP にもある。** codex が使えない環境でもモデルを変えずに済む。9:16 対応、2k、imageCount 1〜9 |
| 工程4: モーション | `kling-video-v3_0_turbo` | first_image 1枚入力の最速モデル。尺 3〜15 秒の整数、720p。音声なし |
| 音声つきが要る場合 | `kling-video-v2_6` | enable_audio は 1080p 必須 = Free プランでは 720p のみのため実質有償プラン限定 |

## 呼び出し形式（実スキーマ）

引数はすべて `{name, value}` の文字列ペア。inputs は `{name, inputType: 'URL', url}`。

```jsonc
// image_to_video の例（buildImageToVideoRequest が生成する形）
{
  "model": "kling-video-v3_0_turbo",
  "arguments": [
    { "name": "prompt", "value": "ゆっくりズームインしながら湯気が揺れる" },
    { "name": "duration", "value": "5" },        // 3〜15 の整数文字列
    { "name": "resolution", "value": "720p" },
    { "name": "imageCount", "value": "1" }
  ],
  "inputs": [
    { "name": "first_image", "inputType": "URL", "url": "<file_upload の結果>" }
  ]
}
```

## 実行フロー（Claude が agentTask を処理する手順）

1. `query_membership_and_credits` で残高を確認し、**ユーザーの承認を得る**（全ジョブ課金・取消不可）
2. ローカル画像がある場合は `file_upload` でチケットを取得し、
   `upload_url` に multipart/form-data（`ticket`, `file`）を POST → 返った URL を使う
3. 生成ツールを呼ぶ → `generationId` が返る
4. `query_tasks` で完了までポーリング
5. **works[].url は 24 時間で失効する。** 完了したら即 `assets/` にダウンロードする
6. `project.json` に登録し、`agentTask` を null に戻して `run` を再開する

## 設計判断

- **尺の丸め**: ショット尺を Kling の許容値（3〜15 秒の整数）へ**切り上げ**で丸める
  （`klingDurationForShot`）。長い分には Remotion が尻を切るだけだが、
  短いと尺が埋まらず黒フレームが出るため。
- **アスペクト比**: `klingAspectRatio` が spec の縦横比から gpt-image-2 の許容値
  （9:16 / 16:9 / 1:1 など 10 種）に最も近いものを選ぶ。
- **工程3の経路選択**: codex CLI と OpenAI 認証が両方あれば script 層（codex exec）、
  どちらかが欠ける環境では agent 層（Kling MCP の gpt-image-2）に自動で切り替わる。
  どちらの経路でも生成モデルは同じ GPT Image 2。

## 制約・注意

- **全ジョブ課金。** 試し打ち禁止。生成前に必ず残高確認とユーザー承認を挟む
  （プロジェクト CLAUDE.md の規約でもある）
- Free プランは 720p のみ。1080p・音声つき・高速化はメンバーシップで解放
- 入力画像は PNG/JPG、4K 未満、30MB 以下、縦横比 1:2 まで
- 生成 URL の失効は 24 時間。ダウンロードを後回しにしない
- モデル仕様はサーバー側で更新されるため、エラー時は who_am_i を再取得して照合する

## 検証済み（2026-07-26）

- who_am_i / query_membership_and_credits の実行（接続・OAuth 認証 OK）
- text_to_image（gpt-image-2）ペイロードの実スキーマ一致（9:16 解決含む）
- image_to_video（v3_0_turbo）ペイロードの実スキーマ一致（尺 150f→5s の丸め含む）
- 工程4のハイブリッド分岐（画像なし→HyperFrames ローカル実行、画像あり→Kling 依頼で停止）
- 生成の実行は未検証: 残高 0.0 クレジット（Free）のため課金ジョブを投入していない
