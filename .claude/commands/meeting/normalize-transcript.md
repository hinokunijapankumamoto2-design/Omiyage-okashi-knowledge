---
description: 生文字起こしを正規化し、分析可能な transcript を作る
argument-hint: client_id meeting_id
---

対象 meeting の raw_transcript.md を読み、normalized_transcript.md を作成する。

参照:
- @knowledge/core/evidence_policy.md
- @knowledge/core/meeting_structuring_rules.md

守ること:
- 推測補完をしない
- 聞き取れない箇所は [未確認] とする
- 話者ラベルを揃える
- 数字、固有名詞、会社名、商品名を優先確認する

出力ファイル:
- normalized_transcript.md
