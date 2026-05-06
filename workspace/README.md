# Claude Code Workspace

秋坂洋三郎（お土産お菓子研究所-GINZA-代表）の Claude Code 作業フォルダ全体。
スイーツ王子 Threads 自動投稿、AIマーケ会社運営、ブランド開発、ナレッジ統合の母艦リポジトリ。

---

## 📂 ディレクトリ構成

| ディレクトリ | 用途 |
|---|---|
| `threads-tool/` | スイーツ王子（@sweetsouji.0384）Threads 自動投稿ツール |
| `📚ナレッジ/` | パーソナル / プロダクト / コンテンツ / 競合 / ドメイン ナレッジ統合 |
| `mic-brain-center/` | お土産お菓子研究所-GINZA- ブランド開発・商品企画 AI組織 |
| `ai-marketing-company/` | AI導入支援事業向けマーケティング AI組織 |
| `x-company/` | X（旧Twitter）運用 AI組織（汎用） |
| `x-sweets-company/` | X運用 AI組織（スイーツ特化） |

---

## 🍰 threads-tool（メイン稼働中）

スイーツ王子人格で楽天お取り寄せ・東京駅手土産を**判断代行メディア**として運用するCLI。

### 主要コマンド

```bash
# 楽天TOP5の本音採点を投稿
python threads-tool/auto_post.py --mode rakuten_daily

# 用途別ギフト提案プロンプト生成
python threads-tool/auto_post.py --mode gift_advisor

# SNS競合・空白ポジション調査
python threads-tool/auto_post.py --mode sns_research

# 単発投稿（テキスト＋画像URL）
python threads-tool/threads_api.py post "投稿テキスト" "https://画像URL"

# 投稿前URL検証（200 OK確認）
python threads-tool/url_verify.py "https://example.com/..."

# 投稿サムネ3バリエーション同時生成
python threads-tool/creative_thumb_generator.py
```

### 必須環境変数（`threads-tool/.env`）

```
THREADS_USER_ID=数字ID
THREADS_ACCESS_TOKEN=THAA...
RAKUTEN_APP_ID=UUID
RAKUTEN_ACCESS_KEY=pk_...
RAKUTEN_ORIGIN=登録サイトURL
OPENAI_API_KEY=sk-...   # 画像生成（gpt-image-1）用
```

詳細は `threads-tool/CLAUDE.md` を参照。

---

## 📚 ナレッジ構造（5区分）

| 区分 | 役割 |
|---|---|
| **パーソナルナレッジ** | 秋坂洋三郎本人 / スイーツ王子 の人格・哲学・評価軸 |
| **プロダクトナレッジ** | AI導入支援事業の商材・LP・ファネル・採用判断基準 |
| **コンテンツナレッジ** | Threads/X 投稿テンプレ・デザイン規定・文体パターン |
| **ドメインナレッジ** | お土産お菓子業界構造・評価軸・商業施設知識 |
| **競合リサーチ** | 市場分析・空白ポジション・ベンチマーク |

中核ファイル: `📚ナレッジ/ナレッジ索引.md`

---

## 🛡 投稿前ガバナンス（厳守）

すべての公開投稿は**必ず**以下のフローを通すこと：

```
[投稿生成]
   ↓
[fact_check.md による事実確認監査]
   ↓
[url_verify.py で全URL 200 OK 検証]
   ↓
[判定: 公開可 / 軽微修正 / 修正必須]
   ↓
[公開可のときのみ threads_api.py post]
```

過去事故（壊れたURL投稿によりファン信頼毀損）を二度と起こさないため、`threads-tool/fact_check.md` のURL検証プロトコルを遵守する。

---

## 🚫 commit禁止物（`.gitignore` 済）

- `.env`（APIキー・トークン）
- `post_history.jsonl`（投稿ログ）
- `.last_image_url.txt`（catbox一時URL）
- `__pycache__/`、`*.pyc`
- `.claude/`（Claude Codeセッション）
- 各種一時・バックアップファイル

---

## 🔄 運用ルール

### ローカル → GitHub
```bash
git add .
git commit -m "変更内容"
git push
```

### GitHub → ローカル
```bash
git pull
```

### Web版Claude Code併用時の注意
- Web版（claude.com/code）には `.env` が無いため API 利用処理は動かない
- コード編集・ナレッジ閲覧・テキスト生成のみWeb可
- 競合回避のため **Web編集後はOneDrive同期完了を待ってから `git pull`**

---

## 📌 重要原則

1. **判断代行メディア**としての運用（紹介ではない）
2. **事実確認は外部一次ソースのみ**（ナレッジは語り口にのみ使用）
3. **URLは投稿前に必ず200 OK確認**
4. **投稿に必ずスイーツ王子を登場させる**（画像生成時）
5. **KEY POINTS 3つは投稿の事実から抽出**（抽象的アドバイスNG）

---

## 🔗 関連リンク

- Threadsアカウント: [@sweetsouji.0384](https://www.threads.net/@sweetsouji.0384)
- 運営: お土産お菓子研究所 -GINZA-

---

**Last updated**: 2026-05-05
