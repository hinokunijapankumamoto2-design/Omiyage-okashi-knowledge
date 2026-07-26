# 「暖簾の向こうの犯人」12秒のBGM・SE合成
# 実行: python3 scenes/gen_audio.py（プロジェクトルートから）
#
# SE タイムライン（絶対時刻）:
#   0.55 スルスルッ（ストローが伸びる）        b1
#   1.20 ズズズ…（吸う・1回目）               b1→b2
#   2.55 ズズズ…（吸う・2回目）               b2
#   3.85 ん？（小さな気づきアクセント）        b2
#   4.35 ぽよん（ずんちゃ丸が暖簾から出る）    b3
#   5.75 ぽんっ（吹き出し「飲んでないよ〜」）  b3
#   7.15 ずるっ（足を引っかける）             b4
#   7.60 どてっ（転倒）                       b4
#   8.10 カチッ（固まる）                     b4
#   9.65 ちりん（ミニシェイク登場）           b5
#  10.10 ぽよん（わーい）                     b5
#  11.15 ちりん＋ふわ〜（最終コピー）          b5

import struct
import wave
from pathlib import Path

import numpy as np

SR = 44100
DUR = 12.0
N = int(SR * DUR)
mix = np.zeros(N)
rng = np.random.default_rng(11)


def place(sig, at, gain=1.0):
    i0 = int(at * SR)
    i1 = min(N, i0 + len(sig))
    if i0 < N:
        mix[i0:i1] += sig[: i1 - i0] * gain


def pluck(freq, dur, amp=0.5, decay=6.0):
    t = np.arange(int(SR * dur)) / SR
    env = np.exp(-decay * t)
    sig = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2 * t)
    return amp * env * np.minimum(t / 0.004, 1.0) * sig


def boing(dur=0.32, f0=180, f1=520, amp=0.6):
    t = np.arange(int(SR * dur)) / SR
    freq = f0 + (f1 - f0) * (t / dur) ** 0.6
    vib = 1 + 0.06 * np.sin(2 * np.pi * 18 * t)
    phase = 2 * np.pi * np.cumsum(freq * vib) / SR
    return amp * np.exp(-5.5 * t) * np.minimum(t / 0.005, 1.0) * np.sin(phase)


def pop(amp=0.55):
    t = np.arange(int(SR * 0.09)) / SR
    return amp * np.exp(-45 * t) * np.sin(2 * np.pi * 760 * t)


def thunk(amp=0.55):
    t = np.arange(int(SR * 0.18)) / SR
    env = np.exp(-24 * t)
    noise = np.convolve(rng.standard_normal(len(t)) * 0.3, np.ones(28) / 28, mode="same")
    return amp * env * (np.sin(2 * np.pi * 110 * t) + noise)


def chime(freqs, dur=0.8, amp=0.32):
    t = np.arange(int(SR * dur)) / SR
    sig = sum(np.exp(-4.5 * t) * np.sin(2 * np.pi * f * t + k) for k, f in enumerate(freqs))
    return amp * sig / len(freqs) * np.minimum(t / 0.003, 1.0)


def sururu(dur=0.55, amp=0.4):
    """ストローが伸びる: 上昇トレモロノイズ"""
    t = np.arange(int(SR * dur)) / SR
    noise = np.convolve(rng.standard_normal(len(t)), np.ones(10) / 10, mode="same")
    trem = 0.5 * (1 + np.sin(2 * np.pi * (24 + 30 * t / dur) * t))
    env = np.sin(np.pi * t / dur) ** 0.7
    return amp * noise * trem * env


def slurp(dur=1.0, amp=0.34):
    """ズズズ…: 低域パルスノイズ＋低い正弦"""
    t = np.arange(int(SR * dur)) / SR
    noise = np.convolve(rng.standard_normal(len(t)) * 0.6, np.ones(40) / 40, mode="same")
    pulse = 0.5 * (1 + np.sign(np.sin(2 * np.pi * 13 * t)))
    env = np.sin(np.pi * np.minimum(t / dur, 1.0)) ** 0.5
    return amp * env * (noise * pulse + 0.35 * np.sin(2 * np.pi * 92 * t) * pulse)


def zuru(dur=0.4, amp=0.42):
    """ずるっ: 下降スイープ"""
    t = np.arange(int(SR * dur)) / SR
    freq = 500 - 320 * t / dur
    phase = 2 * np.pi * np.cumsum(freq) / SR
    return amp * np.exp(-3 * t) * np.sin(phase)


def kachi(amp=0.5):
    t = np.arange(int(SR * 0.05)) / SR
    return amp * np.exp(-90 * t) * np.sin(2 * np.pi * 2400 * t)


def fuwa(amp=0.3):
    dur = 1.3
    t = np.arange(int(SR * dur)) / SR
    env = np.sin(np.pi * np.minimum(t / dur, 1.0)) ** 2
    return amp * env * (np.sin(2 * np.pi * 880 * t) + 0.4 * np.sin(2 * np.pi * 1318.5 * t))


NOTE = {"C4": 261.63, "G4": 392.0, "A4": 440.0, "C5": 523.25, "D5": 587.33,
        "E5": 659.26, "G5": 783.99, "A5": 880.0, "C6": 1046.5}
melody = [(0, "E5"), (1, "G5"), (2, "A5"), (3, "G5"), (4, "E5"), (5, "D5"), (6, "C5"), (7, "D5"),
          (8, "E5"), (9, "G5"), (10, "A5"), (11, "C6"), (12, "G5"), (13, "E5"), (14, "D5"), (15, "C5")]
STEP = 0.5
# BGM は b3（犯人発覚 4.0s）から入れて、事件パート(冒頭)は環境音のみ＝異常が際立つ
for cycle in range(2):
    base = 4.0 + cycle * 8.0
    for beat, name in melody:
        at = base + beat * STEP
        if at < DUR - 0.25:
            place(pluck(NOTE[name], 0.45, amp=0.15), at)
for i, name in enumerate(["C4", "A4", "C4", "G4"]):
    at = 4.0 + i * 2.0
    if at < DUR:
        place(pluck(NOTE[name] / 2, 0.9, amp=0.09, decay=3.5), at)

place(sururu(), 0.55)
place(slurp(1.0), 1.20)
place(slurp(0.9, amp=0.3), 2.55)
place(chime((1046.5,), dur=0.35, amp=0.2), 3.85)
place(boing(), 4.35)
place(pop(), 5.75)
place(zuru(), 7.15)
place(thunk(), 7.60)
place(kachi(), 8.10)
place(chime((1568.0, 2093.0), dur=0.6, amp=0.24), 9.65)
place(boing(amp=0.42, f0=200, f1=560), 10.10)
place(chime((1568.0, 2093.0, 2637.0)), 11.15)
place(fuwa(), 11.30)

mix[: int(0.05 * SR)] *= np.linspace(0, 1, int(0.05 * SR))
mix[-int(0.6 * SR):] *= np.linspace(1, 0, int(0.6 * SR))
peak = np.max(np.abs(mix))
mix = mix / peak * 0.72

out_dir = Path(__file__).resolve().parent.parent / "assets" / "audio"
out_dir.mkdir(parents=True, exist_ok=True)
pcm = (mix * 32767).astype(np.int16)
stereo = np.column_stack([pcm, pcm]).ravel()
with wave.open(str(out_dir / "mix.wav"), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(struct.pack(f"<{len(stereo)}h", *stereo))
print(f"書き出し: {out_dir/'mix.wav'}（{DUR}s / peak {peak:.3f} → 0.72）")
