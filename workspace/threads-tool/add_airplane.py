"""
haneda1_d3_premium にさりげない飛行機（ライン画＋雲線）を追加
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).parent
SRC = ROOT / "generated_images" / "haneda1_d3_premium_20260506_111051.png"
OUT = ROOT / "generated_images" / "haneda1_d3_premium_airplane_20260506_111051.png"

img = Image.open(SRC).convert("RGB")
W, H = img.size

# RGBAレイヤーで合成
layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
draw = ImageDraw.Draw(layer)

# ============ 飛行機ライン画 ============
# "Haneda Sweet Pickup" の右側、ブランドラインと呼応する位置
# 控えめなゴールド系で
GOLD = (180, 145, 90, 220)
GOLD_LIGHT = (200, 170, 110, 140)

# 配置基準点（左上ブランドマーク横）
# "× HANEDA AIRPORT" の右側に飛行機シルエット
# ブランドラインが y=115 / "× HANEDA" が y=122
# その右に飛行機を上昇方向で配置

# 飛行機本体（シンプルな線画・斜め右上に向かう）
ax, ay = 285, 105   # 機首位置
# 胴体（細い楕円・斜め）
# 機体長 60px くらい
# 角度: -25度くらいの上昇感

import math
angle = math.radians(-22)  # 右上に上昇

def rot(px, py, cx, cy, ang):
    s, c = math.sin(ang), math.cos(ang)
    dx, dy = px - cx, py - cy
    return (cx + dx * c - dy * s, cy + dx * s + dy * c)

# 胴体（細長い四角→回転して描画）
body_pts = [
    (ax, ay),
    (ax - 56, ay - 6),
    (ax - 56, ay + 6),
]
# 三角機首
draw.polygon(body_pts, fill=GOLD)

# 主翼（菱形）
wing_pts_raw = [
    (ax - 28, ay - 2),
    (ax - 18, ay - 18),
    (ax - 8, ay - 2),
]
draw.polygon(wing_pts_raw, fill=GOLD)
wing_pts_raw2 = [
    (ax - 28, ay + 2),
    (ax - 18, ay + 18),
    (ax - 8, ay + 2),
]
draw.polygon(wing_pts_raw2, fill=GOLD)

# 尾翼
tail_pts = [
    (ax - 56, ay - 1),
    (ax - 64, ay - 12),
    (ax - 50, ay - 1),
]
draw.polygon(tail_pts, fill=GOLD)

# 飛行機雲（点線で右下から機体へ）
cloud_start = (ax - 130, ay + 30)
cloud_end = (ax - 56, ay + 4)
steps = 14
for i in range(steps):
    t = i / steps
    cx = cloud_start[0] + (cloud_end[0] - cloud_start[0]) * t
    cy = cloud_start[1] + (cloud_end[1] - cloud_start[1]) * t
    if i % 2 == 0:
        r = 2.2 - i * 0.1
        draw.ellipse([(cx - r, cy - r), (cx + r, cy + r)], fill=GOLD_LIGHT)

# 合成
img_rgba = img.convert("RGBA")
out = Image.alpha_composite(img_rgba, layer).convert("RGB")
out.save(OUT, "PNG", optimize=True)
print(f"OK: {OUT}")
