# BGM と SE を合成し、10秒PRのタイムラインに正確に配置する。
# 実行: python3 scenes/gen_audio.py（プロジェクトルートから）
# 出力: assets/audio/mix.wav（44.1kHz ステレオ）
#
# タイムライン（final.mp4 の絶対時刻）:
#   0.30 ぽよん（ずんちゃ丸せり上がり）      s1
#   1.30 ぽんっ（吹き出し「こんにちは〜！」）  s1
#   3.35 とんっ（カップ着地）                s2
#   4.00 きらっ（コピー強調）                s2
#   6.20 ぽんっ（吹き出し「つい、ひとくち……」）s3
#   7.85 ちりん（タグライン登場）            s4
#   8.55 ぽよん（ずんちゃ丸着地・小さめ）     s4
#   9.20 ふわ〜（余韻）                     s4
# BGM: ずんだグリーンに合う、かわいいペンタトニックのマリンバ風ループ

import struct
import wave
from pathlib import Path

import numpy as np

SR = 44100
DUR = 10.0
N = int(SR * DUR)
t_all = np.arange(N) / SR
mix = np.zeros(N)


def place(sig: np.ndarray, at: float, gain: float = 1.0) -> None:
    i0 = int(at * SR)
    i1 = min(N, i0 + len(sig))
    if i0 < N:
        mix[i0:i1] += sig[: i1 - i0] * gain


def pluck(freq: float, dur: float, amp: float = 0.5, decay: float = 6.0) -> np.ndarray:
    """マリンバ風: 基音+2倍音、指数減衰、コツンとしたアタック"""
    t = np.arange(int(SR * dur)) / SR
    env = np.exp(-decay * t)
    sig = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2 * t)
    attack = np.minimum(t / 0.004, 1.0)
    return amp * env * attack * sig


def boing(dur: float = 0.32, f0: float = 180, f1: float = 520, amp: float = 0.6) -> np.ndarray:
    """ぽよん: 上昇スイープ+ビブラート"""
    t = np.arange(int(SR * dur)) / SR
    freq = f0 + (f1 - f0) * (t / dur) ** 0.6
    vib = 1 + 0.06 * np.sin(2 * np.pi * 18 * t)
    phase = 2 * np.pi * np.cumsum(freq * vib) / SR
    env = np.exp(-5.5 * t) * np.minimum(t / 0.005, 1.0)
    return amp * env * np.sin(phase)


def pop(amp: float = 0.55) -> np.ndarray:
    """ぽんっ: 短い正弦バースト+クリック"""
    t = np.arange(int(SR * 0.09)) / SR
    env = np.exp(-45 * t)
    return amp * env * np.sin(2 * np.pi * 760 * t)


def thunk(amp: float = 0.5) -> np.ndarray:
    """とんっ: 低域の短打+柔らかいノイズ"""
    t = np.arange(int(SR * 0.16)) / SR
    env = np.exp(-28 * t)
    tone = np.sin(2 * np.pi * 130 * t)
    rng = np.random.default_rng(7)
    noise = rng.standard_normal(len(t)) * 0.25
    # 簡易ローパス（移動平均）
    noise = np.convolve(noise, np.ones(24) / 24, mode="same")
    return amp * env * (tone + noise)


def chime(freqs: tuple[float, ...], dur: float = 0.9, amp: float = 0.34) -> np.ndarray:
    """ちりん/きらっ: 高音の重ね"""
    t = np.arange(int(SR * dur)) / SR
    sig = np.zeros_like(t)
    for k, f in enumerate(freqs):
        sig += np.exp(-4.5 * t) * np.sin(2 * np.pi * f * t + k)
    return amp * sig / len(freqs) * np.minimum(t / 0.003, 1.0)


def fuwa(amp: float = 0.3) -> np.ndarray:
    """ふわ〜: ゆっくり立ち上がってゆっくり消える"""
    dur = 1.2
    t = np.arange(int(SR * dur)) / SR
    env = np.sin(np.pi * np.minimum(t / dur, 1.0)) ** 2
    return amp * env * (np.sin(2 * np.pi * 880 * t) + 0.4 * np.sin(2 * np.pi * 1318.5 * t))


# ---------- BGM ----------
# C メジャーペンタトニック。テンポ 120（8分音符 = 0.25s）
NOTE = {"C4": 261.63, "D4": 293.66, "E4": 329.63, "G4": 392.0, "A4": 440.0,
        "C5": 523.25, "D5": 587.33, "E5": 659.26, "G5": 783.99, "A5": 880.0, "C6": 1046.5}
melody = [  # (拍位置, 音名) 2小節ループ×2.5
    (0, "E5"), (1, "G5"), (2, "A5"), (3, "G5"),
    (4, "E5"), (5, "D5"), (6, "C5"), (7, "D5"),
    (8, "E5"), (9, "G5"), (10, "A5"), (11, "C6"),
    (12, "G5"), (13, "E5"), (14, "D5"), (15, "C5"),
]
STEP = 0.5  # 4分音符
for cycle in range(2):
    base = cycle * 8.0
    for beat, name in melody:
        at = base + beat * STEP
        if at < DUR - 0.2:
            place(pluck(NOTE[name], 0.45, amp=0.16), at)
# ベース（各小節頭）
for i, name in enumerate(["C4", "A4", "C4", "G4", "C4"]):
    at = i * 2.0
    if at < DUR:
        place(pluck(NOTE[name] / 2, 0.9, amp=0.10, decay=3.5), at)

# ---------- SE ----------
place(boing(), 0.30)
place(pop(), 1.30)
place(thunk(), 3.35)
place(chime((1318.5, 1568.0), dur=0.6, amp=0.22), 4.00)
place(pop(amp=0.5), 6.20)
place(chime((1568.0, 2093.0, 2637.0)), 7.85)
place(boing(amp=0.4, f0=160, f1=420), 8.55)
place(fuwa(), 9.20)

# ---------- マスタリング ----------
# フェードイン/アウトと軽い圧縮気味のクリップ回避
mix[: int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))
mix[-int(0.6 * SR):] *= np.linspace(1, 0, int(0.6 * SR))
peak = np.max(np.abs(mix))
mix = mix / peak * 0.72

out_dir = Path(__file__).resolve().parent.parent / "assets" / "audio"
out_dir.mkdir(parents=True, exist_ok=True)
out = out_dir / "mix.wav"
pcm = (mix * 32767).astype(np.int16)
stereo = np.column_stack([pcm, pcm]).ravel()
with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(struct.pack(f"<{len(stereo)}h", *stereo))
print(f"書き出し: {out}（{DUR}s / peak {peak:.3f} → 0.72 正規化）")
