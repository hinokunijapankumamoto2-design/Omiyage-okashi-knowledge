"""
スイーツ王子 Threads投稿AI（モード切替式）
使い方:
    python auto_post.py --mode rakuten_daily       # 楽天デイリーランキング分析
    python auto_post.py --mode sns_research        # SNS競合・空白ポジション戦略調査
    python auto_post.py                            # モード対話選択
    python auto_post.py --list-modes               # 利用可能なモード一覧
"""

import json
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path

# Windowsコンソールの文字化け対策
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

# ──────────────────────────────────────────
# 定数
# ──────────────────────────────────────────
ROOT = Path(__file__).parent
ENV_PATH = ROOT / ".env"
LOG_PATH = ROOT / "post_history.jsonl"
MODES_DIR = ROOT / "modes"
CURRENT_MODE_FILE = ROOT / "current_mode.txt"
PERSONA_PATH = ROOT / "persona.md"

RAKUTEN_API     = "https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601"
THREADS_API     = "https://graph.threads.net/v1.0"
SWEETS_GENRE_ID = 551167


# ──────────────────────────────────────────
# モード管理
# ──────────────────────────────────────────

def list_modes():
    """modes/ から利用可能モードIDを返す（_template と README 系は除外）"""
    if not MODES_DIR.exists():
        return []
    modes = []
    for path in sorted(MODES_DIR.glob("*.md")):
        name = path.stem
        if name.startswith("_") or name.lower() == "readme":
            continue
        modes.append(name)
    return modes


def load_mode(mode_id):
    """モードファイルを読み込み、(frontmatter dict, body str) を返す"""
    path = MODES_DIR / f"{mode_id}.md"
    if not path.exists():
        print(f"❌ モードが見つかりません: {mode_id}")
        print(f"   利用可能: {', '.join(list_modes()) or '（なし）'}")
        sys.exit(1)

    text = path.read_text(encoding="utf-8")
    meta, body = {}, text
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end > 0:
            front = text[3:end].strip()
            body = text[end + 4:].lstrip("\n")
            for line in front.splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    meta[k.strip()] = v.strip()
    return meta, body


def select_mode_interactive():
    """対話でモード選択 → current_mode.txt に保存して返す"""
    modes = list_modes()
    if not modes:
        print("❌ modes/ にモードファイルがありません。")
        sys.exit(1)

    print("\n" + "─" * 60)
    print("  投稿モードを選択してください")
    print("─" * 60)
    table = {}
    for i, m in enumerate(modes, 1):
        meta, _ = load_mode(m)
        table[i] = m
        print(f"  {i}) {m:20s}  {meta.get('name', m)}")
        if meta.get("description"):
            print(f"       └ {meta['description']}")
    print()

    while True:
        ans = input(f"番号を入力 (1-{len(modes)}) > ").strip()
        if ans.isdigit() and 1 <= int(ans) <= len(modes):
            chosen = table[int(ans)]
            CURRENT_MODE_FILE.write_text(chosen, encoding="utf-8")
            return chosen
        print("  → 有効な番号を入力してください")


def print_modes():
    """--list-modes 用：一覧表示して終了"""
    modes = list_modes()
    print("\n利用可能なモード:")
    for m in modes:
        meta, _ = load_mode(m)
        print(f"  {m:20s}  {meta.get('name', '')}")
        if meta.get("description"):
            print(f"  {'':20s}  {meta['description']}")
    print()


# ──────────────────────────────────────────
# セットアップ確認
# ──────────────────────────────────────────

def load_env():
    if not ENV_PATH.exists():
        return {}
    creds = {}
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        creds[k.strip()] = v.strip()
    return creds


def save_env(creds: dict):
    lines = []
    for k, v in creds.items():
        lines.append(f"{k}={v}")
    ENV_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def setup_credentials():
    """未設定の認証情報をインタラクティブに入力"""
    creds = load_env()
    changed = False

    required = {
        "RAKUTEN_APP_ID":     "楽天アプリID（webservice.rakuten.co.jp/app/list で確認）",
        "RAKUTEN_ACCESS_KEY": "楽天アクセスキー（pk_で始まる文字列）",
        "RAKUTEN_ORIGIN":     "アプリ登録時のサイトURL（例: https://example.com）",
        "THREADS_USER_ID":    "Threads ユーザーID（数字）",
        "THREADS_ACCESS_TOKEN": "Threads アクセストークン（THAA...）",
    }

    print("\n" + "="*60)
    print("  認証情報セットアップ")
    print("="*60)

    for key, label in required.items():
        if creds.get(key) and creds[key] not in ("", "あなたの楽天アプリケーションID",
                                                   "あなたのThreadsユーザーID（数字）",
                                                   "あなたのアクセストークン（THAAで始まる文字列）"):
            print(f"✅ {key}: 設定済み")
            continue
        print(f"\n❌ {key} が未設定です")
        print(f"   {label}")
        val = input(f"   入力してください > ").strip()
        if not val:
            print("スキップしました（後で .env に手動で設定してください）")
            continue
        creds[key] = val
        changed = True

    if changed:
        save_env(creds)
        print(f"\n✅ .env を保存しました: {ENV_PATH}")

    return creds


def validate_credentials(creds):
    missing = []
    for k in ("RAKUTEN_APP_ID", "RAKUTEN_ACCESS_KEY", "THREADS_USER_ID", "THREADS_ACCESS_TOKEN"):
        if not creds.get(k):
            missing.append(k)
    if missing:
        print(f"\n❌ 未設定の認証情報: {', '.join(missing)}")
        print(f"   .env ファイルに設定してください: {ENV_PATH}")
        sys.exit(1)


# ──────────────────────────────────────────
# 楽天ランキング取得
# ──────────────────────────────────────────

def fetch_ranking(app_id, access_key, origin="", genre_id=SWEETS_GENRE_ID, hits=5):
    params = {
        "applicationId": app_id,
        "accessKey":     access_key,
        "genreId":       genre_id,
        "hits":          hits,
        "page":          1,
        "imageFlag":     1,
        "formatVersion": 2,
    }
    url = RAKUTEN_API + "?" + urllib.parse.urlencode(params)
    headers = {"User-Agent": "Mozilla/5.0"}
    if origin:
        headers["Origin"] = origin

    print(f"\n📡 楽天ランキングAPI取得中...")
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            err = json.loads(body)
            msg = err.get("errors", {}).get("errorMessage",
                  err.get("error_description", body))
        except Exception:
            msg = body
        print(f"❌ APIエラー ({e.code}): {msg}")
        if "REFERRER" in msg:
            print("💡 .env の RAKUTEN_ORIGIN にアプリ登録サイトURLを設定してください。")
            print("   確認先: https://webservice.rakuten.co.jp/app/list")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 接続エラー: {e}")
        sys.exit(1)


def parse_items(data, hits=5):
    raw = data.get("Items", data.get("items", []))[:hits]
    items = []
    for i, wrapper in enumerate(raw, 1):
        item = wrapper.get("Item", wrapper)

        def pick_url(lst):
            if not lst:
                return ""
            x = lst[0]
            return x.get("imageUrl", x) if isinstance(x, dict) else x

        image_url = pick_url(item.get("mediumImageUrls", [])) or \
                    pick_url(item.get("smallImageUrls", []))

        items.append({
            "rank":         i,
            "name":         item.get("itemName", ""),
            "price":        item.get("itemPrice", 0),
            "shop":         item.get("shopName", ""),
            "review_count": item.get("reviewCount", 0),
            "review_avg":   item.get("reviewAverage", 0.0),
            "image_url":    image_url,
            "item_url":     item.get("itemUrl", ""),
        })
    return items


# ──────────────────────────────────────────
# 投稿文自動生成
# ──────────────────────────────────────────

def short(name, n=28):
    return name[:n] + "…" if len(name) > n else name


TAGS = {1: "#お取り寄せスイーツ", 2: "#チョコレート", 3: "#お菓子",
        4: "#スイーツ", 5: "#焼き菓子"}

HOOKS = {
    1: "楽天スイーツ、今日の1位はこれ。",
    2: "2位がこれ、納得の理由がある。",
    3: "3位にひっそり潜む実力派。",
    4: "4位のこの商品、レビューが語る。",
    5: "5位も見逃せない一品。",
}

def generate_post(item):
    rank  = item["rank"]
    name  = short(item["name"])
    price = item["price"]
    shop  = item["shop"]
    rc    = item["review_count"]
    ra    = item["review_avg"]
    hook  = HOOKS.get(rank, f"{rank}位にランクイン。")
    tag   = TAGS.get(rank, "#お取り寄せスイーツ")

    review_line = f"レビュー {rc:,}件・{ra}点" if rc > 0 else ""
    price_line  = f"{price:,}円" if price > 0 else ""
    meta = " ／ ".join(filter(None, [price_line, review_line, shop]))

    text = (
        f"{hook}\n\n"
        f"{name}\n"
        f"{meta}\n\n"
        f"この商品が売れ続ける理由、一緒に考えてみませんか？\n\n"
        f"{tag}"
    )
    return text.strip()


# ──────────────────────────────────────────
# Threads API 投稿
# ──────────────────────────────────────────

def api_post(url, params):
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
        except Exception:
            msg = body
        print(f"  ❌ APIエラー ({e.code}): {msg}")
        return None


def post_to_threads(user_id, token, text, image_url=None, wait=5):
    # ① コンテナ作成
    container_params = {"text": text, "access_token": token}
    if image_url:
        container_params["media_type"] = "IMAGE"
        container_params["image_url"]  = image_url
    else:
        container_params["media_type"] = "TEXT"

    res = api_post(f"{THREADS_API}/{user_id}/threads", container_params)
    if not res:
        return None
    container_id = res["id"]
    print(f"  コンテナ作成: {container_id}")

    # コンテナ処理待ち
    time.sleep(wait)

    # ② 公開
    pub_res = api_post(f"{THREADS_API}/{user_id}/threads_publish",
                       {"creation_id": container_id, "access_token": token})
    if not pub_res:
        return None
    post_id = pub_res["id"]

    # ログ記録
    log = {"timestamp": datetime.now().isoformat(),
           "post_id": post_id, "text": text[:80]}
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(log, ensure_ascii=False) + "\n")

    return post_id


# ──────────────────────────────────────────
# メイン
# ──────────────────────────────────────────

def run_rakuten_daily(args, creds, mode_meta, mode_body):
    """rakuten_daily モード：楽天APIから自動取得→投稿フローを実行"""
    app_id     = creds["RAKUTEN_APP_ID"]
    access_key = creds["RAKUTEN_ACCESS_KEY"]
    origin     = creds.get("RAKUTEN_ORIGIN", "")
    user_id    = creds["THREADS_USER_ID"]
    token      = creds["THREADS_ACCESS_TOKEN"]

    # ── 楽天ランキング取得 ──
    data  = fetch_ranking(app_id, access_key, origin, hits=args.hits)
    items = parse_items(data, hits=args.hits)

    print(f"\n✅ {len(items)}商品 取得完了\n")
    print("─"*60)
    for item in items:
        print(f"  {item['rank']}位 | {item['price']:,}円 | ⭐{item['review_avg']} ({item['review_count']:,}件)")
        print(f"       {item['name'][:50]}")
        print(f"       {item['shop']}")
        print()

    # ── 投稿文生成 ──
    posts = []
    for item in items:
        text = generate_post(item)
        posts.append({"item": item, "text": text})

    print("─"*60)
    print("【投稿プレビュー】\n")
    for p in posts:
        print(f"── {p['item']['rank']}位 ──────────────────────────")
        print(p["text"])
        img = p["item"]["image_url"]
        print(f"🖼  {img[:70]}..." if len(img) > 70 else f"🖼  {img}")
        print()

    # ── 確認 ──
    if not args.yes:
        print("─"*60)
        ans = input(f"上記 {len(posts)}件を {args.interval}秒間隔で Threads に投稿しますか？ (yes/no) > ")
        if ans.strip().lower() != "yes":
            print("キャンセルしました。")
            sys.exit(0)

    # ── 投稿実行 ──
    print(f"\n🚀 投稿開始（間隔: {args.interval}秒）\n")
    success = 0
    for i, p in enumerate(posts, 1):
        item      = p["item"]
        text      = p["text"]
        image_url = item["image_url"] or None

        print(f"[{i}/{len(posts)}] {item['rank']}位: {short(item['name'], 30)}")
        post_id = post_to_threads(user_id, token, text, image_url=image_url)

        if post_id:
            print(f"  ✅ 投稿完了 post_id: {post_id}")
            success += 1
        else:
            print(f"  ❌ 投稿失敗")

        if i < len(posts):
            print(f"  ⏳ {args.interval}秒待機...")
            time.sleep(args.interval)

    print(f"\n{'='*60}")
    print(f"  完了: {success}/{len(posts)} 件投稿成功")
    print(f"  ログ: {LOG_PATH}")
    print("="*60 + "\n")


def run_prompt_mode(mode_id, mode_meta, mode_body):
    """rakuten_daily 以外のモード：プロンプトを表示してユーザーがAIに渡せるよう支援"""
    print(f"\n📖 モード『{mode_meta.get('name', mode_id)}』のプロンプトを出力します。\n")
    print(f"   data_source: {mode_meta.get('data_source', '不明')}")
    print(f"   output_type: {mode_meta.get('output_type', '不明')}\n")
    print("─" * 60)
    print("以下のプロンプトをClaude/ChatGPTに貼り付けて分析を実行してください。")
    print("結果として得られた投稿文は `threads_api.py post \"...\"` で投稿できます。")
    print("─" * 60 + "\n")

    # 共通人格
    if PERSONA_PATH.exists():
        print("# 【人格定義】（必ず冒頭に読み込ませる）\n")
        print(PERSONA_PATH.read_text(encoding="utf-8"))
        print("\n" + "─" * 60 + "\n")

    # モード本体
    print(f"# 【モード：{mode_meta.get('name', mode_id)}】\n")
    print(mode_body)


def main():
    import argparse
    parser = argparse.ArgumentParser(description="スイーツ王子 Threads投稿AI（モード切替式）")
    parser.add_argument("--mode",        type=str, default=None, help="投稿モード（modes/ 配下のID。未指定なら対話選択）")
    parser.add_argument("--list-modes",  action="store_true", help="利用可能なモード一覧を表示して終了")
    parser.add_argument("--yes",         action="store_true", help="確認プロンプトをスキップ")
    parser.add_argument("--hits",        type=int, default=5,  help="取得件数（rakuten_daily 用、デフォルト: 5）")
    parser.add_argument("--interval",    type=int, default=60, help="投稿間隔 秒（デフォルト: 60）")
    parser.add_argument("--setup",       action="store_true", help="認証情報を再設定する")
    args = parser.parse_args()

    # --list-modes は単独で完結
    if args.list_modes:
        print_modes()
        return

    print("\n" + "="*60)
    print("  スイーツ王子 Threads投稿AI")
    print("="*60)

    # ── モード決定 ──
    mode_id = args.mode
    if not mode_id and CURRENT_MODE_FILE.exists():
        mode_id = CURRENT_MODE_FILE.read_text(encoding="utf-8").strip() or None
        if mode_id:
            print(f"📌 current_mode.txt から復元: {mode_id}")
    if not mode_id:
        mode_id = select_mode_interactive()
    else:
        CURRENT_MODE_FILE.write_text(mode_id, encoding="utf-8")

    mode_meta, mode_body = load_mode(mode_id)
    print(f"\n🎯 モード: {mode_meta.get('name', mode_id)}")
    if mode_meta.get("description"):
        print(f"   {mode_meta['description']}\n")

    # ── 認証情報（rakuten_daily のみ必須） ──
    data_source = mode_meta.get("data_source", "manual")
    if data_source == "rakuten_api":
        if args.setup or not ENV_PATH.exists():
            creds = setup_credentials()
        else:
            creds = load_env()
        validate_credentials(creds)
        run_rakuten_daily(args, creds, mode_meta, mode_body)
    else:
        run_prompt_mode(mode_id, mode_meta, mode_body)


if __name__ == "__main__":
    main()
