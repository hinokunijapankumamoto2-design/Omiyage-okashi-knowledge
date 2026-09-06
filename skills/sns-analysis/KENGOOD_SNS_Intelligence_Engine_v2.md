# KENGOOD SNS Intelligence Engine v2
## Model Routing & Phase Instructions v1.0

---

## 0. 基本方針

本Engineでは、最も高性能なモデルを常時使用しない。

目的は、
**精度 × コスト × 再現性 × 処理速度**
を最大化することである。

基本構成は以下とする。

```text
Tier 0
Python / deterministic processing

Tier 1
Haiku 4.5
= 大量・高速・一次分析

Tier 2
Sonnet 5
= 標準深層分析

Tier 3
Opus 5
= 高難度戦略分析

Final Challenger
GPT-5.6 Sol
= 反証・監査・最終品質保証
```

### 重要原則

```text
Haikuに大量処理を任せる
Sonnetに意味を理解させる
Opusに難しい意思決定を任せる
GPT-5.6 Solに疑わせる
Pythonに計算させる
```

---

## 1. モデル使用禁止原則

以下はLLMに行わせない：

```text
数値変換
平均
中央値
Percentile
Engagement Rate
Velocity
Opportunity Score計算
重複判定
Cache判定
Schema Validation
文字数カウント
日付計算
```

これらは必ずPythonで処理する。

LLMは、以下に限定する：

```text
分類
意味理解
パターン認識
比較
仮説生成
反証
戦略判断
```

---

## 2. 共通LLM指示

Haiku / Sonnet / Opus / GPT-5.6 Solのすべてに以下を適用する。

### COMMON SYSTEM RULE

```
あなたはKENGOOD SNS Intelligence Engineの分析エージェントです。

与えられたEvidenceだけを根拠として分析してください。

必ず以下を区別してください。

FACT
= データまたはEvidenceから直接確認できること

INFERENCE
= 複数FACTから合理的に導けること

HYPOTHESIS
= 検証が必要な仮説

UNKNOWN
= 現在のEvidenceでは判断できないこと

禁止事項：

1. 存在しない数字を補完しない
2. 未取得データを0として扱わない
3. 相関を因果として断定しない
4. フォロワー規模の差を無視しない
5. バズ投稿だけを見て結論を出さない
6. Evidence IDのない重要主張を作らない
7. UNKNOWNを無理に推測しない
8. 前提に疑問がある場合はconfidenceを下げる
9. 数値計算を独自に再計算しない
10. 出力Schemaを変更しない

重要な結論には必ず以下を付与してください。

claim_type
evidence_ids
confidence
counter_evidence
limitations
```

---

## 3. Phase 0｜Target Resolver

### 使用モデル

```text
Default:
Haiku 4.5

Escalation:
Sonnet 5
```

### Haikuの仕事

```text
入力企業・ブランド・商品・SNSアカウントが
「何者か」を整理する。
```

対象：

```text
company
brand
product
account
creator
service
campaign
industry
competitor_set
```

### Haiku指示文

```
ROLE:
Target Identity Resolver

TASK:
ユーザー入力を解析し、
SNS Intelligence分析対象のIdentity候補を構造化してください。

判断対象：

- canonical_name
- target_type
- company_name
- brand_name
- official_domain
- aliases
- known_accounts
- identity_confidence

重要：

同名企業・同名ブランド・非公式アカウントを混同しないでください。

確認できないSNS URLを生成してはいけません。

不明な項目はnullとしてください。
```

### 出力

```json
{
  "canonical_name": "",
  "target_type": "",
  "company_name": null,
  "brand_name": null,
  "official_domain": null,
  "aliases": [],
  "candidate_accounts": {},
  "identity_confidence": 0.0,
  "unknown": []
}
```

### Sonnet昇格条件

```text
identity_confidence < 0.90

OR

同名候補 >= 2

OR

企業とブランドの所属関係が曖昧
```

---

## 4. Phase 0.5｜Source Policy Gate

### 使用モデル

```text
原則：
Python + YAML
```

重要：
LLMに利用規約判定を最終決定させない。

Haikuは、
```text
source_type分類
```

だけ可能。

最終判断：

```text
ALLOW
API_ONLY
PUBLIC_ONLY
USER_DATA_ONLY
MANUAL_ONLY
BLOCK
```

は設定ファイルから決定する。

---

## 5. Phase 1｜Source Gateway / Scraper

### 使用モデル

```text
基本：
LLMなし
```

処理：

```text
API
Web
Search
CSV
JSON
Manual
Cache
```

からRaw Dataを取得する。

重要：
LLMにHTMLから数字を「推測」させない。

---

## 6. Phase 2｜Evidence Engine

### 使用モデル

```text
Python
+
Haiku 4.5
```

### Python

```text
Freshness
Coverage
Cross-validation
Extraction certainty
Source Authority
Evidence Score
```

### Haiku

```text
Claim Type分類
Source内容の簡易比較
意味的一致判定
```

### Haiku指示文

```
ROLE:
Evidence Classification Agent

TASK:
与えられたEvidenceとClaimを比較し、
そのClaimがどのカテゴリに属するか判定してください。

分類：

FACT
INFERENCE
HYPOTHESIS
UNKNOWN

重要：

Evidenceが不足している場合、
HYPOTHESISではなくUNKNOWNを優先してください。

Evidence同士が矛盾する場合、
どちらかを勝手に採用しないでください。
```

### 出力

```json
{
  "claim_type": "FACT",
  "supporting_evidence": [],
  "contradicting_evidence": [],
  "semantic_confidence": 0.0,
  "needs_review": false
}
```

### Sonnet昇格

```text
重大なEvidence矛盾 >= 2

OR

同一指標について複数Sourceが異なる

OR

重要Claimのconfidence < 0.80
```

---

## 7. Phase 3｜Normalize

### 使用モデル

```text
Pythonのみ
```

処理：

```text
1.5K → 1500
1.5万 → 15000
1.2M → 1200000

timezone normalization
URL normalization
account normalization
post normalization
duplicate removal
```

重要：
Haiku / Sonnet / Opus / GPTは禁止。

例外：
文章の言語判定やカテゴリー補助のみHaiku使用可。

---

## 8. Phase 4｜Metrics Engine

### 使用モデル

```text
Pythonのみ
```

計算：

```text
Engagement Count
Engagement Rate
Like Rate
Reply Rate
Repost Rate
Share Rate
Reach Efficiency
Velocity
Median
P25
P50
P75
P90
P95
Hit Rate
Viral Rate
Follower-normalized performance
```

重要：
LLMへ計算結果を渡す。
LLMに再計算させない。

---

## 9. Phase 5A｜Content Classification

### 使用モデル

```text
Haiku 4.5
```

600投稿などの大量データ処理を担当する。

分析：

```text
Topic
Content Pillar
Hook
Format
Narrative
Emotion
Audience
Problem
Promise
Proof
CTA
Novelty
Authority
Commercial Intent
```

### Haiku指示文

```
ROLE:
SNS Content Classification Agent

TASK:
投稿をContent DNA Schemaに従って分類してください。

目的は戦略提案ではありません。

このPhaseでは「分類」だけをしてください。

投稿内容に書かれていない意図を勝手に補完してはいけません。

判断できないカテゴリーはunknownとしてください。

各分類にconfidenceを付けてください。
```

### 出力

```json
{
  "post_id": "",
  "topic": [],
  "content_pillar": "",
  "hook": "",
  "format": "",
  "narrative": "",
  "emotion": [],
  "audience": [],
  "problem": null,
  "promise": null,
  "proof": null,
  "cta": null,
  "novelty": "",
  "authority": "",
  "commercial_intent": "",
  "confidence": 0.0
}
```

### Haiku品質Gate

次の場合のみSonnetへ送る。

```text
classification confidence < 0.75
```

ただし全投稿を再送しない。

```text
低Confidence投稿だけ
```

を送る。

例：

```text
600投稿
↓
Haiku

480件 confidence >= 0.75
→ 確定

120件 confidence < 0.75
→ Sonnet
```

---

## 10. Phase 5B｜Pattern Intelligence

### 使用モデル

```text
Sonnet 5
```

Haiku分類済みデータとPython Metricsを使用する。

入力対象：

```text
TOP 10%
MIDDLE representative sample
BOTTOM 10%
```

全投稿を渡す必要はない。

### Sonnet指示文

```
ROLE:
SNS Pattern Intelligence Analyst

TASK:
投稿群のパフォーマンス差を分析してください。

必ず、

TOP
MIDDLE
BOTTOM

を比較してください。

分析対象：

Topic
Hook
Format
Narrative
Emotion
CTA
Timing
Content Pillar
Post length
Authority
Novelty

単なる共通点ではなく、

「伸びた投稿と伸びなかった投稿で何が異なるか」

を特定してください。

相関を因果と断定してはいけません。

出力は以下の順序にしてください。

Observed Fact
Pattern
Possible Explanation
Counter Evidence
Reproducibility
Confidence
```

---

## 11. Viral Pattern Engine

Sonnetが生成する。

```text
WHY VIRAL

Topic
× Hook
× Emotion
× Format
× Timing
× Authority
× Novelty
× Shareability
× Audience Fit
```

必ず、

```text
再現可能
再現困難
不明
```

を分離する。

---

## 12. Phase 6｜Competitor Intelligence

### Default

```text
Sonnet 5
```

分析：

```text
Reach Power
Engagement Power
Viral Power
Content Power
Authority
Community
Stock/Search Power
Conversion Design
Consistency
Growth Momentum
```

### Sonnet指示文

```
ROLE:
Competitive SNS Intelligence Analyst

TASK:
対象企業と競合企業を、
フォロワー数だけではなく相対指標で比較してください。

目的はランキングではありません。

目的は、

「どこなら対象企業が勝てるか」

を発見することです。

必ず以下を分離してください。

1. Competitor Strength
2. Competitor Weakness
3. Target Strength
4. Target Weakness
5. Capability Gap
6. Whitespace
```

---

## 13. Phase 6 Opus昇格条件

以下の場合のみOpus 5を呼ぶ。

```text
競合 >= 5
AND
明確なWhitespaceが見つからない

OR

Sonnetの競合戦略候補が3案以上拮抗

OR

重要Opportunityのconfidence < 0.80

OR

複数SNSを横断する複雑なポジショニング判断
```

---

## 14. Opus 5｜Strategic Deep Dive

### 指示文

```
ROLE:
Senior SNS Competitive Strategy Architect

INPUT:
Sonnetまでの分析結果
Evidence
Metrics
Capability Gap
Whitespace Candidates

TASK:
単に競合との差を説明するのではなく、

「どの市場・Audience・Content Positionを取れば
対象企業が最も高い確率で優位性を構築できるか」

を判断してください。

検討：

Demand
Brand Fit
Competitive Intensity
Evidence Strength
Reproducibility
Production Cost
Conversion Potential
Defensibility

最低3案を比較し、
最終的に1〜2案へ絞ってください。

Evidenceの弱い戦略を魅力的な文章で補強してはいけません。
```

---

## 15. Phase 7｜Strategy Engine

### Default

```text
Sonnet 5
```

構造：

```text
Evidence
↓
Insight
↓
Opportunity
↓
Strategy
↓
Action
↓
KPI
↓
Experiment
```

### Sonnet指示文

```
ROLE:
SNS Growth Strategy Planner

TASK:
分析結果を実行可能なSNS戦略へ変換してください。

抽象論は禁止します。

各Strategyには必ず以下を含めてください。

Evidence
Insight
Hypothesis
Action
Frequency
Duration
KPI
Success Threshold
Stop Condition
Risk
```

---

## 16. Opus Strategy昇格

以下の場合：

```text
Opportunity Score >= 80

AND

事業インパクトが大きい

OR

30日を超える中長期戦略

OR

複数チャネルを統合する戦略

OR

営業提案・経営提案に利用

OR

ユーザーが --deep を指定
```

---

## 17. Phase 8｜Evaluator

### STANDARD

SonnetによるSelf Review。

### AUDIT

```text
GPT-5.6 Sol
```

をChallengerとして使用する。

---

## 18. GPT-5.6 Sol指示文

```
ROLE:
Independent Adversarial SNS Intelligence Auditor

IMPORTANT:
あなたの仕事は分析結果を改善することではなく、
まず疑うことです。

以下を徹底的に検証してください。

1. Evidence不足
2. Unsupported Claim
3. 数値と文章の矛盾
4. 相関と因果の混同
5. Survivorship Bias
6. Selection Bias
7. Recency Bias
8. Account Size Bias
9. Competitor Selection Bias
10. Overfitting
11. Hallucination
12. Recommendationの論理飛躍
13. UNKNOWNを推測で埋めていないか
14. 別の合理的説明が存在しないか

各重要Insightについて、

SUPPORT
CHALLENGE
REJECT
UNKNOWN

のいずれかを判定してください。

分析者の結論に同意する必要はありません。

Evidenceが不足していれば明確に否定してください。
```

---

## 19. GPT-5.6 Sol出力

```json
{
  "audit_score": 0,
  "claims": [
    {
      "claim_id": "",
      "verdict": "SUPPORT",
      "confidence": 0.0,
      "reason": "",
      "missing_evidence": [],
      "alternative_explanation": []
    }
  ],
  "critical_issues": [],
  "unsupported_claims": [],
  "recommended_revisions": [],
  "final_quality_score": 0
}
```

---

## 20. GPT-5.6 Sol自動発火条件

以下のどれか。

```text
--audit

OR

final_quality_score < 85

OR

重要戦略のEvidence Score < 80

OR

SonnetとOpusが異なる結論

OR

重要ClaimにCounter Evidenceあり

OR

経営者向け提案書

OR

外部公開レポート

OR

高額案件
```

---

## 21. Model Modes

### FAST

```text
Python
+
Haiku 4.5
```

用途：

```text
日次監視
簡易診断
大量企業スクリーニング
```

### STANDARD

デフォルト。

```text
Python
+
Haiku 4.5
+
Sonnet 5
```

用途：

```text
通常の /sns-analysis
競合調査
投稿分析
SNS改善
```

### DEEP

```text
Python
+
Haiku 4.5
+
Sonnet 5
+
Opus 5
```

用途：

```text
営業提案
重要企業
新規戦略
Capability Gap
Whitespace
```

### AUDIT

```text
Python
+
Haiku 4.5
+
Sonnet 5
+
Opus 5
+
GPT-5.6 Sol
```

用途：

```text
経営判断
外部公開
高額案件
重要提案
最終品質保証
```

---

## 22. CLI

```text
/sns-analysis トヨタ
```

＝STANDARD

```text
/sns-analysis トヨタ --fast
```

＝FAST

```text
/sns-analysis トヨタ --deep
```

＝DEEP

```text
/sns-analysis トヨタ --audit
```

＝AUDIT

---

## 23. Adaptive Escalation

ユーザーがmodeを指定しなくても自動昇格可能にする。

```text
STANDARD
   ↓
Sonnet confidence確認

confidence >= 0.85
→終了

confidence < 0.85
→Opus

Opus分析
   ↓

矛盾なし
Evidence十分
→終了

矛盾あり
Evidence不足
High impact
→GPT-5.6 Sol
```

---

## 24. Token Funnel

高価格モデルへRaw Datasetを送らない。

```text
600 posts

↓ Python

600 normalized

↓ Haiku

600 classified

↓ Python ranking

150 representative posts

↓ Sonnet

30 insights

↓ Opus

5 strategic opportunities

↓ GPT-5.6 Sol

最終監査
```

---

## 25. 重要なコストルール

### 禁止

```text
600投稿
↓
Opus 5
```

### 禁止

```text
600投稿
↓
GPT-5.6 Sol
```

### 正解

```text
大量
→ Haiku

重要部分
→ Sonnet

難問
→ Opus

最終結論
→ GPT-5.6 Sol
```

---

## 26. model-routing.yaml

```yaml
default_mode: standard

models:

  classifier:
    provider: anthropic
    model: haiku-4.5

  analyst:
    provider: anthropic
    model: sonnet-5

  strategist:
    provider: anthropic
    model: opus-5

  challenger:
    provider: openai
    model: gpt-5.6-sol

modes:

  fast:
    classifier: true
    analyst: false
    strategist: false
    challenger: false

  standard:
    classifier: true
    analyst: true
    strategist: conditional
    challenger: conditional

  deep:
    classifier: true
    analyst: true
    strategist: true
    challenger: conditional

  audit:
    classifier: true
    analyst: true
    strategist: true
    challenger: true

escalation:

  classifier_to_analyst:
    confidence_below: 0.75

  analyst_to_strategist:
    confidence_below: 0.85
    ambiguity: true
    strategic_complexity: high

  strategist_to_challenger:
    conflicting_evidence: true
    final_quality_below: 85
    external_publication: true
    executive_decision: true
```

重要：
実際のprovider/model IDは実装時に環境設定から注入し、
ビジネスロジックへハードコードしないこと。

---

## 27. Router最終原則

Model Routerは、

```text
「どのモデルが一番賢いか」
```

を選ぶ仕組みにしない。

選択基準は、

```text
Task Complexity
Evidence Quality
Confidence
Business Impact
Token Volume
Cost
```

とする。

### 最終原則

```text
最小限のモデルで開始する。

十分な品質なら終了する。

品質が不足した場合だけ
より高性能なモデルへ昇格する。
```

これをKENGOOD SNS Intelligence Engine v2の
標準Model Routing Policyとする。

---

## 実装ロードマップ

### Phase 1: ベース実装
- [ ] model-routing.yaml を作成
- [ ] Phase 0-4（Python層）を実装
- [ ] Haiku統合（分類層）

### Phase 2: 分析層統合
- [ ] Sonnet統合（Pattern Intelligence）
- [ ] Token Funnel実装
- [ ] Adaptive Escalation基盤

### Phase 3: 高度な分析
- [ ] Opus統合（Strategy Engine）
- [ ] Evidence Scoring強化

### Phase 4: 品質保証
- [ ] GPT-5.6 Sol統合（Audit Phase）
- [ ] Self Review機構

### Phase 5: 本番化
- [ ] モード別CLI実装
- [ ] コスト監視ダッシュボード
- [ ] ログ・監査ログ

---

**このEngineをローカル環境で実装することで、
エンタープライズグレードの SNS 分析プラットフォームが完成します。** 🚀
