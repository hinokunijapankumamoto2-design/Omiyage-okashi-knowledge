# Omiyage Meeting Intelligence

打合せを録音し、文字起こしし、価値創造ナレッジに変換し、次回商談の勝ち筋まで出すための Claude Code プロジェクト雛形。

## 中核思想
- 価値創造ナレッジは思想OS
- 会議の記録を、受注資産へ変換する
- transcript / 顧客メモリ / 議事録 / 次回商談計画を分離する

## 構成
- `CLAUDE.md`: 最上位ルール
- `.claude/commands`: 実行入口
- `.claude/agents`: 専門処理
- `knowledge/`: 思想OSとテンプレ
- `data/`: 顧客ごとの長期メモリと会議履歴
- `harness/`: 自動化パイプライン設定

## 最小運用フロー
1. 録音ファイルを保存
2. 文字起こしを作成
3. `/meeting/normalize-transcript`
4. `/meeting/structure-value`
5. `/meeting/update-client-memory`
6. `/meeting/generate-minutes`
7. `/meeting/next-deal-plan`
8. `/meeting/followup-draft`
9. `/admin/qa-check`

## 先にやるべきこと
- `data/clients/<client_id>/profile.md` を作る
- `meta.json` と `raw_transcript.md` を会議単位で置く
- 自動化前に数件を手動運用して基準を固める
