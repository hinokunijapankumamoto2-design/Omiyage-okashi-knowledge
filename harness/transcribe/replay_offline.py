"""replay_offline.py

既存 wav を AmiVoice WebSocket に流し、events.jsonl / response.json / meta.json を生成する検証ツール。

前提:
- wav は 16kHz / 16bit / mono / LE（LSB16K）。違えば ffmpeg で変換する。
- リポジトリルートの .env に AMIVOICE_APPKEY, AMIVOICE_ENGINE, AMIVOICE_WS_ENDPOINT を設定済み。
- harness/transcribe/config.json（無ければ config.example.json）が存在。

使い方:
    python harness/transcribe/replay_offline.py \
        --wav <path> --client_id <id> --meeting_id <id>

出力:
    data/clients/<client_id>/meetings/<meeting_id>/transcription/
        amivoice_events.jsonl
        amivoice_response.json
        transcription_meta.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
import wave
from dataclasses import dataclass, field
from pathlib import Path

try:
    import websockets
except ImportError:
    sys.stderr.write("websockets がインストールされていません: pip install -r harness/transcribe/requirements.txt\n")
    sys.exit(1)


REPO_ROOT = Path(__file__).resolve().parents[2]


def load_dotenv(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def load_config() -> dict:
    cfg_path = REPO_ROOT / "harness/transcribe/config.json"
    if not cfg_path.exists():
        cfg_path = REPO_ROOT / "harness/transcribe/config.example.json"
    return json.loads(cfg_path.read_text(encoding="utf-8"))


def validate_wav(wav_path: Path, expected_rate: int, expected_bits: int, expected_channels: int) -> tuple[int, int]:
    with wave.open(str(wav_path), "rb") as w:
        rate = w.getframerate()
        bits = w.getsampwidth() * 8
        channels = w.getnchannels()
        nframes = w.getnframes()
    if (rate, bits, channels) != (expected_rate, expected_bits, expected_channels):
        raise SystemExit(
            f"wav フォーマット不一致: 期待 {expected_rate}Hz/{expected_bits}bit/{expected_channels}ch, 実際 {rate}Hz/{bits}bit/{channels}ch\n"
            f"ffmpeg で変換: ffmpeg -i {wav_path} -ac 1 -ar 16000 -sample_fmt s16 -f wav out.wav"
        )
    return nframes, rate


def build_s_command(audio_format: str, engine: str, appkey: str, diarization: dict) -> str:
    parts = [f"s {audio_format} {engine}", f"authorization={appkey}"]
    if diarization.get("enabled"):
        seg_props = ["useDiarizer=1"]
        if (mn := diarization.get("min_speakers")) is not None:
            seg_props.append(f"diarizationMinSpeaker={mn}")
        if (mx := diarization.get("max_speakers")) is not None:
            seg_props.append(f"diarizationMaxSpeaker={mx}")
        parts.append(f"segmenterProperties=\"{' '.join(seg_props)}\"")
    return " ".join(parts)


def validate_appkey(appkey: str) -> None:
    if not appkey:
        raise SystemExit(".env の AMIVOICE_APPKEY が空です")
    if any(ch.isspace() for ch in appkey):
        raise SystemExit("AMIVOICE_APPKEY に空白が含まれています（コピペ事故の可能性）")
    if len(appkey) < 16:
        raise SystemExit(f"AMIVOICE_APPKEY が短すぎます（{len(appkey)}文字）。MyPage で再確認してください")
    if appkey.startswith("<") or appkey.endswith(">"):
        raise SystemExit("AMIVOICE_APPKEY が <...> プレースホルダのままです")


@dataclass
class SessionState:
    events: list[dict] = field(default_factory=list)
    final_results: list[dict] = field(default_factory=list)
    started_at: float = 0.0
    ended_at: float = 0.0


async def run(wav_path: Path, client_id: str, meeting_id: str) -> int:
    env = {**os.environ, **load_dotenv(REPO_ROOT / ".env")}
    appkey = env.get("AMIVOICE_APPKEY")
    engine = env.get("AMIVOICE_ENGINE")
    endpoint = env.get("AMIVOICE_WS_ENDPOINT", "wss://acp-api.amivoice.com/v1/nolog/")

    if not appkey or not engine:
        sys.stderr.write(".env の AMIVOICE_APPKEY と AMIVOICE_ENGINE を設定してください\n")
        return 2
    validate_appkey(appkey)

    cfg = load_config()
    audio_cfg = cfg["audio"]
    chunk_bytes = (audio_cfg["sample_rate"] * audio_cfg["bit_depth"] // 8 * audio_cfg["channels"]) * audio_cfg["chunk_ms"] // 1000
    nframes, rate = validate_wav(wav_path, audio_cfg["sample_rate"], audio_cfg["bit_depth"], audio_cfg["channels"])
    duration_sec = nframes / rate

    out_dir = REPO_ROOT / f"data/clients/{client_id}/meetings/{meeting_id}/transcription"
    out_dir.mkdir(parents=True, exist_ok=True)
    events_path = out_dir / "amivoice_events.jsonl"
    response_path = out_dir / "amivoice_response.json"
    meta_path = out_dir / "transcription_meta.json"

    state = SessionState(started_at=time.time())

    s_cmd = build_s_command(cfg["audio_format"], engine, appkey, cfg["diarization"])
    print(f"[connect] {endpoint}")
    print(f"[s_cmd] {s_cmd.replace(appkey, '***')}")

    with events_path.open("w", encoding="utf-8") as events_fp:
        async with websockets.connect(endpoint, max_size=None) as ws:
            await ws.send(s_cmd)
            print("[sent] s")

            async def reader() -> None:
                try:
                    async for msg in ws:
                        if isinstance(msg, bytes):
                            try:
                                msg = msg.decode("utf-8", errors="replace")
                            except Exception:
                                continue
                        record = parse_event(msg, appkey)
                        events_fp.write(json.dumps(record, ensure_ascii=False) + "\n")
                        events_fp.flush()
                        state.events.append(record)
                        if record.get("kind") == "A" and record.get("payload"):
                            state.final_results.append(record["payload"])
                            print(f"[A] {record['payload'].get('text', '')}")
                        elif record.get("kind") in {"S", "E"}:
                            print(f"[{record['kind']}] {record.get('raw', '')[:80]}")
                except websockets.ConnectionClosed:
                    return

            reader_task = asyncio.create_task(reader())

            # ストリーム送信
            with wave.open(str(wav_path), "rb") as w:
                while True:
                    pcm = w.readframes(chunk_bytes // (audio_cfg["bit_depth"] // 8 * audio_cfg["channels"]))
                    if not pcm:
                        break
                    await ws.send(b"p" + pcm)
                    await asyncio.sleep(audio_cfg["chunk_ms"] / 1000.0)
            await ws.send("e")
            print("[sent] e")

            # 終了応答待ち
            try:
                await asyncio.wait_for(reader_task, timeout=30.0)
            except asyncio.TimeoutError:
                print("[warn] 応答タイムアウト（最終 A 待ち）")

    state.ended_at = time.time()

    # 集約
    response_path.write_text(
        json.dumps({"results": state.final_results}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    confidences = []
    speaker_ids = set()
    for r in state.final_results:
        if (c := r.get("confidence")) is not None:
            confidences.append(c)
        for tok in r.get("tokens", []):
            if (sid := tok.get("speakerId")) is not None:
                speaker_ids.add(sid)
            if (sid := tok.get("speaker_id")) is not None:
                speaker_ids.add(sid)

    meta = {
        "engine": engine,
        "endpoint": endpoint,
        "audio_format": cfg["audio_format"],
        "duration_sec": duration_sec,
        "wallclock_sec": round(state.ended_at - state.started_at, 2),
        "utterances": len(state.final_results),
        "speakers_detected": sorted(speaker_ids),
        "avg_confidence": round(sum(confidences) / len(confidences), 4) if confidences else None,
        "diarization": cfg["diarization"],
        "client_id": client_id,
        "meeting_id": meeting_id,
    }
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"[done] events={len(state.events)} utterances={len(state.final_results)} speakers={sorted(speaker_ids)}")
    print(f"[written] {events_path.relative_to(REPO_ROOT)}")
    print(f"[written] {response_path.relative_to(REPO_ROOT)}")
    print(f"[written] {meta_path.relative_to(REPO_ROOT)}")
    return 0


def parse_event(msg: str, appkey: str | None = None) -> dict:
    """AmiVoice の各イベントは先頭1文字（S/E/U/A/C/p/s/e 等）+ スペース + JSON or テキスト。

    APPKEY が万一サーバ応答にエコーされた場合に備えて、保存時にマスクする保険。
    """
    msg = msg.strip()
    if not msg:
        return {"kind": None, "raw": ""}
    if appkey and appkey in msg:
        msg = msg.replace(appkey, "***APPKEY_MASKED***")
    kind = msg[0]
    body = msg[1:].lstrip() if len(msg) > 1 else ""
    payload = None
    if body.startswith("{"):
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            payload = None
    return {"kind": kind, "raw": msg[:200], "payload": payload}


def main() -> int:
    ap = argparse.ArgumentParser(description="AmiVoice WebSocket 接続検証（既存wav流し込み）")
    ap.add_argument("--wav", required=True, type=Path)
    ap.add_argument("--client_id", required=True)
    ap.add_argument("--meeting_id", required=True)
    args = ap.parse_args()

    if not args.wav.exists():
        sys.stderr.write(f"wav が見つかりません: {args.wav}\n")
        return 2

    return asyncio.run(run(args.wav, args.client_id, args.meeting_id))


if __name__ == "__main__":
    sys.exit(main())
