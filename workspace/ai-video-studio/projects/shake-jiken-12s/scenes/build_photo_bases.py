# 静止画（ポスター・久保さん写真）から各ビートのベース映像を生成する
# 使い方: photos/poster.png を置いてから
#   python3 scenes/build_photo_bases.py
# 出力: assets/photo/b{1,2,3,4,5}_base.mp4（1080x1920/30fps、ゆっくりズームのフォトステージング）
#
# 素材が静止画のため、動きは「ズーム/パン + 透過オーバーレイ(b*o.webm) + SE」で作る。
# 実写動画が届いたら、このベースを差し替えるだけで v2 になる。

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STUDIO = ROOT.parent.parent
FFMPEG = json.loads(
    subprocess.run(
        ["node", "-e", "console.log(JSON.stringify(require('ffmpeg-static')))"],
        capture_output=True, text=True, cwd=STUDIO,
    ).stdout.strip()
)
FFPROBE = json.loads(
    subprocess.run(
        ["node", "-e", "console.log(JSON.stringify(require('ffprobe-static').path))"],
        capture_output=True, text=True, cwd=STUDIO,
    ).stdout.strip()
)

POSTER = ROOT / "photos" / "poster.png"
if not POSTER.exists():
    sys.exit("photos/poster.png がありません。ポスター画像を置いてから実行してください。")

# 元画像の寸法
probe = subprocess.run(
    [FFPROBE, "-v", "error", "-select_streams", "v:0",
     "-show_entries", "stream=width,height", "-of", "csv=p=0", str(POSTER)],
    capture_output=True, text=True,
)
SW, SH = (int(x) for x in probe.stdout.strip().split(","))
print(f"poster: {SW}x{SH}")

W, H, FPS = 1080, 1920, 30

# 各ビートの切り出し（元画像に対する比率）とズーム設定
# poster 構図: 上部=暖簾+コピー / 右側=久保さん / 左下=シェイク2種
BEATS = {
    # (crop x, y, w, h [比率], 尺frames, zoom開始→終了, パン)
    "b1": dict(crop=(0.42, 0.02, 0.56, 0.96), frames=45,  z0=1.00, z1=1.06),  # 久保さん全体
    "b2": dict(crop=(0.00, 0.55, 0.34, 0.44), frames=75,  z0=1.02, z1=1.14),  # シェイク2種に寄る
    "b3": dict(crop=(0.05, 0.00, 0.52, 0.62), frames=90,  z0=1.00, z1=1.05),  # 暖簾（ずんちゃ丸が乗る背景）
    "b4": dict(crop=(0.45, 0.05, 0.50, 0.80), frames=75,  z0=1.06, z1=1.00),  # 久保さん（引き＝受け止め）
    "b5": dict(crop=(0.40, 0.00, 0.60, 1.00), frames=75,  z0=1.00, z1=1.08),  # 久保さん+シェイク
}

out_dir = ROOT / "assets" / "photo"
out_dir.mkdir(parents=True, exist_ok=True)

for beat, cfg in BEATS.items():
    rx, ry, rw, rh = cfg["crop"]
    cx, cy = int(SW * rx), int(SH * ry)
    cw, ch = int(SW * rw), int(SH * rh)
    # 縦 9:16 に収まるよう切り出し領域を調整（不足分は縮めて中央合わせ）
    target_ratio = W / H
    if cw / ch > target_ratio:
        new_cw = int(ch * target_ratio)
        cx += (cw - new_cw) // 2
        cw = new_cw
    else:
        new_ch = int(cw / target_ratio)
        cy = min(cy, SH - new_ch)
        ch = new_ch

    frames = cfg["frames"]
    z0, z1 = cfg["z0"], cfg["z1"]
    # zoompan は入力を大きめに拡大してから使うとジッタが出にくい
    zexpr = f"{z0}+({z1}-{z0})*on/{frames}"
    out = out_dir / f"{beat}_base.mp4"
    cmd = [
        FFMPEG, "-hide_banner", "-loglevel", "error", "-y",
        "-loop", "1", "-i", str(POSTER),
        "-vf",
        f"crop={cw}:{ch}:{cx}:{cy},scale=2160:3840,"
        f"zoompan=z='{zexpr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
        f":d={frames}:s={W}x{H}:fps={FPS},format=yuv420p",
        "-frames:v", str(frames), "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        str(out),
    ]
    subprocess.run(cmd, check=True)
    print(f"{beat}: {out.name}  crop=({cx},{cy},{cw},{ch}) {frames}f zoom {z0}->{z1}")

print("完了。次: node scenes/register_photo_v1.mjs でベース+オーバーレイを登録して合成へ")
