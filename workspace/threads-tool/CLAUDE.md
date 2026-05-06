# スイーツ王子 Threads投稿AI

## 概要

スイーツ王子（@sweetsouji.0384）専用の Threads 自動投稿ツール。
楽天で買える手土産・お取り寄せスイーツを、贈って外さない基準で本音採点する**判断代行メディア**として運用する。

人格は紹介者ではなく、**比較編集者**。
売るのは商品ではなく、「迷いを減らすこと／失敗を回避すること／相手に合わせて選べる自信」。

---

## ディレクトリ構成

```
threads-tool/
├── auto_post.py           ← メインスクリプト（モード切替式）
├── threads_api.py         ← Threads API投稿エンジン
├── rakuten_ranking.py     ← 楽天ランキング取得モジュール
├── persona.md             ← スイーツ王子の人格定義（実装用凝縮版）
├── current_mode.txt       ← 直近実行モード記録（自動生成）
├── modes/                 ← 投稿モード定義
│   ├── README.md
│   ├── rakuten_daily.md   ← 楽天TOP5本音採点
│   ├── gift_advisor.md    ← 用途別ギフト比較
│   ├── sns_research.md    ← SNS競合・空白ポジション調査
│   └── _template.md       ← 新モード作成テンプレ
├── .env                   ← 認証情報（Git管理外）
├── .env.example           ← 設定テンプレート
└── post_history.jsonl     ← 投稿ログ（自動生成）
```

---

## 認証情報（`.env`）

```
THREADS_USER_ID=数字ID
THREADS_ACCESS_TOKEN=THAAで始まるトークン
RAKUTEN_APP_ID=楽天アプリケーションID（UUID）
RAKUTEN_ACCESS_KEY=pk_で始まるアクセスキー
RAKUTEN_ORIGIN=アプリ登録時のサイトURL
```

---

## 主要コマンド

### モード一覧表示
```bash
python threads-tool/auto_post.py --list-modes
```

### モード指定実行
```bash
# 楽天TOP5を解読して投稿（自動）
python threads-tool/auto_post.py --mode rakuten_daily

# 用途別ギフト提案のプロンプトを表示（手動投稿用）
python threads-tool/auto_post.py --mode gift_advisor

# SNS競合調査のプロンプトを表示
python threads-tool/auto_post.py --mode sns_research
```

### モード対話選択（引数なし）
```bash
python threads-tool/auto_post.py
```

### オプション
| オプション | 用途 |
|----------|------|
| `--mode <id>` | モード指定（rakuten_daily / gift_advisor / sns_research） |
| `--list-modes` | 利用可能モード一覧を表示 |
| `--yes` | 確認プロンプトをスキップ（rakuten_daily のみ有効） |
| `--hits N` | 取得件数（rakuten_daily用、デフォルト5） |
| `--interval N` | 投稿間隔秒（デフォルト60） |
| `--setup` | 認証情報を再設定 |

---

## 単発投稿（手動テキスト）

`gift_advisor` モードや手書き投稿で確定したテキストは、`threads_api.py` で個別投稿。

```bash
python threads-tool/threads_api.py post "投稿テキスト"
python threads-tool/threads_api.py post "テキスト" "https://image.url/img.jpg"
```

### Threads API コマンド一覧

| コマンド | 説明 |
|---------|------|
| `post "テキスト" ["画像URL"]` | テキスト or 画像付き投稿 |
| `profile` | プロフィール表示 |
| `recent [件数]` | 最近の投稿一覧 |
| `insights <投稿ID>` | インサイト取得 |
| `token-info` | トークン有効期限確認 |

---

## 楽天ランキングAPI仕様

- 新エンドポイント: `https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601`
- 認証: `applicationId`（UUID）+ `accessKey`（pk_*）+ `Origin`ヘッダー
- スイーツジャンルID: `551167`
- 取得上限: 30件/リクエスト
- レスポンス: 商品名・価格・画像URL・レビュー件数・評価・店舗名

### Origin ヘッダー注意点

新APIは `Origin` ヘッダーが楽天アプリ登録時の「サイトURL」と一致しないと403を返す。
未設定／不明な場合は `https://webservice.rakuten.co.jp/app/list` でアプリ詳細を確認。

---

## 人格・評価軸（重要）

### 一文定義
**楽天で買える手土産・お取り寄せスイーツを、贈って外さない基準で本音採点するスイーツ王子**

### 評価8指標（全モード共通）
1. 味
2. 価格妥当性
3. 特別感
4. 個包装
5. 日持ち
6. 常温可否
7. 渡しやすさ
8. 楽天で買う合理性

詳細は `persona.md` を参照。詳細版は `📚ナレッジ/パーソナルナレッジ/パーソナル_スイーツ王子_ナレッジ.md`。

---

## NGルール（人格レベル）

- 個人実名（秋坂洋三郎など）／所属組織（お土産お菓子研究所、GINZA、KENGOOD など）は出さない
- 「神」「優勝」「やばい」「秒で買うべき」「絶対買って」「沼る」は使わない
- 実食していない商品を断定レビューしない
- 必ず「向く人」と「向かない人」を分ける
- PR・提供品は必ず明示する
- フォロワー数・実食件数の自慢はしない

---

## 上位ナレッジ参照

各モード実行時、AIは以下のナレッジを参照する。

| ナレッジ | 役割 |
|---------|------|
| `📚ナレッジ/パーソナルナレッジ/パーソナル_スイーツ王子_ナレッジ.md` | 人格・哲学・評価軸の決定版 |
| `📚ナレッジ/コンテンツナレッジ/コンテンツ_スイーツ王子_Threads投稿テンプレート.md` | 強い口語・数字・保存導線・50本テンプレ |
| `📚ナレッジ/競合リサーチ/競合分析_Threadsスイーツ_2026-05.md` | 市場構造・空白ポジション・実行戦略 |
| `📚ナレッジ/コンテンツナレッジ/コンテンツ_Threads専用ファイルナレッジ.md` | Threadsの会話型運用原則 |

---

## 🛡 公開前の事実確認（必須）

すべての投稿は、生成後・公開前に **`fact_check.md` の監査プロトコル** を必ず実行する。

```
[投稿生成] → [fact_check.md による事実確認] → [判定] → [公開]
```

判定結果：
- 「修正必須」→ **投稿しない**
- 「軽微修正後」→ 修正版を提示・再確認
- 「公開可」→ `threads_api.py post` で公開

事実根拠は外部公式情報のみ（スイーツ王子ナレッジは語り口にのみ使用）。

---

## 投稿前チェックリスト（毎回確認）

- [ ] 誰向きか明確か
- [ ] 逆に誰に向かないかが書いてあるか
- [ ] 味以外の判断材料が入っているか
- [ ] 用途が固定されているか
- [ ] 楽天で買う意味があるか
- [ ] 保存したくなる情報密度か
- [ ] 雰囲気ではなく基準になっているか
- [ ] 実績を盛っていないか
- [ ] PR・提供・アフィリを曖昧にしていないか
- [ ] 「紹介」ではなく「判断代行」になっているか

---

## 新モード追加手順

1. `modes/_template.md` をコピーして `modes/<mode_id>.md` にリネーム
2. フロントマター（`mode_id`, `name`, `data_source`, `post_count` 等）を埋める
3. 役割定義・分析手順・投稿フォーマット・NGルールを書く
4. `modes/README.md` の表に1行追加
5. このファイル（CLAUDE.md）の「主要コマンド」にも追加
