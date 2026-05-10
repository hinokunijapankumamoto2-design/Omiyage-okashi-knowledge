# 接続検証 RUNBOOK — replay_offline.py

AmiVoice WebSocket リアルタイム API への接続が成立し、`amivoice_events.jsonl` / `amivoice_response.json` / `transcription_meta.json` が生成されるところまで確認する。

> **このランブックは AmiVoice APPKEY を持つお手元環境で実行する。** 結果（`transcription_meta.json` の中身）を貼ってもらえれば、未確認だった仕様（segmenterProperties の正確な構文、speakerId の格納位置、推奨 chunk_ms など）を `harness/amivoice_spec.md` に書き戻します。

---

## 0. 前提
- Python 3.10+
- pip
- AmiVoice MyPage で発行した APPKEY
- MyPage で確認した「Connection Engine Name」

## 1. 依存インストール

リポジトリルートで:

```bash
pip install -r harness/transcribe/requirements.txt
```

## 1.5. 鍵の誤コミット防止フックを有効化（**最初に1回だけ実行**）

```bash
bash scripts/install-hooks.sh
```

これで以下が自動でブロックされる:
- `.env` のコミット
- ステージ済みファイル中の `AMIVOICE_APPKEY=<実値>` の追加
- `appkey` / `api_key` / `token` / `secret` を含む行に40文字以上の長い英数字が現れた場合

## 2. .env 作成

```bash
cp .env.example .env
```

**`.env` の編集はターミナルではなくエディタ（VS Code等）で開いて貼る**こと。シェル履歴に鍵が残るのを避ける。

```
AMIVOICE_APPKEY=<MyPage の APPKEY 実値>
AMIVOICE_ENGINE=<MyPage の接続エンジン名>
AMIVOICE_WS_ENDPOINT=wss://acp-api.amivoice.com/v1/nolog/
```

注意:
- APPKEY をチャットに貼らない
- `<...>` プレースホルダのままだとスクリプトが起動時にエラー停止する（保険）
- スクリプトは APPKEY を `***APPKEY_MASKED***` に置換してログ・events.jsonl に書き出す

エンジン名は会議・商談用途なら「会話系・汎用」を推奨（正式名は MyPage の Connection Engine Name 列で確認）。

## 3. config.json 作成

```bash
cp harness/transcribe/config.example.json harness/transcribe/config.json
```

そのままでも動く。会議の想定話者数に合わせて `diarization.min_speakers` / `max_speakers` を調整。

## 4. テスト用 wav を生成

5秒の440Hzサイン波（音声認識自体は意味のある結果を返さないが、セッション確立の確認にはこれで十分）:

```bash
python harness/transcribe/make_test_wav.py \
  --out harness/transcribe/samples/test_5s_440hz.wav --seconds 5
```

（既に存在する場合はスキップ可）

## 5. 接続検証実行

```bash
python harness/transcribe/replay_offline.py \
  --wav harness/transcribe/samples/test_5s_440hz.wav \
  --client_id sample-omiyage \
  --meeting_id wstest-2026-05-10
```

期待出力（標準出力）:
```
[connect] wss://acp-api.amivoice.com/v1/nolog/
[s_cmd] s LSB16K <engine> authorization=*** segmenterProperties="useDiarizer=1 ..."
[sent] s
[S] ...
[sent] e
[A] (合成音なので空またはノイズ)
[E] ...
[done] events=N utterances=M speakers=[...]
[written] data/clients/sample-omiyage/meetings/wstest-2026-05-10/transcription/amivoice_events.jsonl
[written] data/clients/sample-omiyage/meetings/wstest-2026-05-10/transcription/amivoice_response.json
[written] data/clients/sample-omiyage/meetings/wstest-2026-05-10/transcription/transcription_meta.json
```

## 6. 確認ポイント

### 成功の判定
- `transcription_meta.json` の `wallclock_sec` が記録されている
- `amivoice_events.jsonl` に `s` の応答（コード等）と `S`/`E` イベントが入っている
- 接続例外が出ていない

### 失敗パターンと対処

| 症状 | 原因の可能性 | 対処 |
|---|---|---|
| 401/403 相当のレスポンス | APPKEY 誤り / 期限切れ | MyPage で再発行 |
| `s` への応答が「engine 不正」 | 接続エンジン名の文字列ミス | MyPage のエンジン名を厳密にコピー |
| 何も返ってこない | `audio_format` 不一致 | wav が LSB16K か再確認、ffmpeg で再変換 |
| `segmenterProperties` でエラー | キー名が WebSocket では別名 | `useDiarizer=1` だけにしてみる、ドキュメント再確認 |
| ConnectionClosed 即時 | エンドポイント URL ミス / TLS 問題 | URL確認、社内プロキシ確認 |

## 7. 結果共有

成功したら以下をチャットに貼ってください（spec を更新します）:

1. `transcription_meta.json` の中身全文
2. `amivoice_events.jsonl` の最初10行と最後10行
3. 標準出力の全体（APPKEY は伏せて）

これで以下の未確認項目を埋められます:
- segmenterProperties の正確な引数仕様
- speakerId の格納位置（token vs result）
- A イベントの実 JSON スキーマ
- 推奨チャンクサイズの妥当性

## 8. 実音声での検証（任意）

サイン波で接続が通ったら、実会議の短いクリップ（30秒〜1分程度の wav）で再実行:

```bash
ffmpeg -i your_meeting.m4a -ac 1 -ar 16000 -sample_fmt s16 -f wav your_meeting_16k.wav
python harness/transcribe/replay_offline.py \
  --wav your_meeting_16k.wav \
  --client_id <client_id> \
  --meeting_id <meeting_id>
```

これで実用エンジンの認識精度・話者分離品質が確認できる。
