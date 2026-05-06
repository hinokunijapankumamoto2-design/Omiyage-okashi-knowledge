"""楽天市場 ランキングAPI取得ツール（openapi.rakuten.co.jp 対応）"""

import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

# 新APIドメイン（2026年2月〜）
RANKING_API = "https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601"
SWEETS_GENRE_ID = 551167


def load_env():
    env_path = Path(__file__).parent / ".env"
    if not env_path.exists():
        return {}
    creds = {}
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        creds[k.strip()] = v.strip()
    return creds


def load_rakuten_credentials():
    env = load_env()
    app_id     = env.get("RAKUTEN_APP_ID", "")
    access_key = env.get("RAKUTEN_ACCESS_KEY", "")
    origin     = env.get("RAKUTEN_ORIGIN", "")

    if not app_id or not access_key:
        print("エラー: .env に RAKUTEN_APP_ID と RAKUTEN_ACCESS_KEY を設定してください。")
        print("取得先: https://webservice.rakuten.co.jp/app/list")
        sys.exit(1)

    return app_id, access_key, origin


def fetch_ranking(genre_id=SWEETS_GENRE_ID, hits=5):
    app_id, access_key, origin = load_rakuten_credentials()

    params = {
        "applicationId": app_id,
        "accessKey":     access_key,
        "genreId":       genre_id,
        "hits":          hits,
        "page":          1,
        "imageFlag":     1,
        "formatVersion": 2,
    }

    url = RANKING_API + "?" + urllib.parse.urlencode(params)
    print(f"📡 楽天ランキングAPI取得中 (genreId={genre_id}, hits={hits})...")

    headers = {"User-Agent": "Mozilla/5.0"}
    if origin:
        headers["Origin"] = origin

    req = urllib.request.Request(url, headers=headers)

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            err = json.loads(body)
            msg = err.get("errors", {}).get("errorMessage", body)
        except Exception:
            msg = body
        print(f"❌ APIエラー ({e.code}): {msg}")
        if e.code == 403 and "REFERRER" in msg:
            print("\n💡 解決策: .env の RAKUTEN_ORIGIN にアプリ登録時のサイトURLを設定してください。")
            print("   例: RAKUTEN_ORIGIN=https://example.com")
            print("   確認先: https://webservice.rakuten.co.jp/app/list → アプリ詳細")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 接続エラー: {e}")
        sys.exit(1)


def parse_items(data, hits=5):
    # formatVersion=2 は 'items' (小文字)、v1 は 'Items' (大文字) の場合あり
    raw = data.get("Items", data.get("items", []))[:hits]
    result = []

    for i, wrapper in enumerate(raw, 1):
        item = wrapper.get("Item", wrapper)

        def pick(lst):
            if not lst:
                return ""
            x = lst[0]
            return x.get("imageUrl", x) if isinstance(x, dict) else x

        image_url = pick(item.get("mediumImageUrls", [])) or \
                    pick(item.get("smallImageUrls", []))

        result.append({
            "rank":         i,
            "name":         item.get("itemName", ""),
            "price":        item.get("itemPrice", 0),
            "shop":         item.get("shopName", ""),
            "review_count": item.get("reviewCount", 0),
            "review_avg":   item.get("reviewAverage", 0.0),
            "image_url":    image_url,
            "item_url":     item.get("itemUrl", ""),
            "catch_copy":   item.get("catchcopy", ""),
        })

    return result


def display(items):
    print("\n" + "="*65)
    print(f"  楽天スイーツ・お菓子 デイリーランキング TOP{len(items)}")
    print("="*65)
    for item in items:
        print(f"\n  【{item['rank']}位】 {item['name'][:45]}")
        print(f"  店舗  : {item['shop']}")
        print(f"  価格  : {item['price']:,}円")
        rc, ra = item['review_count'], item['review_avg']
        if rc:
            print(f"  評価  : ⭐{ra} ({rc:,}件)")
        if item['image_url']:
            print(f"  画像  : {item['image_url'][:70]}")
    print("\n" + "="*65)


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--hits",  type=int, default=5)
    ap.add_argument("--genre", type=int, default=SWEETS_GENRE_ID)
    ap.add_argument("--save",  action="store_true")
    args = ap.parse_args()

    data  = fetch_ranking(genre_id=args.genre, hits=args.hits)
    items = parse_items(data, hits=args.hits)
    display(items)

    if args.save:
        out = Path(__file__).parent / "ranking_cache.json"
        out.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n✅ キャッシュ保存: {out}")
