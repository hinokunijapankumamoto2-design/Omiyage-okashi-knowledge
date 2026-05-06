"""
スイーツ王子 創作デザイン版 サムネ生成（プロ版・スイーツ強化）

設計原則:
  1. ゾーン厳密分離（テキスト/フォト/装飾の境界を侵さない）
  2. 王子はフォトフレームに収め、新背景と明確に分離
  3. テキスト幅は事前検証してオーバーフローを防止
  4. 手土産・お取り寄せスイーツの世界観を視覚で訴求
     （マカロン・ケーキ・タルト・プリン・ティーカップ・ギフトボックス・リボン）

3デザイン:
    d1 Floral Royal       4:5 左テキスト/右フォト/上下スイーツ列/SP王冠
    d2 Editorial Magazine 4:5 雑誌風/中央フォト/上スイーツ列/下大タイトル
    d3 Modern Salon       1:1 左テキスト/右フォト/スイーツ列/ワックスシール
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).parent
COLLECTION = (ROOT.parent / "📚ナレッジ" / "コンテンツナレッジ"
              / "デザインナレッジ_スイーツ王子" / "character_reference"
              / "スイーツ王子コレクション")
BASE_IMAGE = COLLECTION / "スイーツ王子投稿画像.png"
OUT_DIR = ROOT / "generated_images"

FONT_MAIN = "C:/Windows/Fonts/NotoSerifJP-VF.ttf"
FONT_SCRIPT = "C:/Windows/Fonts/timesi.ttf"
FONT_LABEL = "C:/Windows/Fonts/yumindb.ttf"
FONT_TIMES_BD = "C:/Windows/Fonts/timesbd.ttf"

# 手土産・お取り寄せスイーツアイコン
SWEETS_ROW = [
    ("sheet3/sheet3_060.png", "MACARON"),    # マカロン
    ("sheet3/sheet3_061.png", "CAKE"),        # ケーキ
    ("sheet3/sheet3_063.png", "TART"),        # タルト
    ("sheet3/sheet3_062.png", "PUDDING"),     # プリン
    ("sheet3/sheet3_064.png", "TEA"),         # ティー
]
SWEETS_COMPACT = [
    "sheet3/sheet3_060.png",  # マカロン
    "sheet3/sheet3_061.png",  # ケーキ
    "sheet3/sheet3_063.png",  # タルト
    "sheet3/sheet3_064.png",  # ティーカップ
]


def extract_character(base_path):
    img = Image.open(base_path).convert("RGB")
    return img.crop((430, 60, 1010, 700))


def text_fits(draw, text, font, max_w):
    bbox = draw.textbbox((0, 0), text, font=font)
    return (bbox[2] - bbox[0]) <= max_w


def auto_fit_font(draw, text, font_path, max_size, max_w, min_size=40):
    size = max_size
    while size >= min_size:
        f = ImageFont.truetype(font_path, size)
        if text_fits(draw, text, f, max_w):
            return f
        size -= 4
    return ImageFont.truetype(font_path, min_size)


def paste_decoration(canvas, asset, xy, size, opacity=1.0):
    p = COLLECTION / asset
    if not p.exists():
        return
    deco = Image.open(p).convert("RGBA")
    deco = deco.resize(size, Image.LANCZOS)
    if opacity < 1.0:
        a = deco.split()[-1].point(lambda v: int(v * opacity))
        deco.putalpha(a)
    canvas.paste(deco, xy, deco)


def fit_photo_in_frame(char_img, frame_w, frame_h):
    cw, ch = char_img.size
    s = max(frame_w / cw, frame_h / ch)
    new_w, new_h = int(cw * s), int(ch * s)
    img = char_img.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - frame_w) // 2
    top = (new_h - frame_h) // 2
    return img.crop((left, top, left + frame_w, top + frame_h))


def draw_photo_frame(canvas, photo, xy, frame_color=(180, 145, 80), border=3):
    x, y = xy
    w, h = photo.size
    canvas.paste(photo, (x, y))
    draw = ImageDraw.Draw(canvas)
    draw.rectangle([(x - border, y - border), (x + w + border, y + h + border)],
                   outline=frame_color, width=border)


def draw_sweets_row(canvas, x, y, total_w, icon_h=70, with_labels=False, color=(120, 90, 60)):
    """スイーツアイコンを横一列配置"""
    icons = SWEETS_ROW if with_labels else [(p, "") for p in SWEETS_COMPACT]
    n = len(icons)
    gap = total_w // n
    draw = ImageDraw.Draw(canvas)
    f_label = ImageFont.truetype(FONT_TIMES_BD, 14)
    for i, (asset, label) in enumerate(icons):
        cx = x + gap // 2 + i * gap
        # アイコン
        p = COLLECTION / asset
        if p.exists():
            ic = Image.open(p).convert("RGBA")
            iw, ih = ic.size
            scale = icon_h / ih
            ic = ic.resize((int(iw * scale), icon_h), Image.LANCZOS)
            canvas.paste(ic, (cx - ic.size[0] // 2, y), ic)
        if with_labels and label:
            bb = draw.textbbox((0, 0), label, font=f_label)
            tw = bb[2] - bb[0]
            draw.text((cx - tw // 2, y + icon_h + 6), label, fill=color, font=f_label)


# ==========================================================
# Design 1: Floral Royal — 左テキスト / 右フォト / スイーツ列下
# ==========================================================
def design_floral_royal(main1, main2, sub, script_text, char):
    W, H = 1080, 1350
    canvas = Image.new("RGB", (W, H), (245, 232, 226))

    TEXT_ZONE  = (60, 60, 540, 1290)
    PHOTO_ZONE = (560, 130, 1020, 1190)

    # 王子フォトフレーム
    pw = PHOTO_ZONE[2] - PHOTO_ZONE[0]
    ph = PHOTO_ZONE[3] - PHOTO_ZONE[1]
    photo = fit_photo_in_frame(char, pw, ph)
    draw_photo_frame(canvas, photo, (PHOTO_ZONE[0], PHOTO_ZONE[1]))

    draw = ImageDraw.Draw(canvas)

    # ヘッダー線＋スイーツアイコン3つ並び（左ヘッダー）
    f_label = ImageFont.truetype(FONT_TIMES_BD, 22)
    draw.text((TEXT_ZONE[0], 75),
              "PREMIUM  SWEETS  CURATION", fill=(160, 130, 80), font=f_label)
    draw.line([(TEXT_ZONE[0], 115), (TEXT_ZONE[2] - 60, 115)],
              fill=(180, 145, 80), width=2)

    # 王冠アイコン（テキストゾーン上部）
    paste_decoration(canvas, "sheet3/sheet3_057.png",
                     (TEXT_ZONE[0], 145), (60, 60), 0.9)

    # メインコピー
    text_max_w = TEXT_ZONE[2] - TEXT_ZONE[0]
    f_main = auto_fit_font(draw, main1, FONT_MAIN, 100, text_max_w)
    draw.text((TEXT_ZONE[0], 240), main1, fill=(64, 41, 29), font=f_main)
    if main2:
        f_main2 = ImageFont.truetype(FONT_MAIN, f_main.size)
        draw.text((TEXT_ZONE[0], 240 + f_main.size + 24),
                  main2, fill=(64, 41, 29), font=f_main2)

    # サブ
    if sub:
        f_sub = auto_fit_font(draw, sub, FONT_MAIN, 32, text_max_w, 22)
        draw.text((TEXT_ZONE[0], 540), sub, fill=(120, 90, 75), font=f_sub)

    # スクリプト
    if script_text:
        f_sc = ImageFont.truetype(FONT_SCRIPT, 30)
        draw.text((TEXT_ZONE[0], 605), f"— {script_text} —",
                  fill=(180, 140, 70), font=f_sc)

    # スイーツアイコン列（テキストゾーン中段）
    draw_sweets_row(canvas, TEXT_ZONE[0], 720,
                    TEXT_ZONE[2] - TEXT_ZONE[0] - 20, icon_h=70, with_labels=True)

    # ギフトボックス＋リボン（左下）
    paste_decoration(canvas, "sheet3/sheet3_056.png",
                     (TEXT_ZONE[0] + 20, 880), (75, 75), 0.95)
    paste_decoration(canvas, "sheet3/sheet3_068.png",
                     (TEXT_ZONE[0] + 130, 870), (95, 95), 0.9)
    # ローレル（テキストゾーン下右）
    paste_decoration(canvas, "sheet3/sheet3_073.png",
                     (TEXT_ZONE[0] + 280, 870), (130, 95), 0.85)

    # 下部ブランド署名 + ワックスシール
    f_brand = ImageFont.truetype(FONT_TIMES_BD, 24)
    f_tag = ImageFont.truetype(FONT_TIMES_BD, 16)
    paste_decoration(canvas, "sheet3/sheet3_072.png",
                     (TEXT_ZONE[0], 1090), (80, 80), 0.95)
    draw.text((TEXT_ZONE[0] + 95, 1110), "SWEETS PRINCE",
              fill=(64, 41, 29), font=f_brand)
    draw.text((TEXT_ZONE[0] + 95, 1142),
              "GIFT  &  PREMIUM  ORDER",
              fill=(160, 130, 80), font=f_tag)

    # 区切り線（下部）
    draw.line([(TEXT_ZONE[0], 1230), (TEXT_ZONE[2] - 60, 1230)],
              fill=(180, 145, 80), width=2)
    f_keyw = ImageFont.truetype(FONT_TIMES_BD, 16)
    draw.text((TEXT_ZONE[0], 1245),
              "MACARON / CAKE / TART / TEA",
              fill=(160, 130, 80), font=f_keyw)

    return canvas


# ==========================================================
# Design 2: Editorial Magazine — 中央フォト / 上下スイーツ装飾
# ==========================================================
def design_editorial_magazine(main1, main2, sub, script_text, char):
    W, H = 1080, 1350
    canvas = Image.new("RGB", (W, H), (250, 246, 240))
    draw = ImageDraw.Draw(canvas)

    # ヘッダー帯
    draw.rectangle([(0, 0), (W, 80)], fill=(38, 32, 28))
    f_h = ImageFont.truetype(FONT_TIMES_BD, 22)
    draw.text((60, 28), "ISSUE  No.01  /  PREMIUM  SWEETS",
              fill=(220, 200, 165), font=f_h)
    sw = draw.textbbox((0, 0), "SWEETS  PRINCE", font=f_h)[2]
    draw.text((W - sw - 60, 28), "SWEETS  PRINCE",
              fill=(220, 200, 165), font=f_h)

    # スイーツアイコン列（ヘッダー直下）
    draw_sweets_row(canvas, 100, 110, W - 200, icon_h=60, with_labels=True,
                    color=(120, 90, 60))

    # フォトゾーン
    PHOTO_ZONE = (220, 240, 860, 880)
    pw = PHOTO_ZONE[2] - PHOTO_ZONE[0]
    ph = PHOTO_ZONE[3] - PHOTO_ZONE[1]
    photo = fit_photo_in_frame(char, pw, ph)
    draw_photo_frame(canvas, photo, (PHOTO_ZONE[0], PHOTO_ZONE[1]),
                     frame_color=(180, 145, 80), border=2)

    # フォト左右の装飾（リボン・蝶）
    paste_decoration(canvas, "sheet3/sheet3_068.png", (110, 380), (90, 90), 0.85)
    paste_decoration(canvas, "sheet3/sheet3_069.png", (W - 200, 380), (90, 90), 0.8)

    draw = ImageDraw.Draw(canvas)
    # 区切り線（ダブル）
    draw.line([(60, 920), (W - 60, 920)], fill=(38, 32, 28), width=2)
    draw.line([(60, 928), (W - 60, 928)], fill=(180, 145, 80), width=1)

    # メインタイトル
    text_max_w = W - 120
    f_main = auto_fit_font(draw, main1, FONT_MAIN, 100, text_max_w)
    bbox = draw.textbbox((0, 0), main1, font=f_main)
    draw.text(((W - (bbox[2] - bbox[0])) // 2, 970),
              main1, fill=(38, 32, 28), font=f_main)
    if main2:
        bbox2 = draw.textbbox((0, 0), main2, font=f_main)
        draw.text(((W - (bbox2[2] - bbox2[0])) // 2, 970 + f_main.size + 20),
                  main2, fill=(38, 32, 28), font=f_main)

    # スクリプト
    if script_text:
        f_sc = ImageFont.truetype(FONT_SCRIPT, 36)
        text = f"* {script_text} *"
        bs = draw.textbbox((0, 0), text, font=f_sc)
        draw.text(((W - (bs[2] - bs[0])) // 2, H - 165),
                  text, fill=(180, 140, 70), font=f_sc)

    # サブ
    if sub:
        f_sub = auto_fit_font(draw, sub, FONT_MAIN, 32, text_max_w, 22)
        bs2 = draw.textbbox((0, 0), sub, font=f_sub)
        draw.text(((W - (bs2[2] - bs2[0])) // 2, H - 110),
                  sub, fill=(120, 100, 85), font=f_sub)

    # 下部キーワード（手土産文脈）
    f_keyw = ImageFont.truetype(FONT_TIMES_BD, 16)
    keyw = "GIFT  ·  CURATED  ·  TEMIYAGE  ·  OTORIYOSE"
    bs3 = draw.textbbox((0, 0), keyw, font=f_keyw)
    draw.text(((W - (bs3[2] - bs3[0])) // 2, H - 50),
              keyw, fill=(160, 130, 80), font=f_keyw)

    return canvas


# ==========================================================
# Design 3: Modern Salon — 1:1 左テキスト / 右フォト / スイーツ列
# ==========================================================
def design_modern_salon(main1, main2, sub, script_text, char):
    W, H = 1080, 1080
    canvas = Image.new("RGB", (W, H), (245, 240, 232))

    TEXT_ZONE = (60, 60, 540, 1020)
    PHOTO_ZONE = (570, 80, 1020, 1000)

    pw = PHOTO_ZONE[2] - PHOTO_ZONE[0]
    ph = PHOTO_ZONE[3] - PHOTO_ZONE[1]
    photo = fit_photo_in_frame(char, pw, ph)
    draw_photo_frame(canvas, photo, (PHOTO_ZONE[0], PHOTO_ZONE[1]),
                     frame_color=(180, 145, 80), border=2)

    draw = ImageDraw.Draw(canvas)

    # ヘッダー
    f_label = ImageFont.truetype(FONT_TIMES_BD, 20)
    draw.text((TEXT_ZONE[0], 70),
              "SWEETS PRINCE / GIFT & ORDER", fill=(160, 130, 80), font=f_label)
    draw.line([(TEXT_ZONE[0], 110), (TEXT_ZONE[2] - 60, 110)],
              fill=(180, 145, 80), width=1)

    # 王冠
    paste_decoration(canvas, "sheet3/sheet3_057.png",
                     (TEXT_ZONE[0], 140), (55, 55), 0.9)

    # メイン
    text_max_w = TEXT_ZONE[2] - TEXT_ZONE[0]
    f_main = auto_fit_font(draw, main1, FONT_MAIN, 90, text_max_w)
    draw.text((TEXT_ZONE[0], 220), main1, fill=(50, 45, 40), font=f_main)
    if main2:
        f_main2 = ImageFont.truetype(FONT_MAIN, f_main.size)
        draw.text((TEXT_ZONE[0], 220 + f_main.size + 24),
                  main2, fill=(50, 45, 40), font=f_main2)

    # スクリプト
    if script_text:
        f_sc = ImageFont.truetype(FONT_SCRIPT, 30)
        draw.text((TEXT_ZONE[0], 460), f"— {script_text}",
                  fill=(180, 145, 80), font=f_sc)

    # サブ
    if sub:
        f_sub = auto_fit_font(draw, sub, FONT_MAIN, 30, text_max_w, 22)
        draw.text((TEXT_ZONE[0], 525), sub, fill=(120, 100, 85), font=f_sub)

    # スイーツアイコン列（テキストゾーン下部）
    draw_sweets_row(canvas, TEXT_ZONE[0], 620,
                    TEXT_ZONE[2] - TEXT_ZONE[0] - 20, icon_h=70, with_labels=True)

    # ギフトボックス + ワックスシール（下段アクセサリー）
    paste_decoration(canvas, "sheet3/sheet3_056.png",
                     (TEXT_ZONE[0] + 30, 800), (70, 70), 0.95)
    paste_decoration(canvas, "sheet3/sheet3_072.png",
                     (TEXT_ZONE[0] + 140, 800), (70, 70), 0.95)
    paste_decoration(canvas, "sheet3/sheet3_068.png",
                     (TEXT_ZONE[0] + 250, 800), (75, 75), 0.95)

    # ブランド署名
    f_brand = ImageFont.truetype(FONT_TIMES_BD, 18)
    f_tag = ImageFont.truetype(FONT_TIMES_BD, 14)
    draw.line([(TEXT_ZONE[0], 940), (TEXT_ZONE[2] - 60, 940)],
              fill=(180, 145, 80), width=1)
    draw.text((TEXT_ZONE[0], 955), "SWEETS PRINCE",
              fill=(50, 45, 40), font=f_brand)
    draw.text((TEXT_ZONE[0], 982),
              "TEMIYAGE  /  OTORIYOSE  /  PREMIUM  COLLECTION",
              fill=(160, 130, 80), font=f_tag)

    return canvas


def generate_three(main1, main2, sub, script_text, prefix="creative"):
    if not BASE_IMAGE.exists():
        print(f"❌ 原本画像が見つかりません: {BASE_IMAGE}")
        sys.exit(1)
    char = extract_character(BASE_IMAGE)
    OUT_DIR.mkdir(exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    designs = [
        ("d1_floral_royal", design_floral_royal),
        ("d2_editorial_magazine", design_editorial_magazine),
        ("d3_modern_salon", design_modern_salon),
    ]
    paths = []
    for name, fn in designs:
        img = fn(main1, main2, sub, script_text, char)
        out = OUT_DIR / f"{prefix}_{name}_{ts}.png"
        img.save(out, "PNG", optimize=True)
        paths.append(out)
        print(f"OK {name}: {out}")
    return paths


def main():
    p = argparse.ArgumentParser()
    p.add_argument("main1")
    p.add_argument("main2", nargs="?", default="")
    p.add_argument("--sub", default="")
    p.add_argument("--script", default="A Sweet Romance")
    p.add_argument("--prefix", default="creative")
    args = p.parse_args()
    paths = generate_three(args.main1, args.main2, args.sub, args.script, args.prefix)
    print("\n3 designs:")
    for p_ in paths:
        print(f"  {p_}")


if __name__ == "__main__":
    main()
