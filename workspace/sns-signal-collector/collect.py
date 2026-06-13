"""X API v2 言及収集ツール

対象ブランド（brands.json）への公開言及を X API v2 の recent search
（直近7日）で取得し、data/mentions.jsonl に追記する。

- 認証: .env の X_BEARER_TOKEN（Bearer Token）
- 重複防止: 取得済みID集合 + ブランドごとの since_id（data/state.json）
- 従量課金対策: --max-pages でページ数上限を必ず指定（既定1ページ=最大100件）
- --mock: APIを呼ばず sample_data/ のダミーデータを取り込む（動作確認用）

スクレイピングによる収集は実装しない（CLAUDE.md 絶対ルール1）。
"""

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
MENTIONS_FILE = DATA_DIR / "mentions.jsonl"
STATE_FILE = DATA_DIR / "state.json"
SAMPLE_FILE = BASE_DIR / "sample_data" / "sample_mentions.jsonl"

SEARCH_URL = "https://api.x.com/2/tweets/search/recent"


def load_bearer_token():
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        print("エラー: .env ファイルが見つかりません。")
        print(".env.example を .env にコピーして X_BEARER_TOKEN を設定してください。")
        sys.exit(1)

    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("X_BEARER_TOKEN="):
            token = line.split("=", 1)[1].strip()
            if token:
                return token

    print("エラー: .env に X_BEARER_TOKEN を設定してください。")
    sys.exit(1)


def load_brands():
    return json.loads((BASE_DIR / "brands.json").read_text(encoding="utf-8"))["brands"]


def load_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {}


def save_state(state):
    DATA_DIR.mkdir(exist_ok=True)
    STATE_FILE.write_text(
        json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def load_seen_ids():
    """既存データの投稿IDを読み、重複取り込みを防ぐ"""
    seen = set()
    if MENTIONS_FILE.exists():
        for line in MENTIONS_FILE.read_text(encoding="utf-8").splitlines():
            if line.strip():
                seen.add(json.loads(line)["id"])
    return seen


def api_search(token, query, since_id=None, next_token=None):
    params = {
        "query": query,
        "max_results": 100,
        "tweet.fields": "created_at,public_metrics,author_id,lang",
        "expansions": "author_id",
        "user.fields": "location,username",
    }
    if since_id:
        params["since_id"] = since_id
    if next_token:
        params["next_token"] = next_token

    url = f"{SEARCH_URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        if e.code == 429:
            reset = e.headers.get("x-rate-limit-reset", "")
            print(f"レート制限に到達しました（429）。リセット時刻(UTC epoch): {reset}")
            print("時間を置いて再実行してください。")
        else:
            print(f"APIエラー ({e.code}): {body}")
        sys.exit(1)


def excluded(text, exclude_patterns):
    return any(pat.lower() in text.lower() for pat in exclude_patterns)


def to_mention(tweet, users, brand_id):
    author = users.get(tweet.get("author_id", ""), {})
    metrics = tweet.get("public_metrics", {})
    return {
        "id": tweet["id"],
        "brand": brand_id,
        "text": tweet.get("text", ""),
        "created_at": tweet.get("created_at", ""),
        "author_location": author.get("location", ""),
        "like_count": metrics.get("like_count", 0),
        "retweet_count": metrics.get("retweet_count", 0),
        "source": "x_api_v2",
        "collected_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


def collect_brand(token, brand, state, seen, max_pages):
    """1ブランド分を収集して新規言及リストを返す"""
    brand_id = brand["id"]
    since_id = state.get(brand_id, {}).get("newest_id")
    next_token = None
    new_mentions = []
    newest_id = since_id

    for page in range(max_pages):
        resp = api_search(token, brand["query"], since_id=since_id, next_token=next_token)
        meta = resp.get("meta", {})
        tweets = resp.get("data", [])
        users = {u["id"]: u for u in resp.get("includes", {}).get("users", [])}

        for tweet in tweets:
            if tweet["id"] in seen:
                continue
            if excluded(tweet.get("text", ""), brand.get("exclude_patterns", [])):
                continue
            new_mentions.append(to_mention(tweet, users, brand_id))
            seen.add(tweet["id"])

        if meta.get("newest_id") and (not newest_id or int(meta["newest_id"]) > int(newest_id)):
            newest_id = meta["newest_id"]

        next_token = meta.get("next_token")
        if not next_token:
            break
        time.sleep(1)  # レート制限への配慮

    if newest_id:
        state.setdefault(brand_id, {})["newest_id"] = newest_id
    return new_mentions


def append_mentions(mentions):
    DATA_DIR.mkdir(exist_ok=True)
    with MENTIONS_FILE.open("a", encoding="utf-8") as f:
        for m in mentions:
            f.write(json.dumps(m, ensure_ascii=False) + "\n")


def run_mock():
    """sample_data のダミーデータを取り込む（API不要の動作確認用）"""
    if not SAMPLE_FILE.exists():
        print(f"エラー: {SAMPLE_FILE} がありません。")
        sys.exit(1)
    seen = load_seen_ids()
    mentions = []
    for line in SAMPLE_FILE.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        m = json.loads(line)
        if m["id"] not in seen:
            mentions.append(m)
            seen.add(m["id"])
    append_mentions(mentions)
    print(f"[mock] ダミーデータ {len(mentions)} 件を取り込みました → {MENTIONS_FILE}")
    print("※これはダミーデータです。レポートにもダミー表記が付きます。")


def main():
    parser = argparse.ArgumentParser(description="X API v2 言及収集")
    parser.add_argument("--brand", help="対象ブランドID（省略時は全ブランド）")
    parser.add_argument("--max-pages", type=int, default=1,
                        help="ブランドあたりの最大取得ページ数（1ページ=最大100件、既定1）")
    parser.add_argument("--mock", action="store_true",
                        help="APIを呼ばずダミーデータを取り込む")
    args = parser.parse_args()

    if args.mock:
        run_mock()
        return

    token = load_bearer_token()
    brands = load_brands()
    if args.brand:
        brands = [b for b in brands if b["id"] == args.brand]
        if not brands:
            print(f"エラー: ブランドID '{args.brand}' は brands.json にありません。")
            sys.exit(1)

    state = load_state()
    seen = load_seen_ids()
    total = 0
    for brand in brands:
        mentions = collect_brand(token, brand, state, seen, args.max_pages)
        append_mentions(mentions)
        total += len(mentions)
        print(f"{brand['name']}: 新規 {len(mentions)} 件")

    save_state(state)
    print(f"合計 {total} 件を追記しました → {MENTIONS_FILE}")


if __name__ == "__main__":
    main()
