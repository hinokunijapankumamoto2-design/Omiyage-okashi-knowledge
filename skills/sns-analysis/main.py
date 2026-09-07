#!/usr/bin/env python3
"""
KENGOOD SNS Intelligence Engine v2 - CLI

Phase 0〜8を一気通貫で実行するコマンドラインエントリーポイント。
標準ライブラリ（argparse）のみで動作し、追加パッケージは不要。

使用例:
    # 事前取得済みの生データJSONを使う場合（ネットワーク・APIキー不要）
    python3 main.py "いちさん" --input examples/sample_raw_posts.json

    # X API v2 OAuthで実データを取得する場合
    X_BEARER_TOKEN='AAAA...' python3 main.py "いちさん" \
        --handles ichiaimarketer ClaudeCode_love --fetch-live

    # モード指定
    python3 main.py "トヨタ" --input data.json --target-type company --mode fast
    python3 main.py "いちさん" --input data.json --deep
    python3 main.py "いちさん" --input data.json --audit

ANTHROPIC_API_KEY / OPENAI_API_KEY が環境変数に設定されていれば自動的に
実LLMクライアントを各Phaseへ配線する。未設定の場合は各Phaseが
決定論的フォールバックで動作する（analyzer/tests参照）。
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List

SKILL_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SKILL_DIR))

from kengood_engine_v2 import KengoodEngineV2  # noqa: E402
from anthropic_client import try_build_anthropic_client  # noqa: E402
from openai_challenger import build_openai_challenger_fn  # noqa: E402


def _load_raw_posts_from_file(path: str) -> Dict[str, List[Dict]]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _fetch_live(
    handles: List[str], bearer_token: str, limit: int, canonical_name: str
) -> Dict[str, List[Dict]]:
    """Phase 1: 既存の analyzer.py 経由でX API v2 OAuthから実データを取得する"""
    from analyzer import SNSAnalyzer

    analyzer = SNSAnalyzer(canonical_name)
    posts_data = analyzer.fetch_x_posts_with_oauth(
        handles=handles, bearer_token=bearer_token, limit=limit
    )
    return {
        handle: [p.to_dict() for p in posts]
        for handle, posts in posts_data.items()
        if posts
    }


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="KENGOOD SNS Intelligence Engine v2 - Phase 0〜8 CLI",
    )
    parser.add_argument("canonical_name", help="分析対象の正式名称（例: いちさん、トヨタ）")
    parser.add_argument(
        "--target-type", default="creator",
        help="company/brand/product/account/creator/service/campaign等（既定: creator）",
    )
    parser.add_argument("--company", default=None, help="所属企業名（分かる場合）")
    parser.add_argument(
        "--handles", nargs="*", default=[],
        help="Xハンドル一覧（--fetch-live使用時に指定）",
    )
    parser.add_argument(
        "--input", default=None,
        help="raw_posts_by_account形式のJSONファイル（--fetch-liveの代わりに使用）",
    )
    parser.add_argument(
        "--fetch-live", action="store_true",
        help="X_BEARER_TOKEN環境変数を使い、X API v2 OAuthで実データを取得する",
    )
    parser.add_argument("--limit", type=int, default=10, help="1アカウントあたりの取得投稿数（既定: 10）")

    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument(
        "--mode", choices=["fast", "standard", "deep", "audit"], default=None,
        help="実行モード（省略時はmodel-routing.yamlのdefault_mode）",
    )
    mode_group.add_argument("--deep", action="store_true", help="DEEPモードで実行")
    mode_group.add_argument("--audit", action="store_true", help="AUDITモードで実行")

    parser.add_argument("--output", default=None, help="結果JSONの保存先（省略時は/tmp配下に自動生成）")
    parser.add_argument(
        "--no-llm", action="store_true",
        help="ANTHROPIC_API_KEY/OPENAI_API_KEYが設定されていても実クライアントを使わず、"
             "全Phaseをフォールバックのみで実行する",
    )
    return parser


def main(argv=None) -> int:
    args = build_arg_parser().parse_args(argv)

    # ---------- Phase 1: データ取得（実データ or 事前取得済みJSON） ----------
    if args.input:
        raw_posts_by_account = _load_raw_posts_from_file(args.input)
    elif args.fetch_live:
        bearer_token = os.getenv("X_BEARER_TOKEN")
        if not bearer_token:
            print("❌ --fetch-live には環境変数 X_BEARER_TOKEN が必要です", file=sys.stderr)
            return 1
        if not args.handles:
            print("❌ --fetch-live には --handles の指定が必要です", file=sys.stderr)
            return 1
        raw_posts_by_account = _fetch_live(
            args.handles, bearer_token, args.limit, args.canonical_name
        )
    else:
        print("❌ --input か --fetch-live のいずれかを指定してください", file=sys.stderr)
        return 1

    if not raw_posts_by_account:
        print("⚠️ 取得できた投稿データがありません。処理を中断します。", file=sys.stderr)
        return 1

    # ---------- LLMクライアントの自動検出・配線 ----------
    classifier_client = analyst_client = strategist_client = None
    challenger_fn = None

    if not args.no_llm:
        anthropic_client = try_build_anthropic_client()
        if anthropic_client is not None:
            classifier_client = analyst_client = strategist_client = anthropic_client
            print("✅ ANTHROPIC_API_KEYを検出。Haiku/Sonnet/Opusで実LLM分析を行います。")
        else:
            print("⚠️ ANTHROPIC_API_KEY未検出（またはanthropic未インストール）。"
                  "Phase 5A/5B/6/7/8はフォールバック動作します。")

        if os.getenv("OPENAI_API_KEY"):
            challenger_fn = build_openai_challenger_fn()
            print(f"✅ OPENAI_API_KEYを検出。Phase 8 AUDITで"
                  f"{os.getenv('OPENAI_CHALLENGER_MODEL', 'gpt-5.4-mini')}を使用します。")
        else:
            print("⚠️ OPENAI_API_KEY未検出。Phase 8 AUDITはフォールバック動作します。")
    else:
        print("ℹ️  --no-llm指定のため、全Phaseをフォールバックのみで実行します。")

    # ---------- Phase 0〜8 実行 ----------
    engine = KengoodEngineV2(
        classifier_client=classifier_client,
        analyst_client=analyst_client,
        strategist_client=strategist_client,
        challenger_fn=challenger_fn,
    )

    result = engine.run_full_pipeline(
        canonical_name=args.canonical_name,
        target_type=args.target_type,
        company_name=args.company,
        raw_posts_by_account=raw_posts_by_account,
        mode=args.mode,
        deep=args.deep,
        audit=args.audit,
    )

    # ---------- 出力 ----------
    output_json = json.dumps(result, ensure_ascii=False, indent=2)

    if args.output:
        output_path = Path(args.output)
    else:
        output_path = Path("/tmp") / f"kengood_v2_cli_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(output_json, encoding="utf-8")

    print()
    print(f"mode           : {result.get('mode')}")
    print(f"blocked        : {result.get('blocked')}")
    print(f"accounts       : {len(result.get('accounts', {}))}")
    if not result.get("blocked"):
        print(f"phase5b insights: {len(result.get('phase5b', {}).get('insights', []))}")
        print(f"phase7 strategies: {len(result.get('phase7', {}).get('strategies', []))}")
        print(f"phase8 audit_triggered: {result.get('phase8', {}).get('audit_triggered')}")
    print(f"\n💾 結果を保存しました: {output_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
