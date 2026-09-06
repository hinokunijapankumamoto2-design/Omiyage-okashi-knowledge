#!/usr/bin/env python3
"""
いちさん（@ichiaimarketer）の X アカウント分析 - OAuth版
Bearer Token を使用したセキュアな実データ取得
"""

import sys
import os
sys.path.insert(0, '/home/user/Omiyage-okashi-knowledge/skills/sns-analysis')

from analyzer import SNSAnalyzer
from datetime import datetime
import json

print("=" * 80)
print("🎯 いちさん X アカウント分析 - OAuth 実装版")
print("15 個のアカウント × 実績データ分析")
print("=" * 80)
print()

# Bearer Token 確認
bearer_token = os.getenv('X_BEARER_TOKEN')

if not bearer_token:
    print("❌ Bearer Token が設定されていません")
    print()
    print("実行方法:")
    print("  X_BEARER_TOKEN='AAAA...' python3 analyze_ichisan_oauth.py")
    print()
    sys.exit(1)

print(f"✅ Bearer Token を取得しました")
print(f"   先頭: {bearer_token[:20]}...")
print()

# アナライザー初期化
analyzer = SNSAnalyzer("いちさん（株式会社PLai代表、AirCle代表）")

# 分析対象のアカウント（15個）
ichisan_accounts = [
    # グループ A: メインアカウント
    "ichiaimarketer",          # @いちさん - メインアカウント

    # グループ B: Claude Code 特化
    "ClaudeCode_love",         # Claude Code 開発ノウハウ

    # グループ C: AI/キャリア学習
    "AiAircle34052",           # AirCle - 学生向けAI起業コミュニティ

    # グループ D: 開発者向けテーマ
    "Codestudiopjbk",          # Codex Studio - AI コード生成
    "obsidianstudio9",         # Obsidian + Claude AI 知識管理
    "sumika45379",             # Skill Studio - AI スキル認定

    # グループ E: インフラ・ツール
    "opensourcelab9",          # オープンソース研究所 - LLM インフラ
    "AIbusiness9",             # AI ビジネス動向

    # グループ F: その他（拡張予定）
    # 残り 7 アカウントは実装段階で追加予定
]

print(f"📊 分析対象アカウント: {len(ichisan_accounts)}個")
for i, account in enumerate(ichisan_accounts, 1):
    print(f"   {i:2d}. @{account}")
print()

# OAuth で投稿データを取得
print("=" * 80)
print("🔍 X 投稿取得中...")
print("=" * 80)
print()

try:
    posts_data = analyzer.fetch_x_posts_with_oauth(
        handles=ichisan_accounts,
        bearer_token=bearer_token,
        limit=10  # 各アカウントから最新 10 投稿
    )

    print()
    print("=" * 80)
    print("📈 取得結果")
    print("=" * 80)
    print()

    # 統計情報
    successful_accounts = [h for h, p in posts_data.items() if p]
    total_posts = sum(len(p) for p in posts_data.values())

    print(f"✅ 成功したアカウント: {len(successful_accounts)}/{len(ichisan_accounts)}")
    print(f"✅ 取得された総投稿数: {total_posts} 件")
    print()

    # アカウント別の詳細
    if successful_accounts:
        print(f"📊 アカウント別取得数:")
        for account in ichisan_accounts:
            posts = posts_data.get(account, [])
            if posts:
                print(f"   @{account:20s}: {len(posts):2d} 件")
        print()

    # 分析実行
    print("=" * 80)
    print("📊 分析実行中...")
    print("=" * 80)
    print()

    x_analysis = analyzer.analyze_x_posts()

    # コンソール出力
    print(f"📈 全体統計:")
    print(f"   • 分析アカウント数: {x_analysis['accounts_analyzed']}")
    print(f"   • 総投稿数: {x_analysis['total_posts']}")
    if x_analysis['top_performing_posts']:
        max_likes = max(p['likes'] for p in x_analysis['top_performing_posts'])
        print(f"   • 最高いいね数: {max_likes:,}")
        avg_likes = sum(p['likes'] for p in x_analysis['top_performing_posts']) / len(x_analysis['top_performing_posts'])
        print(f"   • 平均いいね数: {avg_likes:,.0f}")
    print()

    # トップ投稿
    print(f"🏆 パフォーマンストップ 10 投稿:")
    top_posts = analyzer.get_top_performing_posts(limit=10)
    for post in top_posts[:10]:
        print(f"   {post['rank']:2d}. {post['author']:20s} {post['likes']:6,}♥ {post['retweets']:5,}🔄")
        print(f"       → {post['text'][:60]}...")
    print()

    # JSON 出力
    print("💾 JSON 出力を生成中...")
    json_output = analyzer.to_json()
    json_filename = f'/tmp/ichisan_oauth_analysis_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'

    with open(json_filename, 'w', encoding='utf-8') as f:
        f.write(json_output)

    print(f"   ✅ 保存: {json_filename}")
    print(f"   ファイルサイズ: {len(json_output):,} bytes")
    print()

    # HTML 出力
    print("📄 HTMLレポート生成中...")
    html_output = analyzer.generate_html_report()

    html_filename = f'/tmp/ichisan_oauth_analysis_{datetime.now().strftime("%Y%m%d_%H%M%S")}.html'

    with open(html_filename, 'w', encoding='utf-8') as f:
        f.write(html_output)

    print(f"   ✅ 保存: {html_filename}")
    print(f"   ファイルサイズ: {len(html_output):,} bytes")
    print()

    print("=" * 80)
    print("✨ 分析完了！")
    print("=" * 80)
    print()
    print(f"📁 出力ファイル:")
    print(f"   JSON: {json_filename}")
    print(f"   HTML: {html_filename}")
    print()

    # サマリー
    print("📋 分析サマリー:")
    print()
    print("🎯 取得戦略分析：")
    print(f"   • 認証方法: X API v2 OAuth Bearer Token")
    print(f"   • データ品質: 高（公式 API 使用）")
    print(f"   • セキュリティ: 安全（アカウント認証なし、トークンベース）")
    print()

    if x_analysis['top_performing_posts']:
        top_post = x_analysis['top_performing_posts'][0]
        print("🏆 最高パフォーマンス投稿：")
        print(f"   • 投稿者: {top_post['author']}")
        print(f"   • いいね: {top_post['likes']:,}")
        print(f"   • リツート: {top_post['retweets']:,}")
        print(f"   • テキスト: {top_post['text'][:50]}...")
        print()

    print("✅ 推奨次施策：")
    print("   1. トップ 3 アカウント分析を詳細化")
    print("   2. 日次自動分析（定期実行）の設定")
    print("   3. エンゲージメント 10K+ 投稿の詳細分析")
    print("   4. クロスプロモーション効果測定")
    print()

except Exception as e:
    print(f"❌ エラーが発生しました: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
