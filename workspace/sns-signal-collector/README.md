# SNS需要シグナル収集ツール

「SNS需要シグナル分析サービス」の収集・分析エンジン初版。
X API v2 で対象ブランドへの公開言及を集め、土産菓子特化の語彙辞書で文脈分類し、週次レポートを生成する。

> 公開投稿のみを正規APIで取得する（提案書§7との整合）。スクレイピング機能は実装しない方針。

## まず動かしてみる（APIキー不要）

```bash
cd workspace/sns-signal-collector
python3 sample_data/generate_sample.py   # ダミーデータ生成
python3 collect.py --mock                # ダミーデータ取り込み
python3 report.py                        # レポート生成 → output/
```

`output/report_YYYYMMDD.md` に ①週次推移＋急増アラート ②文脈構成比 ③地理分布 が出る。
ダミーデータ使用時はレポート冒頭に注記が自動で付く。

## 実データ収集のセットアップ

1. [X Developer Portal](https://developer.x.com/) でアカウント登録（無料）→ プロジェクト作成
2. プランを選択（従量課金で開始可。新規登録時 $10 クーポンあり。月1万件取得なら Basic $200/月）
3. Keys and tokens → **Bearer Token** を発行
4. `.env.example` を `.env` にコピーし、`X_BEARER_TOKEN=` に貼り付け
5. 収集実行:

```bash
python3 collect.py --brand nycsand --max-pages 1   # まず1ブランド・1ページで試す
python3 collect.py                                  # 全ブランド
python3 report.py                                   # レポート生成
```

- 取得済みIDと since_id を記録するため、再実行しても重複しない
- `--max-pages` はAPI課金の上限ガード。様子を見ながら増やす
- 定期実行する場合は cron 等で1日1回 `collect.py` → 毎週月曜に `report.py`

## ブランド・辞書の育て方

- 監視ブランド・表記ゆれ・除外語: `brands.json`
- 文脈分類の語彙辞書: `classify.py` の `CONTEXT_RULES`（上から優先判定）
- 販売エリア（地理分布の「エリア外」判定）: `brands.json` の `sales_area_prefs`

誤分類を見つけたら辞書に語を足す。この積み重ねが提案書で言う「専用辞書の構築」にあたる。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `collect.py` | X API v2 収集（`--mock` でAPIなし動作） |
| `classify.py` | 文脈分類（需要シグナル判定・都道府県推定） |
| `report.py` | 週次レポート生成（Markdown + CSV） |
| `brands.json` | ブランド定義・表記ゆれ・販売エリア |
| `sample_data/` | 動作確認用ダミーデータ（実在の投稿ではない） |
| `data/` `output/` | 収集データ・レポート（Git管理外） |

## 制約・注意

- recent search は**直近7日分のみ**。収集を止めるとデータに穴があくので定期実行が前提
- レポートをそのまま顧客に出さない。投稿引用は要旨化し、個人特定情報を除去する（提案書§7）
- Instagram・ECレビューは未対応（次フェーズ。Instagram Graph API はハッシュタグ週30個制限あり）
