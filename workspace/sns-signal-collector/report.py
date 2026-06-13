"""週次レポート生成ツール

data/mentions.jsonl を読み、提案書 5-2 のレポート項目に対応する集計を出力する。

  ① 需要シグナル週次推移（ブランド別・急増アラート付き）
  ② 文脈別UGC構成比
  ③ 需要の地理分布（販売エリア外を明示）

出力: output/report_YYYYMMDD.md と output/weekly_counts_YYYYMMDD.csv

急増アラート: 直近週の需要シグナル件数が「前4週平均の1.5倍以上 かつ 5件以上」
"""

import csv
import json
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path

from classify import (
    CONTEXT_LABELS,
    classify,
    estimate_pref,
    is_demand_signal,
)

BASE_DIR = Path(__file__).parent
MENTIONS_FILE = BASE_DIR / "data" / "mentions.jsonl"
OUTPUT_DIR = BASE_DIR / "output"

ALERT_RATIO = 1.5   # 前4週平均に対する倍率
ALERT_MIN = 5       # アラート発火の最低件数


def load_mentions():
    if not MENTIONS_FILE.exists():
        raise SystemExit("エラー: data/mentions.jsonl がありません。先に collect.py を実行してください。")
    mentions = []
    for line in MENTIONS_FILE.read_text(encoding="utf-8").splitlines():
        if line.strip():
            mentions.append(json.loads(line))
    return mentions


def week_monday(created_at):
    """投稿日時 → その週の月曜日（提案書の「毎週月曜朝」レポート単位に合わせる）"""
    dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    monday = dt.date() - timedelta(days=dt.weekday())
    return monday.isoformat()


def load_brand_meta():
    meta = json.loads((BASE_DIR / "brands.json").read_text(encoding="utf-8"))
    names = {b["id"]: b["name"] for b in meta["brands"]}
    return names, set(meta.get("sales_area_prefs", []))


def detect_alerts(weekly_counts):
    """週次件数 dict {week: count} からアラート週を検出する"""
    weeks = sorted(weekly_counts)
    alerts = set()
    for i, week in enumerate(weeks):
        prev = [weekly_counts[w] for w in weeks[max(0, i - 4):i]]
        if not prev:
            continue
        avg = sum(prev) / len(prev)
        count = weekly_counts[week]
        if count >= ALERT_MIN and avg > 0 and count >= avg * ALERT_RATIO:
            alerts.add(week)
    return alerts


def main():
    mentions = load_mentions()
    brand_names, sales_area = load_brand_meta()

    # 分類を付与
    for m in mentions:
        m["context"] = classify(m["text"])
        m["pref"] = estimate_pref(m.get("author_location", ""), m["text"])
        m["week"] = week_monday(m["created_at"])

    is_dummy = any(m.get("source") == "sample_dummy" for m in mentions)

    # ① 需要シグナル週次推移（ブランド別）
    demand_weekly = defaultdict(Counter)  # brand -> {week: count}
    for m in mentions:
        if is_demand_signal(m["context"]):
            demand_weekly[m["brand"]][m["week"]] += 1

    # ② 文脈別構成比
    context_counts = Counter(m["context"] for m in mentions)

    # ③ 地理分布（需要シグナルのみ対象）
    pref_counts = Counter(
        m["pref"] for m in mentions if is_demand_signal(m["context"]) and m["pref"]
    )

    OUTPUT_DIR.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d")
    md_path = OUTPUT_DIR / f"report_{stamp}.md"
    csv_path = OUTPUT_DIR / f"weekly_counts_{stamp}.csv"

    # ---- Markdown レポート ----
    lines = []
    lines.append("# SNS需要シグナル 週次レポート")
    lines.append("")
    lines.append(f"生成日: {datetime.now().strftime('%Y-%m-%d %H:%M')} ／ 分析対象: {len(mentions)}件")
    if is_dummy:
        lines.append("")
        lines.append("> **※本レポートはダミーデータに基づく動作確認用サンプルです。実データではありません。**")
    lines.append("")

    lines.append("## ① 需要シグナル週次推移（「買えない・通販希望」言及）")
    lines.append("")
    for brand_id, weekly in sorted(demand_weekly.items()):
        alerts = detect_alerts(weekly)
        lines.append(f"### {brand_names.get(brand_id, brand_id)}")
        lines.append("")
        lines.append("| 週（月曜開始） | 件数 | アラート |")
        lines.append("|---|---|---|")
        for week in sorted(weekly):
            mark = "**急増アラート**" if week in alerts else ""
            lines.append(f"| {week} | {weekly[week]} | {mark} |")
        lines.append("")

    lines.append("## ② 文脈別UGC構成比")
    lines.append("")
    lines.append("| 文脈 | 件数 | 構成比 |")
    lines.append("|---|---|---|")
    total = len(mentions) or 1
    for ctx_id, count in context_counts.most_common():
        lines.append(f"| {CONTEXT_LABELS[ctx_id]} | {count} | {count * 100 // total}% |")
    lines.append("")

    lines.append("## ③ 需要の地理分布（需要シグナル言及・都道府県別）")
    lines.append("")
    lines.append("| 都道府県 | 件数 | 区分 |")
    lines.append("|---|---|---|")
    for pref, count in pref_counts.most_common(10):
        area = "販売エリア内" if pref in sales_area else "**販売エリア外（催事・EC候補地）**"
        lines.append(f"| {pref} | {count} | {area} |")
    lines.append("")

    md_path.write_text("\n".join(lines), encoding="utf-8")

    # ---- CSV（週次件数の生データ） ----
    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["brand", "week_monday", "demand_signal_count"])
        for brand_id, weekly in sorted(demand_weekly.items()):
            for week in sorted(weekly):
                writer.writerow([brand_id, week, weekly[week]])

    print(f"レポートを出力しました: {md_path}")
    print(f"CSVを出力しました: {csv_path}")
    if is_dummy:
        print("※ダミーデータに基づくサンプルレポートです。")


if __name__ == "__main__":
    main()
