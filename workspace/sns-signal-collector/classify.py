"""文脈分類エンジン：土産菓子特化の語彙辞書で投稿を「文脈 × 地域」に構造化する

分類カテゴリ（提案書 5-2 のレポート項目に対応）:
  demand_unavailable  入手難（買えない・行列・売り切れ）      ← 需要シグナル
  demand_ec           通販・お取り寄せ要望                    ← 需要シグナル
  gift_received       もらった（受贈）
  gift_giving         手土産・贈答購入
  self_purchase       自分用
  taste_only          実食感想のみ
  other               上記いずれにも該当しない
"""

import sys

# ---------------------------------------------------------------
# 専用語彙辞書（土産菓子特化）。優先度の高い順に判定する。
# 辞書の拡充はこのファイルだけで完結させる。
# ---------------------------------------------------------------
CONTEXT_RULES = [
    (
        "demand_ec",
        "通販・お取り寄せ要望",
        [
            "通販", "お取り寄せ", "おとりよせ", "取り寄せ", "オンラインで買",
            "ネットで買", "通信販売", "送ってほしい", "送って欲しい",
            "全国発送", "どこで買える", "どこに売って", "売ってる場所",
        ],
    ),
    (
        "demand_unavailable",
        "入手難（買えない・行列・売り切れ）",
        [
            "買えない", "買えなかった", "売り切れ", "完売", "行列", "並んだ",
            "並んでる", "入手困難", "手に入らない", "手に入れられ", "諦めた",
            "整理券", "売切れ",
        ],
    ),
    (
        "gift_received",
        "もらった（受贈）",
        [
            "もらった", "貰った", "いただいた", "頂いた", "くれた",
            "差し入れしてもらっ", "お土産でもらう", "送ってくれた", "土産にもらっ",
        ],
    ),
    (
        "gift_giving",
        "手土産・贈答購入",
        [
            "手土産", "お土産に", "おみやげに", "贈り物", "ギフト", "プレゼント",
            "差し入れ", "お使い物", "帰省土産", "持って行く", "持っていく",
        ],
    ),
    (
        "self_purchase",
        "自分用",
        [
            "自分用", "自分へのご褒美", "自分のために", "買ってみた", "買ってきた",
            "ゲットした", "やっと買えた",
        ],
    ),
    (
        "taste_only",
        "実食感想のみ",
        [
            "美味しい", "おいしい", "うまい", "うますぎ", "食べた", "食べました",
            "リピート", "好き", "最高",
        ],
    ),
]

CONTEXT_LABELS = {ctx_id: label for ctx_id, label, _ in CONTEXT_RULES}
CONTEXT_LABELS["other"] = "その他"

# 需要シグナル（提案書の「買えない」「通販してほしい」言及）に数えるカテゴリ
DEMAND_SIGNAL_CONTEXTS = {"demand_ec", "demand_unavailable"}

PREFECTURES = [
    "北海道", "青森", "岩手", "宮城", "秋田", "山形", "福島",
    "茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川",
    "新潟", "富山", "石川", "福井", "山梨", "長野", "岐阜",
    "静岡", "愛知", "三重", "滋賀", "京都", "大阪", "兵庫",
    "奈良", "和歌山", "鳥取", "島根", "岡山", "広島", "山口",
    "徳島", "香川", "愛媛", "高知", "福岡", "佐賀", "長崎",
    "熊本", "大分", "宮崎", "鹿児島", "沖縄",
]


def classify(text):
    """投稿本文を文脈カテゴリIDに分類する（優先度順の辞書マッチ）"""
    for ctx_id, _label, words in CONTEXT_RULES:
        for word in words:
            if word in text:
                return ctx_id
    return "other"


def is_demand_signal(ctx_id):
    """需要シグナル（EC在庫・催事判断に使う言及）かどうか"""
    return ctx_id in DEMAND_SIGNAL_CONTEXTS


def estimate_pref(location, text=""):
    """都道府県を推定する。プロフィールの所在地を優先し、なければ本文から拾う"""
    for source in (location or "", text or ""):
        for pref in PREFECTURES:
            if pref in source:
                return pref
    return ""


def main():
    if len(sys.argv) < 2:
        print("使い方: python3 classify.py \"分類したいテキスト\"")
        sys.exit(1)
    text = sys.argv[1]
    ctx = classify(text)
    pref = estimate_pref("", text)
    print(f"文脈: {ctx}（{CONTEXT_LABELS[ctx]}）")
    print(f"需要シグナル: {'はい' if is_demand_signal(ctx) else 'いいえ'}")
    print(f"推定都道府県: {pref or '不明'}")


if __name__ == "__main__":
    main()
