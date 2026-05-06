"""
羽田空港編 プレミアムデザイン（model_12ベース）
- 上品な白シャツモデル + マーブルカウンター + 白薔薇 の高級感
- 左パネル: タイトル＋スクリプト
- 下部: 3カード KEY POINTS（横並び・アイコン付き）
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = Path(__file__).parent
COL = (ROOT.parent / "📚ナレッジ" / "コンテンツナレッジ"
       / "デザインナレッジ_スイーツ王子" / "character_reference"
       / "スイーツ王子コレクション")
MODEL = COL / "model_12.jpg"
OUT = ROOT / "generated_images" / "haneda1_d3_premium_20260506_111051.png"

FONT_JP_BOLD = "C:/Windows/Fonts/NotoSerifJP-VF.ttf"
FONT_JP_REG = "C:/Windows/Fonts/yumindb.ttf"
FONT_SCRIPT = "C:/Windows/Fonts/timesi.ttf"
FONT_EMOJI = "C:/Windows/Fonts/seguiemj.ttf"

W, H = 1080, 1080

# ============ Canvas: cream gradient ============
canvas = Image.new("RGB", (W, H), (250, 244, 234))
draw = ImageDraw.Draw(canvas)
for y in range(H):
    t = y / H
    r = int(250 - 12 * t)
    g = int(244 - 14 * t)
    b = int(234 - 18 * t)
    draw.line([(0, y), (W, y)], fill=(r, g, b))

# ============ Right side: model_12 (cropped) ============
model = Image.open(MODEL).convert("RGB")
mw, mh = model.size
# 右側 540×720 ぐらいに収める。元画像は約3:4
target_h = 720
target_w = int(mw * target_h / mh)
model_resized = model.resize((target_w, target_h), Image.LANCZOS)
# 右寄せで配置（少し見切らせる）
mx = W - target_w + 30
my = 60
canvas.paste(model_resized, (mx, my))

# モデル左側にソフトなフェードを入れて溶け込ませる
fade = Image.new("RGBA", (160, target_h), (250, 244, 234, 0))
fdraw = ImageDraw.Draw(fade)
for x in range(160):
    alpha = int(255 * (1 - x / 160))
    fdraw.line([(x, 0), (x, target_h)], fill=(250, 244, 234, alpha))
canvas.paste(fade, (mx, my), fade)

# ============ Left text panel ============
# 上部ブランドマーク
f_brand = ImageFont.truetype(FONT_JP_REG, 22)
draw = ImageDraw.Draw(canvas)
draw.text((60, 80), "SWEETS  PRINCE", fill=(150, 110, 60), font=f_brand)
draw.line([(60, 115), (380, 115)], fill=(180, 145, 90), width=1)
draw.text((60, 122), "× HANEDA  AIRPORT", fill=(120, 90, 60), font=f_brand)

# ============ 飛行機 + 雲（HANEDA AIRPORT の右隣に配置） ============
import math
GOLD = (180, 145, 90)
GOLD_LIGHT = (200, 170, 110)
# HANEDA AIRPORT文字幅およそ280px、その右に余白20pxで配置
ax, ay = 410, 132   # 機首（HANEDA AIRPORT 文字直後・適度な余白）
# 胴体
draw.polygon([(ax, ay), (ax - 50, ay - 5), (ax - 50, ay + 5)], fill=GOLD)
# 主翼（上下）
draw.polygon([(ax - 26, ay - 1), (ax - 16, ay - 16), (ax - 6, ay - 1)], fill=GOLD)
draw.polygon([(ax - 26, ay + 1), (ax - 16, ay + 16), (ax - 6, ay + 1)], fill=GOLD)
# 尾翼
draw.polygon([(ax - 50, ay), (ax - 58, ay - 11), (ax - 44, ay)], fill=GOLD)
# 飛行機雲（右へ伸びる点線）
for i in range(10):
    cx = ax + 8 + i * 12
    cy = ay - i * 1
    if i % 2 == 0:
        r = max(0.5, 2.0 - i * 0.15)
        draw.ellipse([(cx - r, cy - r), (cx + r, cy + r)], fill=GOLD_LIGHT)

# タイトル（縦組み風大型）
f_title1 = ImageFont.truetype(FONT_JP_BOLD, 76)
f_title2 = ImageFont.truetype(FONT_JP_BOLD, 76)
draw.text((60, 200), "羽田の帰路、", fill=(50, 38, 30), font=f_title1)
draw.text((60, 295), "5分で外さない。", fill=(50, 38, 30), font=f_title2)

# 細い金線
draw.line([(60, 405), (180, 405)], fill=(180, 145, 90), width=2)

# スクリプト
f_script = ImageFont.truetype(FONT_SCRIPT, 36)
draw.text((60, 420), "Haneda Sweet Pickup", fill=(170, 130, 70), font=f_script)

# サブ
f_sub = ImageFont.truetype(FONT_JP_REG, 24)
draw.text((60, 475), "GW 最終日 ／ 空港手土産 3 選", fill=(110, 90, 70), font=f_sub)

# （白薔薇装飾は削除）

# ============ Bottom: KEY POINTS 3 cards ============
bullets = [
    ("🥮", "羽雲（はねぐも）", "T1・T2 羽田限定", "5個入 ¥1,296"),
    ("🥧", "バクラヴァ BOX Haneda", "2/20 T1 2F NEW", "4個入 ¥2,300"),
    ("🍰", "HANEDA STAR & LUXE", "2/17 T1 2F NEW", "13ブランド集結"),
]

card_top = 800
card_h = 230
card_gap = 14
card_margin = 30
card_w = (W - card_margin * 2 - card_gap * 2) // 3

f_card_title = ImageFont.truetype(FONT_JP_BOLD, 22)
f_card_sub = ImageFont.truetype(FONT_JP_REG, 18)
f_card_price = ImageFont.truetype(FONT_JP_BOLD, 20)
f_card_emoji = ImageFont.truetype(FONT_EMOJI, 56)
f_card_no = ImageFont.truetype(FONT_SCRIPT, 28)

# 半透明白カード × 3
overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
odraw = ImageDraw.Draw(overlay)

for i, (icon, title, place, price) in enumerate(bullets):
    cx = card_margin + i * (card_w + card_gap)
    cy = card_top
    # カード背景
    odraw.rounded_rectangle(
        [(cx, cy), (cx + card_w, cy + card_h)],
        radius=14,
        fill=(255, 252, 246, 235),
        outline=(190, 160, 100, 200),
        width=2,
    )

canvas = Image.alpha_composite(canvas.convert("RGBA"), overlay).convert("RGB")
draw = ImageDraw.Draw(canvas)

for i, (icon, title, place, price) in enumerate(bullets):
    cx = card_margin + i * (card_w + card_gap)
    cy = card_top
    # No.（スクリプトで番号）
    draw.text((cx + 16, cy + 8), f"No.{i+1}", fill=(180, 140, 80), font=f_card_no)
    # アイコン
    try:
        draw.text((cx + card_w - 80, cy + 8), icon, font=f_card_emoji, embedded_color=True)
    except Exception:
        draw.text((cx + card_w - 80, cy + 8), icon, font=f_card_emoji)
    # 区切り線
    draw.line([(cx + 16, cy + 90), (cx + card_w - 16, cy + 90)],
              fill=(200, 175, 120), width=1)
    # タイトル
    draw.text((cx + 16, cy + 100), title, fill=(50, 38, 28), font=f_card_title)
    # 場所
    draw.text((cx + 16, cy + 138), place, fill=(120, 95, 70), font=f_card_sub)
    # 価格
    draw.text((cx + 16, cy + 180), price, fill=(150, 90, 50), font=f_card_price)

# ============ 下部キャッチ ============
f_foot = ImageFont.truetype(FONT_JP_REG, 22)
foot_text = '迷ったら "羽田限定 × 新ブランド" で外さない。'
fbbox = draw.textbbox((0, 0), foot_text, font=f_foot)
fw = fbbox[2] - fbbox[0]
draw.text(((W - fw) // 2, 1045), foot_text, fill=(110, 85, 60), font=f_foot)

canvas.save(OUT, "PNG", optimize=True)
print(f"OK: {OUT}")
