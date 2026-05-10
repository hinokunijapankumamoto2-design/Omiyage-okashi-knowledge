---
description: 相手に共有できる議事録を生成する
argument-hint: client_id meeting_id
---

参照:
- @CLAUDE.md
- @knowledge/core/evidence_policy.md
- @knowledge/core/meeting_structuring_rules.md
- @knowledge/templates/minutes.template.md

対象 meeting の normalized_transcript.md と value_structure.md を読み、minutes.md を作成する。

必須:
- 社外共有前提
- 社内仮説や温度感を混ぜない
- 決定事項 / 未決事項 / 宿題 / 次回予定 を分ける
- 長すぎず、後で見返して使える形にする
