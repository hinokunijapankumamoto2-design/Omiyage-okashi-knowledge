# 静止画から各ビートのベース映像を生成する（実素材版）
# 素材: photos/poster.jpg（680x481 ポスター）/ photos/sheet.png（1024x1536 リファレンスシート）
# 実行: python3 scenes/build_photo_bases.py
# 出力: assets/photo/b{1..5}_base.mp4（1080x1920/30fps・ゆっくりズーム）

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STUDIO = ROOT.parent.parent


def node_path(expr: str) -> str:
    return json.loads(
        subprocess.run(["node", "-e", f"console.log(JSON.stringify({expr}))"],
                       capture_output=True, text=True, cwd=STUDIO).stdout.strip()
    )


FFMPEG = node_path("require('ffmpeg-static')")
FFPROBE = node_path("require('ffprobe-static').path")

SOURCES = {
    "poster": ROOT / "photos" / "poster.jpg",
    "sheet": ROOT / "photos" / "sheet.png",
}
for name, p in SOURCES.items():
    if not p.exists():
        sys.exit(f"素材がありません: {p}")

DIMS = {}
for name, p in SOURCES.items():
    out = subprocess.run(
        [FFPROBE, "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height", "-of", "csv=p=0", str(p)],
        capture_output=True, text=True,
    ).stdout.strip().split(",")
    DIMS[name] = (int(out[0]), int(out[1]))
    print(f"{name}: {DIMS[name][0]}x{DIMS[name][1]}")

W, H, FPS = 1080, 1920, 30

# ビート定義。crop は元画像に対する比率 (x, y, w, h)
# poster 構図: 暖簾=上部左〜中央 / 久保さん=右側 / シェイク2種=左下 / タグライン=下段
BEATS = {
    "b1": dict(src="poster", crop=(0.55, 0.00, 0.45, 1.00), frames=45, z0=1.02, z1=1.16, pan=("right", 0.35)),  # 久保さん（シェイク持ち）
    "b2": dict(src="poster", crop=(0.00, 0.58, 0.30, 0.42), frames=75, z0=1.06, z1=1.24, pan=("up", 0.3)),  # シェイク2種に寄る
    "b3": dict(src="poster", crop=(0.30, 0.02, 0.44, 0.64), frames=90, z0=1.00, z1=1.05),  # 暖簾
    "b4": dict(src="sheet",  crop=(0.015, 0.068, 0.27, 0.36), frames=75, z0=1.16, z1=1.02, pan=("down", 0.25)),  # 優しい微笑みの肖像（引き）
    "b5": dict(src="poster", crop=(0.50, 0.00, 0.50, 1.00), frames=75, z0=1.04, z1=1.15, pan=("left", 0.3)),  # 久保さん+シェイク（締め）
}

out_dir = ROOT / "assets" / "photo"
out_dir.mkdir(parents=True, exist_ok=True)

for beat, cfg in BEATS.items():
    SW, SH = DIMS[cfg["src"]]
    src = SOURCES[cfg["src"]]
    rx, ry, rw, rh = cfg["crop"]
    cx, cy = int(SW * rx), int(SH * ry)
    cw, ch = int(SW * rw), int(SH * rh)
    # 9:16 に収まるよう調整
    target = W / H
    if cw / ch > target:
        ncw = int(ch * target)
        cx += (cw - ncw) // 2
        cw = ncw
    else:
        nch = int(cw / target)
        cy = min(cy, SH - nch)
        ch = nch
    cw -= cw % 2
    ch -= ch % 2

    frames, z0, z1 = cfg["frames"], cfg["z0"], cfg["z1"]
    zexpr = f"{z0}+({z1}-{z0})*on/{frames}"
    # パン: 進行度に応じて注視点をずらす（幅は余剰領域に対する比率）
    pan_dir, pan_amt = cfg.get("pan", (None, 0))
    xexpr, yexpr = "iw/2-(iw/zoom/2)", "ih/2-(ih/zoom/2)"
    prog = f"(on/{frames})"
    if pan_dir == "right":
        xexpr = f"iw/2-(iw/zoom/2)+(iw-iw/zoom)*{pan_amt}*{prog}/2"
    elif pan_dir == "left":
        xexpr = f"iw/2-(iw/zoom/2)-(iw-iw/zoom)*{pan_amt}*{prog}/2"
    elif pan_dir == "down":
        yexpr = f"ih/2-(ih/zoom/2)+(ih-ih/zoom)*{pan_amt}*{prog}/2"
    elif pan_dir == "up":
        yexpr = f"ih/2-(ih/zoom/2)-(ih-ih/zoom)*{pan_amt}*{prog}/2"
    out = out_dir / f"{beat}_base.mp4"
    subprocess.run([
        FFMPEG, "-hide_banner", "-loglevel", "error", "-y",
        "-loop", "1", "-i", str(src),
        "-vf",
        f"crop={cw}:{ch}:{cx}:{cy},scale=2160:3840:flags=lanczos,"
        f"zoompan=z='{zexpr}':x='{xexpr}':y='{yexpr}'"
        f":d={frames}:s={W}x{H}:fps={FPS},format=yuv420p",
        "-frames:v", str(frames), "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        str(out),
    ], check=True)
    print(f"{beat}: crop=({cx},{cy},{cw},{ch}) src={cfg['src']} {frames}f zoom {z0}->{z1}")

print("完了")
