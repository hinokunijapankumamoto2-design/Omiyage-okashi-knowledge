# transcribe — AmiVoice 連携層

## 役割
録音済み or リアルタイム音声を AmiVoice WebSocket API に流し、`raw_transcript.md` の素材となる JSON を生成する。

## 構成
```
harness/transcribe/
├── README.md                # このファイル
├── config.example.json      # クライアント設定（コミット可）
├── requirements.txt         # Python 依存
└── replay_offline.py        # 既存 wav を WebSocket に流す検証スクリプト（Step 3）
```

将来追加予定:
- `ws_client.py` — マイク／システム音声からのリアルタイムストリーム
- `to_raw_transcript.py` — JSON → raw_transcript.md 変換
- `audio_input/mic_capture.py` — 対面会議用 PC マイク収音
- `audio_input/system_audio_capture.py` — オンライン会議用 OS音声キャプチャ

## セットアップ

### 1. APPKEY とエンジン名を取得
- [AmiVoice MyPage](https://acp.amivoice.com/) で APPKEY を発行
- 「Connection Engine Name」列で会議・商談に使うエンジン名を確認（例: 汎用_会話系）

### 2. .env を作成
リポジトリルートで:
```bash
cp .env.example .env
# .env を編集して APPKEY と ENGINE を入れる
```
`.env` は `.gitignore` 済み。

### 3. config.json を作成
```bash
cp harness/transcribe/config.example.json harness/transcribe/config.json
# diarization.min_speakers / max_speakers を会議実態に合わせる
```
`harness/transcribe/config.json` は `.gitignore` 対象（個別運用設定）。

### 4. Python 依存
```bash
pip install -r harness/transcribe/requirements.txt
```

## 録音音声の前処理（推奨）
AmiVoice は LSB16K (16kHz/16bit/mono/LE) を想定。録音物が異なる場合は ffmpeg で変換:
```bash
ffmpeg -i input.m4a -ac 1 -ar 16000 -sample_fmt s16 -f wav output.wav
```

## Step 3: 接続検証（replay_offline.py）

既存 wav を WebSocket に流して接続確認する。

```bash
python harness/transcribe/replay_offline.py \
  --wav data/clients/sample-omiyage/meetings/2026-05-25-002/audio/test.wav \
  --client_id sample-omiyage \
  --meeting_id 2026-05-25-002
```

成功時の出力:
```
data/clients/<client_id>/meetings/<meeting_id>/transcription/
├── amivoice_events.jsonl     # 全イベント時系列
├── amivoice_response.json    # 集約レスポンス
└── transcription_meta.json   # エンジン/話者数/duration/平均confidence
```

## 仕様参照
詳細は `../amivoice_spec.md` を参照。事実 / 仮説 / 未確認 を分けて記録している。
