"""
URL検証ツール - 投稿前に全URLが200で開けるか確認

使い方:
    python url_verify.py "https://example.com/foo" "https://example.com/bar"
    # または投稿テキストファイルから自動抽出
    python url_verify.py --from-text post.txt

ルール:
    全URLが200でない限り、投稿はNG（exit code 1）
    リダイレクト先のステータスも確認
"""

import argparse
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

URL_RE = re.compile(r'https?://[^\s)\]"\'　、。]+|(?<![\w/])[a-z0-9.-]+\.(?:com|jp|net|org|co\.jp|biz|info|io|me|tv)/[^\s)\]"\'　、。]*', re.IGNORECASE)


def normalize(url: str) -> str:
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


def verify(url: str, timeout=15):
    """200 を確認。リダイレクトも追跡。"""
    url = normalize(url)
    try:
        req = urllib.request.Request(url, method="HEAD",
                                     headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.geturl()
    except urllib.error.HTTPError as e:
        # HEADが許可されない場合 GET にフォールバック
        if e.code in (405, 403):
            try:
                req = urllib.request.Request(url, method="GET",
                                             headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=timeout) as resp:
                    return resp.status, resp.geturl()
            except Exception as e2:
                return getattr(e2, "code", 0), str(e2)
        return e.code, str(e)
    except Exception as e:
        return 0, str(e)


def extract_urls(text: str):
    return list(set(URL_RE.findall(text)))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("urls", nargs="*", help="URLs to verify")
    p.add_argument("--from-text", help="テキストファイルからURL自動抽出")
    args = p.parse_args()

    urls = list(args.urls)
    if args.from_text:
        text = Path(args.from_text).read_text(encoding="utf-8")
        urls += extract_urls(text)

    if not urls:
        print("ERR: 検証するURLがありません")
        sys.exit(1)

    all_ok = True
    print(f"検証開始: {len(urls)} URLs\n")
    for u in urls:
        status, info = verify(u)
        mark = "OK " if status == 200 else "NG "
        print(f"{mark} [{status}] {u}")
        if status != 200:
            print(f"     → {info}")
            all_ok = False
        elif info != normalize(u):
            print(f"     → redirect: {info}")

    print()
    if all_ok:
        print("RESULT: 全URL OK・投稿可能")
        sys.exit(0)
    else:
        print("RESULT: 不正URLあり・投稿停止")
        sys.exit(1)


if __name__ == "__main__":
    main()
