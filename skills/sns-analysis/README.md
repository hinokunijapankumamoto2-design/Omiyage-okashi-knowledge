# SNS分析スキル（sns-analysis）

企業・ブランドのSNS影響度を実測データで分析し、ビジネス提案の根拠を自動生成するスキル。

## 📦 ファイル構成

```
skills/sns-analysis/
├── SKILL.md          ← スキル定義（Claude Codeが読み込む）
├── analyzer.py       ← 分析エンジン（Gap特定・提案生成）
├── scraper.py        ← ウェブスクレイピング層（API不使用）
├── README.md         ← このファイル
└── examples/
    └── kashosanzen_analysis.json  ← 分析例
```

## 🚀 使い方

### Claude Codeでの実行

```
/sns-analysis
```

対話的に以下を入力：
- 企業名またはブランド名
- 分析対象のSNS（X / Instagram / note / YouTube / all）
- 出力形式（html / json / markdown）
- 競合企業を含めるか（yes / no）

### コマンドラインでの実行（デバッグ用）

```bash
python skills/sns-analysis/analyzer.py
```

## 📊 出力形式

### HTML レポート

```
sns_analysis_[企業名]_[日付].html
```

- ブラウザで開ける
- 印刷可能
- ダークモード対応

### JSON データ

```json
{
  "company": "企業名",
  "analysis_date": "2026-09-06",
  "channels": {
    "x": { "followers": 95816, ... },
    "instagram": { ... },
    "note": { ... },
    "youtube": { ... }
  },
  "flow_vs_stock": { ... },
  "gaps": [ ... ],
  "recommendations": [ ... ]
}
```

## 🔍 分析ロジック

### 1. データ取得

各SNSプラットフォームから以下を取得：
- フォロワー数
- 投稿数
- エンゲージメント
- 第三者言及数
- 公式アカウント有無

### 2. フロー vs ストック診断

| 分類 | プラットフォーム | 特徴 |
|-----|-----------------|------|
| **フロー** | X, Instagram | タイムラインが流れる。即時性が高い |
| **ストック** | note, YouTube | 蓄積される。長期的な資産になる |

バランス診断で「何が足りないか」を明確化します。

### 3. 空白ポジション特定

以下を自動判定：
- **Gap A**: ストックがない（フローで取った表示が蓄積されていない）
- **Gap B**: 自社題材で取れていない（コラボなど他社の力を借りている）
- **Gap C**: セグメント別導線がない（採用・投資家向けなど特定目的）

### 4. 推奨アクション生成

Gap ごとに最適なアクションを Priority 付きで提示。

## 💻 技術詳細

### 🔓 API不使用アーキテクチャ

本スキルは **外部APIに依存しない** ウェブスクレイピングアプローチを採用しています。これにより以下を実現：

- ✅ API キーの管理が不要
- ✅ レート制限の心配がない
- ✅ 公開情報のみを使用（倫理的）
- ✅ 依存性を最小化

### データ取得方法（WebScraperクラス）

| プラットフォーム | 取得方法 | 抽出対象 | 品質 |
|-----------------|---------|---------|------|
| **note** | ウェブスクレイピング | 言及数（検索結果）+ 公式アカウント投稿数 | 高 |
| **YouTube** | ウェブスクレイピング | 登録者数（プロフィール解析） | 高 |
| **X** | 公開情報 | データ取得は限定的（bot対策） | 低 |
| **Instagram** | 公開情報 | データ取得は限定的（API厳格化） | 低 |
| **企業情報** | ウェブスクレイピング | 従業員数、設立年、採用情報 | 中 |

### WebScraperクラス（scraper.py）

```python
from scraper import WebScraper, ScrapedData

# 初期化
scraper = WebScraper("菓匠三全")

# note言及数を取得
note_data = scraper.scrape_note_mentions()
# → ScrapedData(platform="note", posts=123, data_quality="high", ...)

# note公式アカウント投稿数を取得
note_official = scraper.scrape_note_official_account("kashosanzen")
# → ScrapedData(platform="note_official", posts=42, ...)

# YouTubeチャンネル登録者を取得
youtube_data = scraper.scrape_youtube_channel("https://www.youtube.com/@kashosanzen")
# → ScrapedData(platform="youtube", followers=1550, ...)

# 企業公開情報を取得
company_info = scraper.scrape_company_info("https://www.sanzen.co.jp/")
# → {"founded_year": 1979, "employee_count": 500, "has_recruitment_page": True}

# 採用ページ分析
recruitment = scraper.scrape_recruitment_info("https://www.sanzen.co.jp/recruit/")
# → {"active_job_postings": 3, "last_updated": "2026-09-01"}

# すべてのデータソースを取得
sources_json = scraper.get_sources_json()
# → JSON形式でスクレイピング元URL一覧を出力
```

### ScrapedDataクラス

```python
@dataclass
class ScrapedData:
    platform: str                    # "note", "youtube", "x", ...
    followers: Optional[int] = None  # フォロワー数
    posts: Optional[int] = None      # 投稿数
    last_updated: str = ""           # 取得日時
    source_url: str = ""             # スクレイピング元URL
    data_quality: str = "unknown"    # "high" / "medium" / "low"
    notes: str = ""                  # 抽出方法や注記
```

### データ抽出技術

#### 正規表現マッチング

- **note検索**: `data-total-count="(\d+)"` で言及数を抽出
- **YouTube登録者**: `"subscriberCountText":\s*"([^"]*)"` でJSON形式から登録者数を解析
  - 単位変換: "1.5万" → 15000, "42.3万" → 423000, "1M" → 1000000
- **企業情報**: `従業員数[：:\s]*([0-9,]+)` で従業員数を抽出

#### URLパース

```python
search_url = f"https://note.com/search?q={quote(company_name)}&d=1"
account_url = f"https://note.com/{account_handle}"
```

#### User-Agent付きHTTPリクエスト

```python
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ..."
}
```

### エラーハンドリング

各スクレイピングメソッドは以下のエラーに対応：

- **ネットワークエラー**: `urllib.error.URLError` → タイムアウトまたは接続失敗
- **ページ取得失敗**: `404` または `ページが見つかりません` → 公式アカウント未設置
- **抽出失敗**: 正規表現が該当しない → 代替抽出方法をフォールバック、最終的には `data_quality="low"` で報告

### フォールバック戦略

```
1. 第一選択肢: ウェブスクレイピング（note/YouTube/企業サイト）
   ↓ 失敗した場合
2. 代替抽出方法: 異なる正規表現パターンを試す
   ↓ 失敗した場合
3. データ不足として進める: `data_quality="low"` で報告、分析は継続
```

## 🛡️ 倫理・セキュリティ

### ✅ 使用可能なデータ

- ✅ **公開情報のみ**: SNS フォロワー数、投稿数、検索結果
- ✅ **企業公開情報**: 採用サイト、IR ページ、企業サイト
- ✅ **公開API**: note 検索など、ログイン不要なAPI
- ✅ **出典明記**: すべてのデータに取得元URL を記録

### ❌ 使用禁止事項

- ❌ ログイン必須の情報（DM、非公開投稿など）
- ❌ 個人用 SNS アカウントの無断分析
- ❌ 企業の内部情報（従業員限定ページなど）
- ❌ 利用規約違反となるスクレイピング

### 📋 スクレイピングの倫理的実装

```python
# 良い例：User-Agent を明示、遅延を入れる
scraper = WebScraper("企業名")
time.sleep(1)  # サーバー負荷回避
data = scraper.scrape_note_mentions()

# 必ずソース（source_url）を記録・表示
print(f"データソース: {data.source_url}")

# data_quality で信頼度を明記
if data.data_quality == "low":
    print("注：低品質データです。手動確認をお勧めします")
```

### データ品質レベル

| レベル | 定義 | 使用例 |
|--------|------|--------|
| **high** | 公式情報から正確に抽出 | 企業公式 SNS のフォロワー数 |
| **medium** | 複数の方法で検証済み | 代替正規表現で抽出した情報 |
| **low** | 単一手段のみ／未検証 | 手動入力、推測情報 |

## 📝 カスタマイズと拡張

### 業界別テンプレート

テンプレート機能で業界固有の分析を追加可能：

```python
# 菓子業界向けテンプレート
analyzer = SNSAnalyzer("企業名", industry="sweets")

# 金融業界向けテンプレート
analyzer = SNSAnalyzer("企業名", industry="finance")
```

### カスタム指標

独自の指標を追加：

```python
analyzer.add_custom_metric("nps_mentions", 150)
```

### WebScraperの拡張方法

新しいプラットフォームやデータソースを追加する場合：

```python
# scraper.py に新規メソッドを追加
class WebScraper:
    def scrape_tiktok_account(self, handle: str) -> ScrapedData:
        """TikTokアカウント情報を取得"""
        url = f"https://www.tiktok.com/@{handle}"
        html = self._fetch_page(url)
        
        # 正規表現で必要なデータを抽出
        match = re.search(r'"followerCount":(\d+)', html)
        if match:
            followers = int(match.group(1))
            return ScrapedData(
                platform="tiktok",
                followers=followers,
                source_url=url,
                data_quality="high",
                notes=f"TikTokフォロワー: {followers}"
            )
        
        return ScrapedData(
            platform="tiktok",
            data_quality="low",
            notes="TikTokデータ取得失敗"
        )

# analyzer.py で使用
from .scraper import WebScraper
scraper = WebScraper("企業名")
tiktok_data = scraper.scrape_tiktok_account("@business_handle")
analyzer.add_channel_data(tiktok_data)
```

### カスタム抽出パターン

正規表現パターンをカスタマイズして新しい情報を抽出：

```python
# 動画再生数を追加抽出
def scrape_video_views(self, url: str) -> Optional[int]:
    html = self._fetch_page(url)
    # サイトごとの異なるパターンに対応
    patterns = [
        r'"viewCount":"(\d+)"',      # YouTube形式
        r'再生数[：:\s]*([0-9,]+)',  # 日本語ページ形式
        r'views.*?(\d+(?:,\d+)*)',   # 英語ページ形式
    ]
    
    for pattern in patterns:
        match = re.search(pattern, html)
        if match:
            count_str = match.group(1).replace(",", "")
            return int(count_str)
    
    return None
```

## 🐛 トラブルシューティング

### ネットワークエラー: "Tunnel connection failed"

```
症状: ⚠️ ネットワークエラー (url): ...
原因: プロキシまたはファイアウォール制限
対応:
  → 環境のネットワークポリシーを確認
  → VPN が設定されている場合は確認
  → 本番環境で再テスト（クラウド環境では制限がある場合がある）
```

### データが取得できない（data_quality="low"）

```
症状: "言及数を取得できませんでした" / "登録者数を抽出できませんでした"
原因: 
  - ページ構造が変更された
  - 正規表現パターンが非対応
  - ページが存在しない
対応:
  → WebScraper クラスの正規表現パターンを更新
  → scraper.py の _fetch_page() でレスポンスボディを確認
  → 複数の抽出方法をサポート
```

### note の公式アカウントが見つからない

```
症状: ScrapedData(platform="note_official", posts=0, notes="公式アカウント：存在しない")
原因: アカウントハンドルが正しくない、または公式アカウントが存在しない
対応:
  → 企業名で note 検索して実際のアカウント名を確認
  → scraper.scrape_note_official_account("正しいハンドル") を再実行
```

### YouTube チャンネルが解析できない

```
症状: ScrapedData(platform="youtube", data_quality="low", notes="登録者数を抽出できませんでした")
原因:
  - チャンネルURL が正しくない（@handle 形式が必要）
  - チャンネルが存在しない
  - JSON構造が変更された
対応:
  → YouTube チャンネルURLの形式を確認: https://www.youtube.com/@{handle}
  → 複数のURLバリエーションを試す
```

### HTML が文字化け

```
症状: ブラウザで HTML レポートが文字化けしている
原因: UTF-8 以外の文字コードで解釈されている
対応:
  → ブラウザの文字コードを UTF-8 に設定
  → ファイル自体を確認: file -i sns_analysis_*.html
  → HTML の charset メタタグを確認: grep -i charset *.html
```

### 分析結果の信頼性が低い（全データが medium/low）

```
症状: すべてのプラットフォームで data_quality="low"
原因:
  - ネットワークアクセスが制限されている
  - 対象企業が SNS に力を入れていない
  - 公式アカウント名が判明していない
対応:
  → 手動で正確なアカウント情報を入力（SNSハンドル等）
  → scraper.py に入力値として受け付ける機能を追加検討
  → 複数ソースでの情報クロスチェック
```

## 📚 参考資料・関連ツール

### 🌐 ウェブスクレイピング

- [Python urllib](https://docs.python.org/ja/3/library/urllib.html) - 標準ライブラリ（本スキルで使用）
- [正規表現リファレンス](https://docs.python.org/ja/3/library/re.html) - データ抽出に使用
- [Beautiful Soup](https://www.crummy.com/software/BeautifulSoup/) - HTML解析ライブラリ（今後の拡張候補）
- [Selenium](https://www.selenium.dev/) - JavaScript実行が必要な場合

### 📱 SNSプラットフォーム

- [note公開ページ](https://note.com) - 言及数データの取得元
- [YouTube](https://www.youtube.com) - チャンネル情報の取得元
- [X (Twitter)](https://twitter.com) - 公開情報のみ（詳細データ取得は制限あり）
- [Instagram](https://www.instagram.com) - 公開情報のみ（詳細データ取得は制限あり）

### 🔧 本スキルで使用している技術

- **Python 3.x**: プログラム言語
- **urllib**: HTTP通信（API キー不要）
- **正規表現 (re)**: HTML/JSON解析
- **dataclass**: 型安全なデータ構造
- **JSON**: 構造化データ出力
- **HTML/CSS**: レポート生成

## 📞 サポート

- バグ報告・改善提案: GitHub Issues
- 使用例・ベストプラクティス: Discussions

## 📄 ライセンス

本スキルは KENGOODメソッドベースの実装です。
