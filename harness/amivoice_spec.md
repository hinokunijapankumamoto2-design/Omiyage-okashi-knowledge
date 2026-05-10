# AmiVoice API 仕様メモ

> 目的: 会議録音を AmiVoice WebSocket リアルタイム API で文字起こしし、`raw_transcript.md` を生成するための前提を確定する。
> 原則: 事実 / 仮説 / 未確認 を分ける（CLAUDE.md / evidence_policy 準拠）。

## 出典
- AmiVoice API マニュアル: https://docs.amivoice.com/amivoice-api/
- WebSocket 概要: https://docs.amivoice.com/amivoice-api/manual/reference/websocket/
- 話者ダイアライゼーション: https://docs.amivoice.com/amivoice-api/manual/user-guide/function/speaker-diarization/
- 音声フォーマット: https://docs.amivoice.com/en/amivoice-api/manual/audio-format/
- リクエストパラメータ: https://docs.amivoice.com/en/amivoice-api/manual/request-parameters/
- 価格: https://acp.amivoice.com/en/amivoice_api/price/
- 価格モデル: https://docs.amivoice.com/en/amivoice-api/manual/price-model/
- 価格改定告知（2025-10-01）: https://acp.amivoice.com/news/news/2025/10/01/7676/
- Tech Blog ダイアライゼーション: https://acp.amivoice.com/blog/2022-02-01/

## 1. WebSocket エンドポイント

### 事実
- ログあり: `wss://acp-api.amivoice.com/v1/`
- ログなし: `wss://acp-api.amivoice.com/v1/nolog/`
- 双方向通信（コマンド／応答／イベント）を継続的にやり取りする

### 仮説
- `nolog` 利用時は AmiVoice 側に音声・テキストのログが残らない（料金は高め）
- 機密性の高い会議は `nolog` 推奨

### 未確認
- ログ保持期間（`v1/` の場合何日残るか）
- ログ削除依頼の手段

## 2. 認証

### 事実
- APPKEY（MyPage で発行）または ワンタイム APPKEY を使用
- WebSocket では `s` コマンドの `authorization=<APPKEY>` パラメータで渡す

### 未確認
- APPKEY のローテーション推奨頻度
- レート制限・並列接続の上限

## 3. プロトコル（コマンド／イベント）

### 事実
- クライアント送信コマンド: `s`（開始）, `p`（音声フレーム）, `e`（終了）
- サーバ応答: `s`/`p`/`e` への応答パケット
- サーバイベント: `S`（utteranceStarted）, `E`（utteranceEnded）, `C`（チャンク確定中）, `U`（interim 中間結果）, `A`（accepted 確定結果）
- 一部ドキュメント表記では `R`（rejected）が登場

### 仮説
- 1セッション = 1 WebSocket接続 = 1エンジン
- `A` イベント単位で1発話の確定文が出る

### 未確認
- 中間結果の発生頻度
- 通信断時のリカバリ手順（再接続→セッション再開可否）

## 4. 入力音声フォーマット

### 事実
- ヘッダレス PCM の場合、`s` コマンドで `audio_format` 文字列で指定
- 16kHz 16bit mono リトルエンディアン → `LSB16K`
- ビッグエンディアン → `MSB16K`
- 8kHz 系も指定可能（電話音声など）

### 仮説
- LSB16K（16kHz / 16bit / mono / LE）が会議録音の標準（OBS / ffmpeg / sox の既定で得やすい）
- フレーム送信は `p` コマンド（バイナリフレーム、先頭1バイトが `p` 0x70）

### 未確認
- 1フレームあたりの推奨バイト数（200ms程度を仮置き）
- 圧縮コーデック（Opus 等）の対応可否

## 5. リクエストパラメータ（`s` コマンド）

### 事実（読み取れた）
- `audio_format`: 例 `LSB16K`
- `grammar_file_names` / `engine`: 接続エンジン名（MyPageに掲載）
- `authorization=<APPKEY>`: 認証
- `segmenterProperties`: セグメンター設定（ダイアライゼーション含む）

### 事実（ダイアライゼーション）
- `segmenterProperties` に `useDiarizer=1` を含めると話者分離が有効化
- 非同期APIでは `speakerDiarization=True`、`diarizationMinSpeaker=N`、`diarizationMaxSpeaker=N` で人数指定可能（同種パラメータは WebSocket でも `segmenterProperties` 経由で指定する想定）
- 出力に `speakerId` (`speaker0`, `speaker1`, …) が含まれる
- 2023年2月から WebSocket / 同期HTTP でリアルタイム話者分離が利用可能

### 未確認
- WebSocket での話者最小／最大人数指定の正確なキー名
- 話者ID再振り直しのトリガー条件（無音長など）
- 話者分離の追加課金有無

## 6. 利用可能エンジン

### 事実
- 「会話」最適化エンジンと「音声入力」最適化エンジンに分かれる
- 領域別: 汎用 / 金融 / 保険 / 医療 / 製薬 / 電子カルテ
- 日本語・英語・中国語・韓国語に対応
- バッチ処理向けに最適化された Batch エンジンも別系統で存在

### 未確認（**MyPageで確認して埋める**）
- 商談・会議向けに最も推奨される接続エンジン名（`grammarFileNames` 文字列）の正確な表記
- 「汎用_会話」系の最新バージョン番号

→ 暫定: 汎用会話エンジン（汎用_会話）を使用。実際のエンジン文字列は MyPage の「Connection Engine Name」列を確認して `.env` へ設定する。

## 7. レスポンス（イベント JSON）

### 事実
- `U` イベント = interim（中間結果） JSON: `results[].tokens[]`, `results[].text`
- `A` イベント = accepted（確定結果） JSON: `results[].tokens[]` に `written`/`spoken`/`confidence`/`starttime`/`endtime`、`results[]` に `confidence`/`starttime`/`endtime`/`text`/`tags`/`rulename`
- 時刻フィールドはミリ秒、音声開始を0とする
- ダイアライゼーション有効時は token または segment レベルに `speakerId` が付与

### 未確認
- `speakerId` がトークン単位か発話単位か（仕様書要確認）
- `tags` の用途と既定値

## 8. 課金（2025-10-01改定後）

### 事実
- 1秒単位の従量課金（切り上げなし）
- 全13種エンジンで月60分まで無料
- 汎用エンジン（日本語・英語・中国語）
  - ログあり: **99円/時間**（0.0275円/秒）
  - ログなし: **158.4円/時間**（0.0440円/秒）
- 金融・保険エンジン
  - ログあり: 148.5円/時間（0.04125円/秒）
  - ログなし: 237.6円/時間（0.0660円/秒）
- 医療・製薬・電子カルテエンジン
  - ログあり: 297円/時間（0.0825円/秒）
  - ログなし: 475.2円/時間（0.1320円/秒）
- 「音声資産活用キャンペーン」で1,000時間無料（2025-10〜、終了時期未確認）

### 未確認
- リアルタイム vs バッチで単価差があるか
- 話者分離オプションの追加料金

## 9. データ保持・ログ

### 事実
- `v1/` でログあり、`v1/nolog/` でログなし

### 未確認
- ログあり時の保持期間
- 利用者がログ削除を依頼する手段
- GDPR / 国内個人情報保護法対応の説明

## 10. 非同期 HTTP（バックアップ・話者分離フル機能用）

### 事実
- WebSocket でリアルタイム取り、終了後に同じ音声を非同期 HTTP に投入することで話者分離パラメータ（min/max speaker 等）の精度を上げられる
- ジョブ投入 → ポーリング → 結果取得の形

### 未確認
- 非同期 HTTP の正確なエンドポイントとリクエスト仕様（実装時に追記）
- 最大音声長

## 11. クライアント SDK / ライブラリ

### 事実
- AmiVoice 公式の Wrp クライアントライブラリあり（複数言語）
- JavaScript / Node 例多数（Twilio 連携記事など）

### 未確認
- Python 公式 SDK の有無（手書き WebSocket クライアントで代替する想定）

---

# 本プロジェクトでの初期方針（仕様未確認部分の対処）

| 項目 | 採用値 | 根拠／代替 |
|---|---|---|
| エンドポイント | `wss://acp-api.amivoice.com/v1/nolog/` | 機密会議想定でログなし。`.env` で切替可能 |
| 認証 | `.env` の `AMIVOICE_APPKEY` を `s` コマンド `authorization` に渡す | 標準 |
| エンジン | `<MyPage で確認>` を `.env` の `AMIVOICE_ENGINE` に設定 | 暫定値はマニュアル確認後に確定 |
| 音声フォーマット | `LSB16K` (16kHz / 16bit / mono / LE) | OBS/ffmpeg/sox で容易に得られる |
| ダイアライゼーション | `segmenterProperties` に `useDiarizer=1` 付与 | WebSocket リアルタイム対応の確認済み |
| 話者人数 | `min=2`, `max=6` を初期値 | 商談・会議で現実的なレンジ |
| チャンク | 200ms ずつ送信 | 実用的な低遅延・低オーバヘッド |
| ログ保存 | 全イベントを `amivoice_events.jsonl` に逐次書き出し | 通信断耐性 |
| 出力 | `amivoice_response.json` + `transcription_meta.json` を git 管理 | 完全再現性 |

# 仕様確認後にこのファイルを更新する箇所
- [ ] エンジン文字列の正式名（MyPage 確認後）
- [ ] WebSocket での話者人数指定キー名
- [ ] 非同期 HTTP エンドポイント仕様
- [ ] 通信断リカバリ手順
- [ ] フレーム推奨サイズ
