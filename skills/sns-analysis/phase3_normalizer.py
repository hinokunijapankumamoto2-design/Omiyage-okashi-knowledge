#!/usr/bin/env python3
"""
KENGOOD SNS Intelligence Engine v2
Phase 3: Normalize

設計方針（KENGOOD_SNS_Intelligence_Engine_v2.md §7 準拠）：
- Pythonのみで処理する。LLM（Haiku/Sonnet/Opus/GPT）は使用しない。
- 数値変換（1.5K→1500, 1.5万→15000, 1.2M→1200000）
- timezone normalization
- URL normalization
- account normalization
- post normalization
- duplicate removal
"""

import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Dict, List, Optional
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

# 追跡用パラメータなど、正規化時に除去するクエリキー
_TRACKING_PARAM_PREFIXES = ("utm_", "ref_", "s=", "twclid")
_TRACKING_PARAM_NAMES = {"ref", "s", "twclid", "igshid"}

# "1.5K" "15K" "1.5万" "1.2M" などにマッチする数値表記
_METRIC_UNIT_RE = re.compile(
    r"^\s*([0-9]+(?:[.,][0-9]+)?)\s*([KkMm万億]?)\s*$"
)

_UNIT_MULTIPLIER = {
    "": 1,
    "k": 1_000,
    "m": 1_000_000,
    "万": 10_000,
    "億": 100_000_000,
}


class Normalizer:
    """Phase 3: データ正規化（すべて静的メソッド・決定論的処理）"""

    # ---------------- 数値正規化 ----------------

    @staticmethod
    def parse_metric(value) -> Optional[int]:
        """
        "1.5K" → 1500
        "1.5万" → 15000
        "1.2M" → 1200000
        "3,200" → 3200
        123 → 123
        None / 空文字 / 解析不能 → None
        """
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return int(value)

        text = str(value).strip().replace(",", "")
        if not text:
            return None

        match = _METRIC_UNIT_RE.match(text)
        if not match:
            # 単位なしの純粋な数字文字列
            try:
                return int(float(text))
            except ValueError:
                return None

        number_part, unit_part = match.groups()
        multiplier = _UNIT_MULTIPLIER.get(unit_part.lower(), None)
        if multiplier is None:
            return None

        try:
            return int(round(float(number_part) * multiplier))
        except ValueError:
            return None

    # ---------------- タイムスタンプ正規化 ----------------

    @staticmethod
    def normalize_timestamp(value) -> Optional[str]:
        """
        様々な形式のタイムスタンプをUTCのISO8601文字列へ統一する。

        対応形式:
        - ISO8601（"Z" 終端含む）
        - "YYYY-MM-DD HH:MM:SS"
        - X API v1.1形式（"Wed Oct 10 20:19:24 +0000 2018"）
        - UNIXタイムスタンプ（int / 数値文字列、秒 or ミリ秒）
        """
        if value is None or value == "":
            return None

        # UNIXタイムスタンプ（秒・ミリ秒どちらも許容）
        if isinstance(value, (int, float)):
            return Normalizer._from_unix(value)

        text = str(value).strip()

        if text.isdigit():
            return Normalizer._from_unix(int(text))

        # ISO8601
        try:
            dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
            return Normalizer._to_utc_iso(dt)
        except ValueError:
            pass

        # X API v1.1 形式 (RFC 2822 相当)
        try:
            dt = parsedate_to_datetime(text)
            return Normalizer._to_utc_iso(dt)
        except (ValueError, TypeError):
            pass

        # "YYYY-MM-DD HH:MM:SS"
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S", "%Y-%m-%d"):
            try:
                dt = datetime.strptime(text, fmt)
                return Normalizer._to_utc_iso(dt)
            except ValueError:
                continue

        return None

    @staticmethod
    def _from_unix(value: float) -> str:
        # ミリ秒精度のタイムスタンプ（13桁程度）を秒へ変換
        if value > 1e12:
            value = value / 1000.0
        dt = datetime.fromtimestamp(value, tz=timezone.utc)
        return Normalizer._to_utc_iso(dt)

    @staticmethod
    def _to_utc_iso(dt: datetime) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt.isoformat()

    # ---------------- アカウント正規化 ----------------

    @staticmethod
    def normalize_handle(handle: Optional[str]) -> Optional[str]:
        """
        "@ichiaimarketer" → "ichiaimarketer"
        大文字小文字を無視した比較ができるよう小文字化する。
        """
        if not handle:
            return None
        return handle.strip().lstrip("@").lower()

    # ---------------- URL正規化 ----------------

    @staticmethod
    def normalize_url(url: Optional[str]) -> Optional[str]:
        """
        - スキームを https に統一
        - フラグメントを除去
        - 追跡用クエリパラメータ（utm_*, ref, s, twclid など）を除去
        - 末尾スラッシュを除去
        """
        if not url:
            return None

        parts = urlsplit(url.strip())
        scheme = "https" if parts.scheme in ("http", "https", "") else parts.scheme

        query_pairs = [
            (k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
            if not k.lower().startswith("utm_") and k.lower() not in _TRACKING_PARAM_NAMES
        ]
        query = urlencode(query_pairs)

        path = parts.path.rstrip("/") or ""

        normalized = urlunsplit((scheme, parts.netloc.lower(), path, query, ""))
        return normalized

    # ---------------- 投稿の正規化 ----------------

    @staticmethod
    def normalize_post(post: Dict) -> Dict:
        """
        PostMetrics.to_dict() 互換の辞書を受け取り、
        キー・値を統一された形式に正規化する。
        """
        return {
            "author": Normalizer.normalize_handle(post.get("author")),
            "text": (post.get("text") or "").strip(),
            "likes": Normalizer.parse_metric(post.get("likes")) or 0,
            "retweets": Normalizer.parse_metric(post.get("retweets")) or 0,
            "replies": Normalizer.parse_metric(post.get("replies")) or 0,
            "impressions": Normalizer.parse_metric(post.get("impressions")) or 0,
            "url": Normalizer.normalize_url(post.get("url")),
            "timestamp": Normalizer.normalize_timestamp(post.get("timestamp")),
        }

    @staticmethod
    def normalize_posts(posts: List[Dict]) -> List[Dict]:
        return [Normalizer.normalize_post(p) for p in posts]

    # ---------------- 重複除去 ----------------

    @staticmethod
    def dedupe_posts(posts: List[Dict]) -> List[Dict]:
        """
        正規化済み投稿リストから重複を除去する（最初の出現を残す）。
        キー: (author, url) が両方揃っていればそれを優先、
        無ければ (author, text) をフォールバックキーとする。
        """
        seen = set()
        result = []
        for post in posts:
            author = post.get("author") or ""
            url = post.get("url")
            key = (author, url) if url else (author, post.get("text", ""))
            if key in seen:
                continue
            seen.add(key)
            result.append(post)
        return result


if __name__ == "__main__":
    samples = ["1.5K", "1.5万", "1.2M", "3,200", "42.3万", 890, None, ""]
    for s in samples:
        print(f"{s!r:>10} -> {Normalizer.parse_metric(s)}")

    print()
    print(Normalizer.normalize_timestamp("Wed Oct 10 20:19:24 +0000 2018"))
    print(Normalizer.normalize_timestamp("2026-08-20T09:00:00Z"))
    print(Normalizer.normalize_timestamp(1755680400))

    print()
    print(Normalizer.normalize_url("https://X.com/ichiaimarketer/status/123?utm_source=x&s=20#reply"))
