# ローカル環境セットアップガイド
## X SNS 分析スキル - Opus/GPT-5.6 実験版

---

## 📦 必要なファイル

```
scraper.py       ← ダウンロード済み
analyzer.py      ← ダウンロード済み
```

---

## 🔧 ステップ 1: ローカルディレクトリ構成

```bash
your_project/
├── scraper.py
├── analyzer.py
├── .env                    # ← 新規作成（Token）
├── requirements.txt        # ← 新規作成
└── analyze_ichisan.py      # ← 新規作成（テストスクリプト）
```

---

## 📥 ステップ 2: 依存パッケージをインストール

```bash
# Python 3.8+ 推奨

# 方法 A: requirements.txt を作成
cat > requirements.txt << 'EOF'
tweepy>=4.12.0
playwright>=1.40.0
EOF

pip install -r requirements.txt

# 方法 B: 直接インストール
pip install tweepy playwright
```

---

## 🔐 ステップ 3: Bearer Token を .env に設定

```bash
cat > .env << 'EOF'
export X_BEARER_TOKEN='AAAA...'
EOF

# 実行時に読み込み
source .env
```

---

## 📝 ステップ 4: テストスクリプト作成

`analyze_ichisan.py` を作成：

```python
#!/usr/bin/env python3
import sys
import os

# 環境変数から Bearer Token を取得
bearer_token = os.getenv('X_BEARER_TOKEN')

if not bearer_token:
    print("❌ Bearer Token が設定されていません")
    print("   → .env ファイルを確認してください")
    sys.exit(1)

# scraper/analyzer インポート
from scraper import WebScraper, PostMetrics
from analyzer import SNSAnalyzer
from datetime import datetime

print("=" * 70)
print("🎯 いちさん X アカウント分析")
print("=" * 70)
print()

# アナライザー初期化
analyzer = SNSAnalyzer("いちさん（株式会社PLai代表、AirCle代表）")

# 対象アカウント
accounts = [
    "ichiaimarketer",
    "ClaudeCode_love",
    "AiAircle34052",
    "Codestudiopjbk",
    "obsidianstudio9",
    "sumika45379",
    "opensourcelab9",
    "AIbusiness9"
]

# OAuth で取得
print(f"🔍 {len(accounts)}個のアカウントから投稿を取得中...")
print()

posts_data = analyzer.fetch_x_posts_with_oauth(
    handles=accounts,
    bearer_token=bearer_token,
    limit=10
)

# 分析実行
print("📊 分析中...")
x_analysis = analyzer.analyze_x_posts()

# 結果表示
print()
print("=" * 70)
print("📈 分析結果")
print("=" * 70)
print()

print(f"✅ 分析アカウント: {x_analysis['accounts_analyzed']}")
print(f"✅ 総投稿数: {x_analysis['total_posts']}")

if x_analysis['top_performing_posts']:
    max_likes = max(p['likes'] for p in x_analysis['top_performing_posts'])
    print(f"✅ 最高いいね数: {max_likes:,}")

print()
print("🏆 TOP 5 投稿:")
top_posts = analyzer.get_top_performing_posts(limit=5)
for post in top_posts[:5]:
    print(f"   {post['rank']:2d}. {post['author']:20s} {post['likes']:,}♥")
    print(f"       {post['text'][:60]}...")
print()

# JSON 出力
print("💾 JSON 出力中...")
json_output = analyzer.to_json()
json_file = f'ichisan_analysis_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'

with open(json_file, 'w', encoding='utf-8') as f:
    f.write(json_output)

print(f"   ✅ 保存: {json_file}")
print()

# HTML 出力
print("📄 HTMLレポート生成中...")
html_output = analyzer.generate_html_report()
html_file = f'ichisan_analysis_{datetime.now().strftime("%Y%m%d_%H%M%S")}.html'

with open(html_file, 'w', encoding='utf-8') as f:
    f.write(html_output)

print(f"   ✅ 保存: {html_file}")
print()

print("=" * 70)
print("✨ 完了！")
print("=" * 70)
```

---

## 🚀 ステップ 5: ローカルで実行

```bash
# 環境変数を読み込んで実行
source .env
python3 analyze_ichisan.py
```

---

## 🔄 次のステップ: Opus/GPT-5.6 統合

analyzer.py の分析部分を Opus/GPT-5.6 に置き換え：

```python
# analyzer.py 内の分析メソッドを以下のように変更

def generate_advanced_analysis_with_opus(self, posts_data):
    """Opus モデルを使用した高度な分析"""
    from anthropic import Anthropic
    
    client = Anthropic()
    
    # 投稿データを集約
    summary = {
        "total_posts": len(posts_data),
        "accounts": list(posts_data.keys()),
        "top_posts": [...],
        # ...
    }
    
    # Opus に分析させる
    response = client.messages.create(
        model="claude-opus-5",
        messages=[{
            "role": "user",
            "content": f"""
このXアカウント分析データを高度に分析してください:
{json.dumps(summary, indent=2)}

以下をご報告ください:
1. 主要な成功パターン
2. コンテンツテーマの分析
3. エンゲージメント最適化への提案
4. 競合比較分析
5. リスク要因
            """
        }]
    )
    
    return response.content[0].text
```

---

## 📊 ファイル構成

```
scraper.py
├─ WebScraper クラス
│  ├─ scrape_x_posts_oauth()      # Bearer Token を使用した投稿取得
│  └─ scrape_multiple_x_accounts_oauth()  # 複数アカウント対応
└─ PostMetrics (dataclass)        # 投稿メトリクス構造化

analyzer.py
├─ SNSAnalyzer クラス
│  ├─ fetch_x_posts_with_oauth()  # OAuth 統合
│  ├─ analyze_x_posts()           # 基本分析（Haiku対応）
│  ├─ get_top_performing_posts()  # トップ投稿抽出
│  └─ generate_html_report()      # レポート生成
└─ ChannelData (dataclass)        # チャンネルデータ構造化
```

---

## ✅ トラブルシューティング

### **エラー: Bearer Token が無効**
```bash
# Token を再確認
# Developer Portal → Keys and tokens → Bearer Token
```

### **エラー: tweepy モジュールが見つからない**
```bash
pip install tweepy --upgrade
```

### **エラー: ImportError**
```bash
# scraper.py と analyzer.py が同じディレクトリにあることを確認
# または sys.path に追加
sys.path.insert(0, '/path/to/your/project')
```

---

## 🎯 ローカル実験の流れ

```
1. ✅ scraper.py + analyzer.py をダウンロード
   ↓
2. ✅ .env に Bearer Token を設定
   ↓
3. ✅ requirements.txt をインストール
   ↓
4. ✅ analyze_ichisan.py でテスト実行
   ↓
5. 🧪 analyzer.py を Opus に置き換え
   ↓
6. 📊 結果を比較（Haiku vs Opus）
   ↓
7. 🚀 GPT-5.6 版を試す（オプション）
```

---

## 📞 サポート

質問や問題があれば、以下を報告してください：
- エラーメッセージ
- 実行したコマンド
- Python バージョン

---

**ローカル環境でのカスタマイズを楽しんでください！** 🚀
