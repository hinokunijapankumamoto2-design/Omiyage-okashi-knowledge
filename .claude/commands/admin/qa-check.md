---
description: 出力物の品質を監査し、事実と仮説の混線を検査する
argument-hint: client_id meeting_id
---

参照:
- @CLAUDE.md
- @knowledge/core/evidence_policy.md
- @knowledge/core/meeting_structuring_rules.md
- @knowledge/core/go_no_go_conditions.md
- @knowledge/domain/omiyage_value_creation_knowledge.md

対象 meeting の成果物を監査する。

確認:
- 必須セクション欠落はないか
- 事実 / 仮説 / 未確認が混線していないか
- 次の一手があるか
- 進める条件 / 止める条件があるか
- 社外共有ファイルに社内限定情報が混ざっていないか

業界補正:
- omiyage-industry-critic agent の観点で、用途 / 売場 / 配布実務性 / 継続供給性 / 利益性 / 贈答失敗回避 の漏れを点検する

事実監査:
- fact-hypothesis-auditor agent の観点で、数字・固有名詞・商品名・顧客意図の断定を重点監査する

出力:
- QA結果
- 修正ポイント
- 修正優先順位
