"""make_test_wav.py

接続検証用の短い wav を生成する。AmiVoice 認識結果は不問。
目的: WebSocket セッション確立 / s,p,e コマンド受領 / イベント返却の経路確認。

使い方:
    python harness/transcribe/make_test_wav.py --out test.wav --seconds 5
"""

from __future__ import annotations

import argparse
import math
import struct
import sys
import wave
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--seconds", type=float, default=5.0)
    ap.add_argument("--rate", type=int, default=16000)
    ap.add_argument("--freq", type=float, default=440.0)
    ap.add_argument("--amplitude", type=float, default=0.3)
    args = ap.parse_args()

    nframes = int(args.rate * args.seconds)
    amp = int(32767 * max(0.0, min(1.0, args.amplitude)))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(args.out), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(args.rate)
        for i in range(nframes):
            sample = int(amp * math.sin(2 * math.pi * args.freq * i / args.rate))
            w.writeframesraw(struct.pack("<h", sample))

    print(f"[done] {args.out} {args.seconds}s {args.rate}Hz mono 16bit LE")
    return 0


if __name__ == "__main__":
    sys.exit(main())
