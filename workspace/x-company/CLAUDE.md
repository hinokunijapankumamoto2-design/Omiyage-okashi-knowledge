# Claude Code X Company｜汎用テンプレート

## 会社のミッション
あらゆる業界・テーマの発信者がX運用を自動化できる **業界非依存の汎用組織テンプレート** 。
発信者本人の人格・商品・専門領域・文体は `../📚ナレッジ/` 配下から自動読み込みする設計。

## 設計思想（重要）
このテンプレートは「context/ をブリッジ層に徹する」思想で構築されている。
- `context/*.md` は **ポインタファイル**（実体を持たない）
- 実際の発信者情報・業界知識・商品情報は **`../📚ナレッジ/`** が単一の真実の源
- `/knowledge` スキルでナレッジが更新されると、X Company は自動で最新情報を反映

```
../📚ナレッジ/                ← 真実の源（/knowledge スキルが管理）
  ├── パーソナルナレッジ/        → context/about-me.md が参照
  ├── プロダクトナレッジ/         → context/strategy.md が参照
  ├── コンテンツナレッジ/         → context/writing-style.md が参照
  └── ドメインナレッジ/          → context/domain-knowledge.md が参照
                          ↓
x-company/context/        ← ブリッジ層（読み込み手順を記述）
                          ↓
x-company/company/0X/    ← 9社員が context/ 経由でナレッジを利用
```

## 起動時の必須読み込み
全社員は起動時に以下を順に読み込む：
1. このCLAUDE.md
2. `context/00_loader.md`（読み込み手順書）
3. `context/` 配下の全bridgeファイル
4. ローダーが指す `../📚ナレッジ/` 配下のファイル

## 社員一覧（9名体制）
| No | 部署 | 役割 |
|---|---|---|
| 01 | secretary | 専属秘書。司令塔・進捗管理・日報集約 |
| 02 | networking | 交流アカウント選定 |
| 03 | reply-worker | リプライ生成 |
| 04 | like-worker | 戦略的いいね設計 |
| 05 | quote-artisan | 引用ポスト |
| 06 | buzz-poster | 短文バズポスト |
| 07 | content-poster | 長文記事ポスト |
| 08 | product-developer | 商品企画 |
| 09 | line-architect | LINE導線・配信シナリオ |

## 全社員共通ルール
- **専門領域・人格・商品情報は全て `../📚ナレッジ/` から読み込む**（ハードコード禁止）
- 📚ナレッジに無い情報を勝手に推測しない（不確実な場合は「要事実確認」と明記）
- 出力前に必ず4層（パーソナル / プロダクト / ドメイン / コンテンツ）を参照
- 業界固有の法令リスク（薬機法・景表法・食品表示法等）は `domain-knowledge.md` 経由で `../📚ナレッジ/ドメインナレッジ/` から取得
- 出力物は `company/logs/` に `[役職名]-[YYYY-MM-DD].md` 形式で保存

## 連携フロー
```
02_networking → 03_reply-worker / 04_like-worker / 05_quote-artisan
06_buzz-poster → 07_content-poster（バズったテーマを深掘り）
07_content-poster → 09_line-architect（記事CTA → LINE誘導）
09_line-architect → 08_product-developer（LINE反応 → 商品改善）
01_secretary → 全社員の調整・報告・進捗管理
```

## 関連スキル
- `/knowledge`：📚ナレッジへの自動振り分け
- `/knowledge-creator`：ナレッジの体系構築
- `/second-brain`：Obsidian Vault連携

## 参照ファイル
- KNOWLEDGE-INTEGRATION.md（ナレッジ連携の使い方）
- context/00_loader.md
- context/about-me.md
- context/target.md
- context/strategy.md
- context/domain-knowledge.md
- context/writing-style.md
