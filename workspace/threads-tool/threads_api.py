"""Threads API 自動投稿ツール"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

API_BASE = "https://graph.threads.net/v1.0"


def load_credentials():
    env_path = Path(__file__).parent / ".env"
    if not env_path.exists():
        print("エラー: .env ファイルが見つかりません。")
        print(".env.example を .env にコピーして、認証情報を設定してください。")
        sys.exit(1)

    creds = {}
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, value = line.split("=", 1)
            creds[key.strip()] = value.strip()

    user_id = creds.get("THREADS_USER_ID", "")
    token = creds.get("THREADS_ACCESS_TOKEN", "")

    if not user_id or not token:
        print("エラー: .env に THREADS_USER_ID と THREADS_ACCESS_TOKEN を設定してください。")
        sys.exit(1)

    return user_id, token


def api_request(url, params):
    data = urllib.parse.urlencode(params).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            err = json.loads(body)
            msg = err.get("error", {}).get("message", body)
        except json.JSONDecodeError:
            msg = body
        print(f"APIエラー ({e.code}): {msg}")
        sys.exit(1)


def api_get(url):
    try:
        with urllib.request.urlopen(url) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            err = json.loads(body)
            msg = err.get("error", {}).get("message", body)
        except json.JSONDecodeError:
            msg = body
        print(f"APIエラー ({e.code}): {msg}")
        sys.exit(1)


def create_container(user_id, token, text, image_url=None):
    url = f"{API_BASE}/{user_id}/threads"
    if image_url:
        params = {
            "media_type": "IMAGE",
            "image_url": image_url,
            "text": text,
            "access_token": token,
        }
    else:
        params = {
            "media_type": "TEXT",
            "text": text,
            "access_token": token,
        }
    result = api_request(url, params)
    return result["id"]


def publish_container(user_id, token, container_id):
    url = f"{API_BASE}/{user_id}/threads_publish"
    params = {
        "creation_id": container_id,
        "access_token": token,
    }
    result = api_request(url, params)
    return result["id"]


def post_to_threads(text, image_url=None, wait_seconds=5):
    user_id, token = load_credentials()

    print(f"投稿内容:\n{text}\n")
    if image_url:
        print(f"画像URL: {image_url}\n")
    print("コンテナ作成中...")
    container_id = create_container(user_id, token, text, image_url)
    print(f"コンテナID: {container_id}")

    print(f"{wait_seconds}秒待機中（コンテナ処理待ち）...")
    time.sleep(wait_seconds)

    print("公開中...")
    post_id = publish_container(user_id, token, container_id)
    print(f"投稿完了！ 投稿ID: {post_id}")

    log_post(text, post_id)
    return post_id


def batch_post(texts, interval=30):
    print(f"{len(texts)}件の投稿を開始します（投稿間隔: {interval}秒）\n")
    results = []
    for i, text in enumerate(texts, 1):
        print(f"--- 投稿 {i}/{len(texts)} ---")
        post_id = post_to_threads(text)
        results.append({"text": text, "post_id": post_id})
        if i < len(texts):
            print(f"\n次の投稿まで{interval}秒待機...\n")
            time.sleep(interval)
    print(f"\n全{len(texts)}件の投稿が完了しました！")
    return results


def get_profile(user_id, token):
    url = f"{API_BASE}/{user_id}?fields=id,username,threads_profile_picture_url,threads_biography&access_token={token}"
    return api_get(url)


def get_recent_posts(user_id, token, limit=10):
    url = f"{API_BASE}/{user_id}/threads?fields=id,text,timestamp,permalink&limit={limit}&access_token={token}"
    return api_get(url)


def get_post_insights(post_id, token):
    metrics = "views,likes,replies,reposts,quotes"
    url = f"{API_BASE}/{post_id}/insights?metric={metrics}&access_token={token}"
    return api_get(url)


def log_post(text, post_id):
    log_path = Path(__file__).parent / "post_history.jsonl"
    entry = {
        "timestamp": datetime.now().isoformat(),
        "post_id": post_id,
        "text": text[:100],
    }
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def check_token_info(token):
    url = f"https://graph.threads.net/oauth/access_token_info?access_token={token}"
    return api_get(url)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("使い方:")
        print("  python threads_api.py post \"投稿テキスト\"")
        print("  python threads_api.py profile")
        print("  python threads_api.py recent [件数]")
        print("  python threads_api.py insights <投稿ID>")
        print("  python threads_api.py token-info")
        sys.exit(0)

    command = sys.argv[1]

    if command == "post":
        if len(sys.argv) < 3:
            print("エラー: 投稿テキストを指定してください。")
            sys.exit(1)
        text = sys.argv[2]
        image_url = sys.argv[3] if len(sys.argv) > 3 else None
        post_to_threads(text, image_url=image_url)

    elif command == "profile":
        user_id, token = load_credentials()
        profile = get_profile(user_id, token)
        print(json.dumps(profile, indent=2, ensure_ascii=False))

    elif command == "recent":
        user_id, token = load_credentials()
        limit = int(sys.argv[2]) if len(sys.argv) > 2 else 10
        posts = get_recent_posts(user_id, token, limit)
        for post in posts.get("data", []):
            print(f"[{post.get('timestamp', 'N/A')}]")
            print(f"  {post.get('text', '(テキストなし)')[:80]}")
            print(f"  ID: {post.get('id')} | {post.get('permalink', '')}")
            print()

    elif command == "insights":
        if len(sys.argv) < 3:
            print("エラー: 投稿IDを指定してください。")
            sys.exit(1)
        _, token = load_credentials()
        insights = get_post_insights(sys.argv[2], token)
        for item in insights.get("data", []):
            print(f"  {item['name']}: {item['values'][0]['value']}")

    elif command == "token-info":
        _, token = load_credentials()
        info = check_token_info(token)
        print(json.dumps(info, indent=2, ensure_ascii=False))

    else:
        print(f"不明なコマンド: {command}")
        sys.exit(1)
