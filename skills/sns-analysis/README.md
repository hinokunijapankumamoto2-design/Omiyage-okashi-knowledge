# SNS分析スキル（sns-analysis）

企業・ブランドのSNS影響度を実測データで分析し、ビジネス提案の根拠を自動生成するスキル。

## 📦 ファイル構成

```
skills/sns-analysis/
├── SKILL.md          ← スキル定義（Claude Codeが読み込む）
├── analyzer.py       ← 分析エンジン
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

### データ取得方法

| プラットフォーム | 取得方法 | 必要な認証 |
|-----------------|---------|----------|
| note | 検索 API | なし（公開） |
| YouTube | Data API / yt-dlp | API キー / なし |
| X | Bright Data / 公開情報 | 契約 / なし |
| Instagram | Bright Data / 公開情報 | 契約 / なし |

### フォールバック戦略

各データ取得方法が失敗した場合：
1. **公開 API が失敗** → Web Scraping に切り替え
2. **Web Scraping が失敗** → 手動入力をリクエスト
3. **手動入力も不可** → 「データ不足」として進める

## 🛡️ 倫理・セキュリティ

### 使用可能なデータ

- ✅ 公開情報（SNS フォロワー数、投稿数など）
- ✅ 外部 API（note 検索 API など）
- ✅ 企業公開情報（採用サイト、IR など）

### 使用禁止事項

- ❌ ログイン必須の情報
- ❌ 個人用 SNS の無断分析
- ❌ 非公開 DM など
- ❌ 企業の内部情報

## 📝 カスタマイズ

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

## 🐛 トラブルシューティング

### API が返ってこない

```
→ API キーを確認
→ レート制限を確認
→ フォールバック方式を試す
```

### HTML が文字化け

```
→ ブラウザの文字コードを UTF-8 に設定
→ ファイル自体を確認: head -c 100 *.html
```

### データが少ない

```
→ 公開情報の取得方法を変更
→ 競合企業との比較を追加
→ 手動で補足データを入力
```

## 📚 参考資料

- [note 検索 API ドキュメント](https://note.com/api)
- [YouTube Data API](https://developers.google.com/youtube/v3)
- [Bright Data](https://brightdata.com)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)

## 📞 サポート

- バグ報告・改善提案: GitHub Issues
- 使用例・ベストプラクティス: Discussions

## 📄 ライセンス

本スキルは KENGOODメソッドベースの実装です。
