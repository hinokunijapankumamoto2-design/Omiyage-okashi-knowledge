# Harness

このディレクトリは、録音後の自動処理を司る。

## 役割
- 録音ファイル検知
- 文字起こし実行
- Claude Code command 実行
- 顧客メモリ更新
- 議事録 / 次回商談計画 / フォローアップ草案生成
- QA監査

## 方針
- 録音機そのものはこのプロジェクトの外に置く
- raw / normalized / structured を混ぜない
- 先に手動運用で基準を固めてから自動化する

## 想定パイプライン
1. raw audio を保存
2. speech-to-text で raw_transcript.md を作成
3. Claude Code で normalize → structure → memory update → minutes → next deal → followup を実行
4. QA チェックを通過したら CRM / Drive / Mail と連携
