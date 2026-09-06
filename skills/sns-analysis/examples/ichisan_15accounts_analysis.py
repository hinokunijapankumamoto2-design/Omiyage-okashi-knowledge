#!/usr/bin/env python3
"""
KENGOOD SNS Intelligence Engine v2
いちさん（株式会社PLai代表、AirCle代表）15アカウント分析 - Phase 0〜4 統合実行

既存の examples/analyze_ichisan_oauth.py（Phase 1: 生データ取得のみ）に対し、
本スクリプトは Phase 0（Target Resolver）→ Phase 0.5（Source Policy Gate）
→ Phase 1（既存scraper/analyzer）→ Phase 2〜4（Evidence/Normalize/Metrics）
までを一気通貫で実行し、エビデンストレース付きのJSONを出力する。

実行方法:
    X_BEARER_TOKEN='AAAA...' python3 ichisan_15accounts_analysis.py
        → X API v2 OAuth で実データを取得して Phase 0〜4 を実行

    python3 ichisan_15accounts_analysis.py
        → Bearer Token 未設定時は、組み込みのサンプルデータ（DEMO用）で
          Phase 0〜4 のパイプライン動作を検証する
          （実アカウントへのアクセスは一切行わない）
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SKILL_DIR))

from kengood_engine_v2 import KengoodEngineV2  # noqa: E402

# ==================== 分析対象 ====================
# いちさん（株式会社PLai代表、AirCle代表）が自己運用する15アカウント。
# 現時点で確認済みの8アカウントに加え、残り7アカウントは判明次第追記する
# （analyze_ichisan_oauth.py と同じ一次情報に基づく）。
TARGET_CANONICAL_NAME = "いちさん（株式会社PLai代表、AirCle代表）"
TARGET_COMPANY_NAME = "株式会社PLai"

ICHISAN_ACCOUNTS = [
    "ichiaimarketer",     # メインアカウント
    "ClaudeCode_love",    # Claude Code 開発ノウハウ
    "AiAircle34052",      # AirCle - 学生向けAI起業コミュニティ
    "Codestudiopjbk",     # Codex Studio - AI コード生成
    "obsidianstudio9",    # Obsidian + Claude AI 知識管理
    "sumika45379",        # Skill Studio - AI スキル認定
    "opensourcelab9",     # オープンソース研究所 - LLM インフラ
    "AIbusiness9",        # AI ビジネス動向
    # 残り7アカウントは判明次第ここに追加する
]


def fetch_via_oauth(bearer_token: str, limit: int = 10):
    """Phase 1: 既存の scraper.py / analyzer.py を使って実データを取得する"""
    from analyzer import SNSAnalyzer

    analyzer = SNSAnalyzer(TARGET_CANONICAL_NAME)
    posts_data = analyzer.fetch_x_posts_with_oauth(
        handles=ICHISAN_ACCOUNTS, bearer_token=bearer_token, limit=limit
    )
    # PostMetrics -> dict に変換
    return {
        handle: [p.to_dict() for p in posts]
        for handle, posts in posts_data.items()
        if posts
    }


def build_demo_dataset():
    """
    Bearer Token が無い環境向けのDEMOデータ。
    実アカウントへはアクセスせず、Phase 0〜4 のパイプライン検証のみを目的とする。
    数値はすべて説明用のダミー値。
    """
    now_iso = "2026-09-01T10:00:00Z"
    return {
        "ichiaimarketer": [
            {
                "author": "ichiaimarketer",
                "text": "[DEMO] Claude Codeの活用事例を紹介",
                "likes": "1.8K",
                "retweets": "420",
                "replies": 60,
                "impressions": "120000",
                "url": "https://x.com/ichiaimarketer/status/1001",
                "timestamp": now_iso,
            },
            {
                "author": "ichiaimarketer",
                "text": "[DEMO] AirCleコミュニティの近況報告",
                "likes": "540",
                "retweets": "90",
                "replies": 20,
                "impressions": "45000",
                "url": "https://x.com/ichiaimarketer/status/1002",
                "timestamp": now_iso,
            },
        ],
        "ClaudeCode_love": [
            {
                "author": "ClaudeCode_love",
                "text": "[DEMO] Claude Code Tips まとめ",
                "likes": "980",
                "retweets": "210",
                "replies": 15,
                "impressions": "60000",
                "url": "https://x.com/ClaudeCode_love/status/2001",
                "timestamp": now_iso,
            },
        ],
    }


def main():
    bearer_token = os.getenv("X_BEARER_TOKEN")

    print("=" * 80)
    print("🎯 KENGOOD SNS Intelligence Engine v2 - Phase 0〜4 統合実行")
    print(f"   対象: {TARGET_CANONICAL_NAME}")
    print(f"   登録アカウント数: {len(ICHISAN_ACCOUNTS)}")
    print("=" * 80)
    print()

    if bearer_token:
        print("✅ X_BEARER_TOKEN を検出。X API v2 OAuth で実データを取得します。")
        raw_posts_by_account = fetch_via_oauth(bearer_token)
        if not raw_posts_by_account:
            print("⚠️ 実データ取得に失敗したため、DEMOデータへフォールバックします。")
            raw_posts_by_account = build_demo_dataset()
    else:
        print("⚠️ X_BEARER_TOKEN が未設定のため、DEMOデータでパイプラインを検証します。")
        print("   （実アカウントへのアクセスは行いません）")
        raw_posts_by_account = build_demo_dataset()

    print()
    print(f"📊 処理対象アカウント数: {len(raw_posts_by_account)}")
    for handle, posts in raw_posts_by_account.items():
        print(f"   @{handle:20s}: {len(posts):2d} 件")
    print()

    engine = KengoodEngineV2()
    result = engine.run(
        canonical_name=TARGET_CANONICAL_NAME,
        target_type="creator",
        company_name=TARGET_COMPANY_NAME,
        raw_posts_by_account=raw_posts_by_account,
    )

    if result["blocked"]:
        print("🚫 Source Policy Gate によりブロックされました:")
        print(json.dumps(result["authorization"], ensure_ascii=False, indent=2))
        sys.exit(1)

    print("=" * 80)
    print("📈 Phase 0〜4 実行結果サマリー")
    print("=" * 80)
    print(f"identity_confidence: {result['identity']['identity_confidence']}")
    print(f"policy_decision    : {result['policy_decision']['decision']}")
    for handle, account_result in result["accounts"].items():
        print(f"\n@{handle}")
        print(f"  post_count : {account_result['post_count']}")
        print(f"  hit_rate   : {account_result['hit_rate']}")
        print(f"  viral_rate : {account_result['viral_rate']}")
        print(f"  engagement_rate p50: {account_result['engagement_rate_percentiles']['p50']}")

    output_path = Path("/tmp") / f"kengood_v2_phase0-4_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print()
    print(f"💾 完全なエビデンストレース付きJSONを保存しました: {output_path}")


if __name__ == "__main__":
    main()
