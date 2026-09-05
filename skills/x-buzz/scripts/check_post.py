#!/usr/bin/env python3
"""𝕏ポストの機械的チェック（文字数・禁忌語・視認性・出口の数）。

なぜスクリプトか：文字数カウントと語句検出は目視だと必ずズレる。
特に𝕏の文字数は「重み付き280ユニット」で、日本語1文字＝2、URL＝一律23と
特殊なため、体感の「140字」とは一致しない。ここだけは機械に任せる。

使い方:
    python3 check_post.py post.txt
    cat post.txt | python3 check_post.py -
    python3 check_post.py post.txt --json     # 機械可読な出力
    python3 check_post.py thread.txt --thread # "---" 区切りで連投を個別採点

判定は「不合格」ではなく「要確認」を返す項目がある（数字の実在性など、
機械には真偽が分からないもの）。最終判断は references/07-audit-checklist.md に従う。
"""
import argparse
import json
import re
import sys
import unicodedata

# --- 𝕏 の重み付き文字数（公式 configuration v3 準拠） -----------------
# 下記レンジは重み1、それ以外（CJK・絵文字など）は重み2。上限280ユニット。
LIGHT_RANGES = ((0x0000, 0x10FF), (0x2000, 0x200D), (0x2010, 0x201F), (0x2032, 0x2037))
MAX_WEIGHTED = 280
URL_WEIGHT = 23  # t.co により、URLは長さに関わらず23ユニット
URL_RE = re.compile(r"https?://\S+")


def weighted_length(text: str) -> int:
    """𝕏 の重み付き文字数を返す。日本語のみなら 140文字 = 280ユニット。"""
    text = URL_RE.sub("\x00" * URL_WEIGHT, text)  # URLを23ユニット分の軽量文字に置換
    # ZWJ結合の絵文字（👨‍👩‍👧 等）は1絵文字＝2ユニットとして数える
    text = re.sub(r"‍[︀-️]?.", "", text)
    total = 0
    for ch in text:
        if ch in "︎️":  # 異体字セレクタは数えない
            continue
        cp = ord(ch)
        total += 1 if any(lo <= cp <= hi for lo, hi in LIGHT_RANGES) else 2
    return total


def visible_chars(text: str) -> int:
    """人間が数える「文字数」。URLは23ユニット=実質11.5字相当なので概算。"""
    return len(URL_RE.sub("x" * 12, text))


# --- 検出パターン -----------------------------------------------------
# AI臭の定型比喩。読者に「機械が書いた」と悟られた瞬間に信頼が落ちるため排除する。
BANNED = ["魔法の杖", "架け橋", "羅針盤", "第一歩", "第二の脳", "深掘りしていきましょう",
          "いかがでしたか", "いかがでしょうか", "ぜひ参考にしてみてください"]
# 意味量を薄める贅肉。断定に置き換えると同じ文字数で情報量が増える。
FILLER = ["だと思います", "かと思います", "と思われます", "たいと思います", "非常に", "とても",
          "様々な", "多いのではないでしょうか"]
# 抽象語。身体現象に置換すると没入度が上がる。
ABSTRACT = ["驚きました", "焦りました", "大変でした", "すごいです", "嬉しかったです", "頑張ります"]
# 出口（CTA）。2種類以上あると読者の行動が分散する。
CTA_PATTERNS = {
    "リプライ": r"リプ(?!ライ欄が)|返信して|コメントして",
    "フォロー": r"フォロー(?!バック)",
    "引用RP": r"引用(RP|リポスト|RT)",
    "リンククリック": r"(リンク|プロフ).{0,6}(クリック|タップ|から|に置)",
    "いいね": r"いいね.{0,8}(して|お願い|押して|よろしく)",
}
# 断定的利益保証。景表法・特商法リスクに直結するため、検出したら必ず知らせる。
GUARANTEE = [r"必ず(稼|儲|痩|治|増)", r"絶対に(稼|儲|痩|治|増)", r"誰でも\s*月収", r"確実に稼"]
NUM_RE = re.compile(r"[0-9０-９]+\s*(億|万|人|名|円|%|％|倍|時間|日|枚|個|本)")
PLACEHOLDER = "【要実績】"


def check(post: str, index=None, allow_long=False, needs_cta=True):
    lines = post.split("\n")
    body_lines = [l for l in lines if l.strip()]
    first = body_lines[0] if body_lines else ""
    weighted = weighted_length(post)
    issues, notes = [], []

    # 1-1 フックの長さ：1行目が長いとタイムラインで折り返され、衝撃が消える
    hook_len = visible_chars(first)
    if hook_len > 40:
        issues.append(f"[1-1] 1行目が{hook_len}字。40字以内に削る（脳を止める前に折り返される）")
    # 1-2 記号フック（減点ではなく助言）
    if not re.search(r"[【\[◤]", first):
        notes.append("[1-2] 1行目に【】等の記号フックなし。重要通知として認識させたいなら追加を検討")

    # 全体の長さ
    if weighted > MAX_WEIGHTED:
        over = (weighted - MAX_WEIGHTED + 1) // 2
        if allow_long:
            notes.append(f"[長さ] {weighted}ユニット（長文ポスト前提でOK。無課金アカウントなら約{over}字超過）")
        else:
            issues.append(f"[長さ] 重み付き{weighted}/280ユニット超過。約{over}字削る"
                          f"（Premiumの長文ポストなら --long を付けて再チェック）")

    # 2-1 MPT：贅肉
    for w in FILLER:
        if w in post:
            issues.append(f"[2-1] 贅肉「{w}」を検出。断定に置換して意味量を上げる")
    # 2-2 身体感覚
    for w in ABSTRACT:
        if w in post:
            issues.append(f"[2-2] 抽象語「{w}」を検出。身体現象（脇汗・指の震え等）に置換する")

    # 5-1 視認性：4行以上連続すると塊が読めなくなる
    run = maxrun = 0
    for l in lines:
        run = run + 1 if l.strip() else 0
        maxrun = max(maxrun, run)
    if maxrun >= 4:
        issues.append(f"[5-1] 空行なしで{maxrun}行連続。3行ごとに空行を入れて塊を作る")
    long_lines = [i + 1 for i, l in enumerate(lines) if visible_chars(l) > 28]
    if long_lines:
        notes.append(f"[5-1] 長い行: {long_lines}行目（スマホで折り返される。20字前後で改行を検討）")

    # 5-2 禁忌語
    for w in BANNED:
        if w in post:
            issues.append(f"[5-2] 禁忌語「{w}」を検出。AI臭で信頼が落ちるため具体語に置換する")

    # 4-1 出口の一択性
    found_cta = [name for name, pat in CTA_PATTERNS.items() if re.search(pat, post)]
    if len(found_cta) > 2:
        issues.append(f"[4-1] 出口が{len(found_cta)}種類（{', '.join(found_cta)}）。1つに絞る（フォロー＋リプの併記までは可）")
    elif not found_cta and needs_cta:
        issues.append("[4-1] 出口（CTA）が検出できない。リプ／リンク／引用RPのどれか1つを明記する")
    elif not found_cta:
        notes.append("[4-1] 出口なし（連投の途中なのでOK）。末尾を次投への引きで閉じているか確認")

    # 6-1 数字の実在性（機械には真偽不明なので「要確認」として返す）
    nums = NUM_RE.findall(post)
    numbers = NUM_RE.finditer(post)
    num_list = [m.group(0) for m in numbers]
    if num_list and PLACEHOLDER not in post:
        notes.append(f"[6-1] 要確認: 実績数字 {num_list} は実数か？ 未確定なら {PLACEHOLDER} に置換")

    # 6-3 断定的利益保証
    for pat in GUARANTEE:
        if re.search(pat, post):
            issues.append(f"[6-3] 断定的利益保証の疑い（/{pat}/）。事例として「〇〇さんの場合」に限定する")

    return {
        "index": index,
        "weighted_units": weighted,
        "max_units": MAX_WEIGHTED,
        "visible_chars": visible_chars(post),
        "hook_chars": hook_len,
        "cta_detected": found_cta,
        "issues": issues,
        "notes": notes,
        "verdict": "合格" if not issues else "要修正",
    }


def render(results):
    out = []
    for r in results:
        head = f"── ポスト{r['index']}" if r["index"] is not None else "──"
        out.append(f"{head} 【{r['verdict']}】")
        out.append(f"   文字数: {r['weighted_units']}/280ユニット"
                   f"（日本語換算 約{r['weighted_units']//2}字 / 表示{r['visible_chars']}字）"
                   f"  1行目: {r['hook_chars']}字  出口: {', '.join(r['cta_detected']) or 'なし'}")
        for i in r["issues"]:
            out.append(f"   ✗ {i}")
        for n in r["notes"]:
            out.append(f"   · {n}")
        out.append("")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser(description="𝕏ポストの機械チェック")
    ap.add_argument("path", help="ポスト本文のファイル。'-' で標準入力")
    ap.add_argument("--thread", action="store_true", help="'---' 区切りで連投を個別採点")
    ap.add_argument("--long", action="store_true", help="Premiumの長文ポスト前提（280ユニット超を許容）")
    ap.add_argument("--json", action="store_true", help="JSON出力")
    a = ap.parse_args()

    text = sys.stdin.read() if a.path == "-" else open(a.path, encoding="utf-8").read()
    posts = [p.strip("\n") for p in re.split(r"^---+$", text, flags=re.M)] if a.thread else [text]
    posts = [p for p in posts if p.strip()]
    last = len(posts) - 1
    results = [check(p, i + 1 if a.thread else None, allow_long=a.long,
                     needs_cta=(not a.thread) or i == last)
               for i, p in enumerate(posts)]

    if a.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        print(render(results))
    sys.exit(1 if any(r["issues"] for r in results) else 0)


if __name__ == "__main__":
    main()
