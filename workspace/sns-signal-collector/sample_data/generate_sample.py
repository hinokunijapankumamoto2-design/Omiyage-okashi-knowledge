"""動作確認用ダミー言及データの生成スクリプト

実在の投稿ではない。文脈分類・週次集計・アラート検出の動作確認のためだけに使う。
生成物の source は必ず "sample_dummy" とし、レポート側でダミー表記を出す。

実行: python3 generate_sample.py  → sample_mentions.jsonl を再生成
"""

import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

OUT = Path(__file__).parent / "sample_mentions.jsonl"

random.seed(42)  # 再現性のため固定

# (テキスト雛形, 文脈の意図, 都道府県候補)
TEMPLATES = [
    ("{b}どこで買えるの？近くに売ってない…", "demand_ec", ["大阪", "愛知", "福岡", "北海道", "宮城", "広島"]),
    ("{b}を通販してほしい。お取り寄せできたら絶対買う", "demand_ec", ["大阪", "愛知", "福岡", "北海道", "新潟"]),
    ("{b}買えなかった…行列すごすぎて諦めた", "demand_unavailable", ["東京", "神奈川", "埼玉", "千葉"]),
    ("{b}また売り切れ。何時に並べばいいんだ", "demand_unavailable", ["東京", "神奈川"]),
    ("出張土産で{b}もらった！嬉しい", "gift_received", ["大阪", "愛知", "福岡", "京都", "兵庫"]),
    ("実家の母が{b}を送ってくれた。懐かしい味", "gift_received", ["北海道", "宮城", "新潟", "岡山"]),
    ("明日の手土産は{b}にした。外さない", "gift_giving", ["東京", "神奈川", "埼玉"]),
    ("帰省土産に{b}持って行く", "gift_giving", ["東京", "千葉"]),
    ("自分用に{b}買ってきた。ご褒美", "self_purchase", ["東京", "神奈川"]),
    ("{b}やっと買えた！", "self_purchase", ["東京", "埼玉"]),
    ("{b}美味しい。何個でも食べられる", "taste_only", ["東京", "大阪", "愛知", "福岡", ""]),
    ("{b}食べました。リピート確定", "taste_only", ["東京", "京都", ""]),
]

BRANDS = [
    ("gomatamago", "ごまたまご", 4),
    ("nycsand", "NYキャラメルサンド", 7),
    ("caramer", "CARAMER", 2),
]

# 直近10週（月曜起点）。GW週は需要シグナルを増幅させ、アラート検出を確認できるようにする
BASE_MONDAY = datetime(2026, 4, 6, tzinfo=timezone.utc)
WEEK_WEIGHTS = [1.0, 1.0, 1.0, 1.8, 2.6, 1.2, 1.0, 1.0, 1.0, 1.0]  # 4/27・5/4週が急増


def main():
    rows = []
    seq = 1
    for week_idx, weight in enumerate(WEEK_WEIGHTS):
        monday = BASE_MONDAY + timedelta(weeks=week_idx)
        for brand_id, brand_label, per_week in BRANDS:
            n = max(1, round(per_week * weight))
            for _ in range(n):
                text_tpl, _ctx, prefs = random.choice(TEMPLATES)
                pref = random.choice(prefs)
                dt = monday + timedelta(
                    days=random.randint(0, 6), hours=random.randint(7, 23)
                )
                rows.append(
                    {
                        "id": f"dummy-{seq:05d}",
                        "brand": brand_id,
                        "text": text_tpl.format(b=brand_label),
                        "created_at": dt.isoformat(timespec="seconds"),
                        "author_location": pref,
                        "like_count": random.randint(0, 50),
                        "retweet_count": random.randint(0, 10),
                        "source": "sample_dummy",
                        "collected_at": dt.isoformat(timespec="seconds"),
                    }
                )
                seq += 1

    with OUT.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"ダミーデータ {len(rows)} 件を生成しました → {OUT}")


if __name__ == "__main__":
    main()
