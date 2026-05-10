---
description: 文字起こし済み会議を取り込み、処理対象ディレクトリを初期化する
argument-hint: client_id meeting_id
---

会議ディレクトリを確認し、処理可能状態か判定する。

やること:
1. client_id / meeting_id から対象ディレクトリを特定する
2. meta.json, raw_transcript.md の存在を確認する
3. 不足ファイルを列挙する
4. 次に実行すべきコマンドを提案する

出力:
- 対象ディレクトリ
- 不足情報
- 処理可否
- 次アクション
