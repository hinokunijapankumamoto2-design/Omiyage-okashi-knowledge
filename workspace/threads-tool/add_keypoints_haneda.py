"""
d3画像にKEY POINTS 3つ + お菓子アイコンを追加するスクリプト（羽田編）
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

BASE = Path(r"C:\Users\hinok\OneDrive\デスクトップ\Claude　code\threads-tool\generated_images\haneda1_d3_modern_salon_20260506_111051.png")
OUT = BASE.with_name("haneda1_d3_factbased_20260506_111051.png")

FONT_JP = "C:/Windows/Fonts/NotoSerifJP-VF.ttf"
FONT_EMOJI = "C:/Windows/Fonts/seguiemj.ttf"

# 投稿の事実から抽出した KEY POINTS 3つ
bullets = [
    ("🥮", "羽雲（はねぐも）", "T1・T2 羽田限定 5個入1,296円"),
    ("🥧", "バクラヴァ BOX Haneda", "2/20 T1 2F NEW・4個入2,300円"),
    ("🍰", "HANEDA STAR & LUXE", "2/17 T1 2F・13ブランド集結"),
]

img = Image.open(BASE).convert("RGB")
W, H = img.size
draw = ImageDraw.Draw(img)

# パネルゾーン（左半分の下部）
panel_x = 50
panel_y_start = 720
panel_w = int(W * 0.50) - 80
line_height = 110

# 半透明の背景パネル
overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
odraw = ImageDraw.Draw(overlay)
odraw.rounded_rectangle(
    [(panel_x - 10, panel_y_start - 20),
     (panel_x + panel_w + 10, panel_y_start + line_height * 3 + 10)],
    radius=18,
    fill=(255, 255, 255, 215),
    outline=(180, 150, 90, 200),
    width=2,
)
img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
draw = ImageDraw.Draw(img)

f_emoji = ImageFont.truetype(FONT_EMOJI, 48)
f_main = ImageFont.truetype(FONT_JP, 32)
f_sub = ImageFont.truetype(FONT_JP, 22)

for i, (icon, title, detail) in enumerate(bullets):
    y = panel_y_start + i * line_height
    # アイコン（カラー絵文字）
    try:
        draw.text((panel_x, y), icon, font=f_emoji, embedded_color=True)
    except Exception:
        draw.text((panel_x, y), icon, font=f_emoji)
    # タイトル
    draw.text((panel_x + 70, y + 4), title, fill=(60, 40, 30), font=f_main)
    # 詳細
    draw.text((panel_x + 70, y + 50), detail, fill=(110, 90, 70), font=f_sub)

img.save(OUT, "PNG", optimize=True)
print(f"OK: {OUT}")
