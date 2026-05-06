"""
スイーツ王子 サムネ用テキスト差し替えツール

原本画像（スイーツ王子投稿画像.png）の左半分のテキスト領域を
任意のキャッチコピーへ差し替える。顔・衣装・スイーツは原本そのまま維持。

使い方:
    python text_overlay.py "定番に、" "新作を1つ。" \\
        --sub1 "甘美な時間を、" --sub2 "お取り寄せ。" \\
        --script "A Sweet Romance"
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
BASE_IMAGE = (ROOT.parent / "📚ナレッジ" / "コンテンツナレッジ"
              / "デザインナレッジ_スイーツ王子" / "character_reference"
              / "スイーツ王子コレクション" / "スイーツ王子投稿画像.png")
OUT_DIR = ROOT / "generated_images"

# テキスト色（原本に近い）
DARK_BROWN = (64, 41, 29)
SUB_BROWN = (120, 90, 75)
GOLD_SCRIPT = (180, 140, 70)

# Windowsフォントパス
FONT_MAIN = "C:/Windows/Fonts/NotoSerifJP-VF.ttf"   # 明朝・主見出し
FONT_SUB  = "C:/Windows/Fonts/NotoSerifJP-VF.ttf"   # 明朝・サブ
FONT_SCRIPT = "C:/Windows/Fonts/timesi.ttf"          # 英字italic


def overlay(main1, main2, sub1, sub2, script_text, base=None, out=None):
    base = Path(base) if base else BASE_IMAGE
    if not base.exists():
        print(f"❌ 原本画像が見つかりません: {base}")
        sys.exit(1)

    img = Image.open(base).convert("RGB")
    W, H = img.size

    # クリーム色をサンプル
    cream = img.getpixel((30, 30))

    draw = ImageDraw.Draw(img)

    # 既存のテキストを覆い隠す（クリーム色の長方形）
    # 主見出し領域
    draw.rectangle([(20, 30),  (W * 0.50, 280)], fill=cream)
    # サブ見出し領域
    draw.rectangle([(20, 280), (W * 0.42, 410)], fill=cream)
    # 英字スクリプト領域
    draw.rectangle([(20, 420), (W * 0.46, 510)], fill=cream)

    # フォント
    font_main = ImageFont.truetype(FONT_MAIN, 86)
    font_sub  = ImageFont.truetype(FONT_SUB, 38)
    font_script = ImageFont.truetype(FONT_SCRIPT, 32)

    # 描画位置（原本に合わせる）
    draw.text((40, 50),  main1, fill=DARK_BROWN, font=font_main)
    draw.text((40, 155), main2, fill=DARK_BROWN, font=font_main)
    draw.text((40, 290), sub1,  fill=SUB_BROWN, font=font_sub)
    draw.text((40, 345), sub2,  fill=SUB_BROWN, font=font_sub)

    if script_text:
        draw.text((40, 445), f"* {script_text} *", fill=GOLD_SCRIPT, font=font_script)

    # 保存
    OUT_DIR.mkdir(exist_ok=True)
    if out:
        out_path = Path(out)
    else:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_path = OUT_DIR / f"overlay_{ts}.png"
    img.save(out_path, "PNG", optimize=True)
    print(f"OK Saved: {out_path}")
    return out_path


def main():
    p = argparse.ArgumentParser()
    p.add_argument("main1", help="メイン1行目（例: 定番に、）")
    p.add_argument("main2", help="メイン2行目（例: 新作を1つ。）")
    p.add_argument("--sub1", default="甘美な時間を、")
    p.add_argument("--sub2", default="お取り寄せ。")
    p.add_argument("--script", default="A Sweet Romance")
    p.add_argument("--base", default=None, help="原本画像パス（省略時は規定）")
    p.add_argument("--out", default=None, help="出力パス（省略時は自動命名）")
    args = p.parse_args()
    overlay(args.main1, args.main2, args.sub1, args.sub2, args.script, args.base, args.out)


if __name__ == "__main__":
    main()
