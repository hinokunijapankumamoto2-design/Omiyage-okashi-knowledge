"""
スイーツ王子 Threads投稿サムネ 3バリエーション同時生成ツール（装飾対応版）

原本画像（顔100%保持）の右側はそのまま、左半分を3つの異なるトーンで展開。
各バリエーションに花・ロゴ・For Youシール等の装飾を自動配置。

3バリエーション:
    v1 Soft Romance     クリーム背景・茶文字・カスミ草装飾
    v2 Bold Bordeaux    ボルドーパネル・ダリア装飾・ゴールドアクセント
    v3 Editorial Quiet  オフホワイト・ミニマル・小ブーケ装飾

使い方:
    python post_thumb_generator.py "メイン1行目" "メイン2行目" \\
        --sub1 "サブ1" --sub2 "サブ2" --script "英字"
"""

import argparse
import sys
from datetime import datetime
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

from PIL import Image, ImageDraw, ImageFont, ImageEnhance

ROOT = Path(__file__).parent
COLLECTION = (ROOT.parent / "📚ナレッジ" / "コンテンツナレッジ"
              / "デザインナレッジ_スイーツ王子" / "character_reference"
              / "スイーツ王子コレクション")
BASE_IMAGE = COLLECTION / "スイーツ王子投稿画像.png"
OUT_DIR = ROOT / "generated_images"

FONT_MAIN = "C:/Windows/Fonts/NotoSerifJP-VF.ttf"
FONT_SUB  = "C:/Windows/Fonts/NotoSerifJP-VF.ttf"
FONT_SCRIPT = "C:/Windows/Fonts/timesi.ttf"
FONT_LABEL = "C:/Windows/Fonts/yumindb.ttf"

STYLES = {
    "v1_soft_romance": {
        "bg_color": (241, 236, 230),
        "main_color": (64, 41, 29),
        "sub_color": (120, 90, 75),
        "script_color": (180, 140, 70),
        "main_size": 86,
        "sub_size": 38,
        "script_size": 32,
        "main_y": [50, 155],
        "sub_y": [290, 345],
        "script_y": 445,
        "left_panel_width": 0.50,
        "labels_visible": True,
        # 装飾配置：(asset_relpath, (x, y), (w, h), opacity)
        "decorations": [
            ("sheet3/sheet3_018.png", (380, 30),  (140, 180), 0.85),  # カスミ草・右上
            ("sheet3/sheet3_070.png", (40, 920),  (70, 70),   0.90),  # SPロゴ・左下
        ],
    },
    "v2_bold_bordeaux": {
        "bg_color": (88, 32, 38),
        "main_color": (245, 232, 215),
        "sub_color": (215, 195, 165),
        "script_color": (212, 175, 100),
        "main_size": 92,
        "sub_size": 36,
        "script_size": 30,
        "main_y": [70, 180],
        "sub_y": [320, 375],
        "script_y": 480,
        "left_panel_width": 0.48,
        "labels_visible": False,
        "decorations": [
            ("sheet3/sheet3_026.png", (350, 60),  (140, 38),  0.95),  # ダリア・右上
            ("sheet3/sheet3_071.png", (40, 880),  (90, 90),   0.95),  # For You
            ("sheet3/sheet3_070.png", (370, 920), (70, 70),   0.85),  # SPロゴ・右下
        ],
    },
    "v3_editorial_quiet": {
        "bg_color": (250, 248, 244),
        "main_color": (50, 48, 45),
        "sub_color": (130, 120, 105),
        "script_color": (160, 130, 75),
        "main_size": 78,
        "sub_size": 32,
        "script_size": 28,
        "main_y": [60, 155],
        "sub_y": [275, 320],
        "script_y": 410,
        "left_panel_width": 0.52,
        "labels_visible": True,
        "decorations": [
            ("sheet3/sheet3_021.png", (390, 20),  (130, 175), 0.85),  # 小ブーケ・右上
            ("sheet3/sheet3_070.png", (40, 920),  (60, 60),   0.85),
        ],
    },
}


def paste_decoration(img, asset_relpath, xy, size, opacity):
    asset = COLLECTION / asset_relpath
    if not asset.exists():
        return
    deco = Image.open(asset).convert("RGBA")
    deco = deco.resize(size, Image.LANCZOS)
    if opacity < 1.0:
        alpha = deco.split()[-1].point(lambda p: int(p * opacity))
        deco.putalpha(alpha)
    img.paste(deco, xy, deco)


def render_left_panel(img, style, main1, main2, sub1, sub2, script_text, draw_labels=None):
    W, H = img.size
    panel_w = int(W * style["left_panel_width"])

    # 左パネルを上書き
    if style["labels_visible"]:
        top_cover_h = 600
    else:
        top_cover_h = H

    # RGBA合成のためレイヤーを作成
    panel = Image.new("RGBA", img.size, (0, 0, 0, 0))
    pdraw = ImageDraw.Draw(panel)
    pdraw.rectangle([(0, 0), (panel_w, top_cover_h)], fill=(*style["bg_color"], 255))

    img.paste(panel.convert("RGB"), (0, 0), panel.split()[-1])

    # 装飾オーバーレイ（パネル内に収まる位置）
    rgba = img.convert("RGBA")
    for asset, xy, size, opacity in style.get("decorations", []):
        paste_decoration(rgba, asset, xy, size, opacity)
    img = rgba.convert("RGB")
    draw = ImageDraw.Draw(img)

    # フォント
    f_main = ImageFont.truetype(FONT_MAIN, style["main_size"])
    f_sub = ImageFont.truetype(FONT_SUB, style["sub_size"])
    f_script = ImageFont.truetype(FONT_SCRIPT, style["script_size"])

    # 描画
    draw.text((40, style["main_y"][0]), main1, fill=style["main_color"], font=f_main)
    if main2:
        draw.text((40, style["main_y"][1]), main2, fill=style["main_color"], font=f_main)
    if sub1:
        draw.text((40, style["sub_y"][0]), sub1, fill=style["sub_color"], font=f_sub)
    if sub2:
        draw.text((40, style["sub_y"][1]), sub2, fill=style["sub_color"], font=f_sub)
    if script_text:
        draw.text((40, style["script_y"]), f"* {script_text} *",
                  fill=style["script_color"], font=f_script)

    if not style["labels_visible"] and draw_labels:
        f_label_en = ImageFont.truetype(FONT_LABEL, 28)
        f_label_jp = ImageFont.truetype(FONT_LABEL, 20)
        y = 740
        for en, jp in draw_labels:
            draw.text((150, y), en, fill=style["main_color"], font=f_label_en)
            draw.text((150, y + 32), jp, fill=style["sub_color"], font=f_label_jp)
            y += 78

    return img


def generate_three(main1, main2, sub1, sub2, script_text, base=None, prefix="thumb"):
    base = Path(base) if base else BASE_IMAGE
    if not base.exists():
        print(f"❌ 原本画像が見つかりません: {base}")
        sys.exit(1)

    OUT_DIR.mkdir(exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    outputs = []

    bottom_labels = [
        ("GIFT", "大切な人へ"),
        ("QUALITY", "厳選素材"),
        ("STORY", "至福のひととき"),
    ]

    for style_name, style in STYLES.items():
        img = Image.open(base).convert("RGB")
        img = render_left_panel(img, style, main1, main2, sub1, sub2, script_text,
                                draw_labels=bottom_labels)
        out_path = OUT_DIR / f"{prefix}_{style_name}_{ts}.png"
        img.save(out_path, "PNG", optimize=True)
        outputs.append(out_path)
        print(f"OK {style_name}: {out_path}")

    return outputs


def main():
    p = argparse.ArgumentParser()
    p.add_argument("main1")
    p.add_argument("main2", nargs="?", default="")
    p.add_argument("--sub1", default="")
    p.add_argument("--sub2", default="")
    p.add_argument("--script", default="A Sweet Romance")
    p.add_argument("--base", default=None)
    p.add_argument("--prefix", default="thumb")
    args = p.parse_args()

    paths = generate_three(args.main1, args.main2, args.sub1, args.sub2,
                           args.script, args.base, args.prefix)
    print(f"\n3 variations generated:")
    for p_ in paths:
        print(f"  {p_}")


if __name__ == "__main__":
    main()
