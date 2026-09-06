# KENGOOD SNS Intelligence Engine v2
## ローカル実装チェックリスト

---

## 📦 実装パッケージ全体

ダウンロード済みファイル：

```
✅ scraper.py                              (31.8 KB)
✅ analyzer.py                             (21.4 KB)
✅ SKILL.md                                (7.0 KB)
✅ README.md                               (14.6 KB)
✅ LOCAL_SETUP_GUIDE.md                    (セットアップ用)
✅ KENGOOD_SNS_Intelligence_Engine_v2.md   (設計書)
✅ IMPLEMENTATION_CHECKLIST.md             (本ファイル)
```

---

## 🎯 実装目標

```
現在
↓
scraper.py (Phase 1: Source Gateway)
↓
analyzer.py (Phase 5A-7: Content Classification～Strategy Engine)

次段階
↓
KENGOOD Engine v2 統合実装
↓
Phase 0～Phase 8：完全な SNS Intelligence プラットフォーム
```

---

## 🔧 実装戦略

### ステップ1: ベース構築（1-2週間）

#### 1.1 ディレクトリ構造

```bash
your_sns_analysis_project/
│
├── core/
│   ├── __init__.py
│   ├── scraper.py              # Phase 1: Source Gateway
│   ├── analyzer.py             # Phase 5A-7: Content Classification
│   └── evidence_engine.py      # Phase 2: Evidence Engine（新規）
│
├── models/
│   ├── __init__.py
│   ├── router.py               # Model Routing Logic（新規）
│   ├── haiku_classifier.py     # Phase 0, 5A: Haiku Agent（新規）
│   ├── sonnet_analyst.py       # Phase 5B, 6, 7: Sonnet Agent（新規）
│   ├── opus_strategist.py      # Phase 6, 14: Opus Agent（新規）
│   └── gpt_auditor.py          # Phase 8: GPT-5.6 Sol Agent（新規）
│
├── config/
│   ├── __init__.py
│   ├── model-routing.yaml      # Model Routing設定（新規）
│   ├── phase-config.yaml       # Phase別設定（新規）
│   └── policy.yaml             # Source Policy Gate（新規）
│
├── utils/
│   ├── __init__.py
│   ├── python_engine.py        # Phase 3, 4: Python計算エンジン（新規）
│   ├── normalizer.py           # Phase 3: Normalization（新規）
│   ├── metrics_calculator.py   # Phase 4: Metrics計算（新規）
│   ├── evidence_scorer.py      # Evidence Quality Score（新規）
│   └── logger.py               # Audit & Logging（新規）
│
├── tests/
│   ├── __init__.py
│   ├── test_phase0.py          # Target Resolver Test
│   ├── test_phase1.py          # Source Gateway Test
│   ├── test_phase2.py          # Evidence Engine Test
│   ├── test_phase5a.py         # Content Classification Test
│   └── test_routing.py         # Model Routing Test
│
├── .env                         # 環境変数設定
├── requirements.txt             # 依存パッケージ
├── main.py                      # CLI エントリーポイント
└── README.md                    # プロジェクトドキュメント
```

#### 1.2 requirements.txt

```
# Core
anthropic>=0.28.0
tweepy>=4.12.0
playwright>=1.40.0
requests>=2.31.0

# Data Processing
pandas>=2.0.0
numpy>=1.24.0
pydantic>=2.0.0
python-dotenv>=1.0.0

# Analysis
scikit-learn>=1.3.0
nltk>=3.8.0

# Config & Utils
pyyaml>=6.0
python-dateutil>=2.8.0

# Async
aiohttp>=3.9.0
asyncio-contextmanager>=1.0.0

# Testing
pytest>=7.4.0
pytest-asyncio>=0.21.0
pytest-cov>=4.1.0

# Logging & Monitoring
loguru>=0.7.0
```

#### 1.3 .env テンプレート

```bash
# X API (OAuth Bearer Token)
X_BEARER_TOKEN=AAAA...

# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI API (GPT-5.6 Sol用)
OPENAI_API_KEY=sk-...

# Environment
MODE=standard  # fast | standard | deep | audit
LOG_LEVEL=INFO
```

---

### ステップ2: Phase 0-4 実装（2-3週間）

#### 2.1 Phase 0: Target Resolver

```python
# models/haiku_classifier.py

class TargetResolver:
    """Phase 0: Target Identity Resolver"""
    
    def __init__(self, client):
        self.client = client
        self.model = "claude-haiku-4-5-20251001"
    
    def resolve_target(self, user_input: str) -> Dict:
        """
        ユーザー入力を解析し、SNS分析対象を構造化
        """
        system_prompt = """
        ROLE:
        Target Identity Resolver

        TASK:
        ユーザー入力を解析し、
        SNS Intelligence分析対象のIdentity候補を構造化してください。
        ...
        """
        
        response = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=system_prompt,
            messages=[{
                "role": "user",
                "content": user_input
            }]
        )
        
        # JSON パース
        return self._parse_identity_result(response.content[0].text)
```

#### 2.2 Phase 1: Source Gateway

```python
# core/scraper.py の既存実装を活用
# X API v2 OAuth は既に実装済み
```

#### 2.3 Phase 2: Evidence Engine

```python
# core/evidence_engine.py

class EvidenceEngine:
    """Phase 2: Evidence Classification & Scoring"""
    
    def __init__(self, client):
        self.client = client
        self.python_engine = PythonEngine()
    
    def score_evidence(self, evidence: Dict) -> float:
        """
        Python で Evidence Score を計算
        - Freshness
        - Coverage
        - Cross-validation
        - Extraction certainty
        - Source Authority
        """
        freshness_score = self._calculate_freshness(evidence)
        coverage_score = self._calculate_coverage(evidence)
        # ...
        
        return weighted_average(
            freshness_score * 0.2,
            coverage_score * 0.3,
            # ...
        )
    
    def classify_claim(self, evidence, claim) -> Dict:
        """
        Haiku で FACT/INFERENCE/HYPOTHESIS/UNKNOWN を判定
        """
        # Evidence に基づいて Haiku へ送信
```

#### 2.4 Phase 3: Normalize

```python
# utils/normalizer.py

class Normalizer:
    """Phase 3: Data Normalization"""
    
    @staticmethod
    def parse_metric(value: str) -> int:
        """
        "1.5K" → 1500
        "1.5万" → 15000
        """
        # scraper.py の _parse_metric_text() を応用
    
    @staticmethod
    def normalize_account(account: str) -> str:
        """
        "@ichiaimarketer" → "ichiaimarketer"
        """
    
    @staticmethod
    def normalize_url(url: str) -> str:
        """
        URL 正規化
        """
```

#### 2.5 Phase 4: Metrics Engine

```python
# utils/metrics_calculator.py

class MetricsCalculator:
    """Phase 4: Metrics Calculation (Python only)"""
    
    @staticmethod
    def calculate_engagement_rate(likes, retweets, replies, impressions) -> float:
        total_engagement = likes + retweets + replies
        if impressions == 0:
            return 0.0
        return (total_engagement / impressions) * 100
    
    @staticmethod
    def calculate_percentiles(values: List[float]) -> Dict:
        return {
            "p25": np.percentile(values, 25),
            "p50": np.percentile(values, 50),
            "p75": np.percentile(values, 75),
            "p90": np.percentile(values, 90),
            "p95": np.percentile(values, 95),
        }
    
    @staticmethod
    def calculate_velocity(time_series: List[Dict]) -> float:
        """成長速度を計算"""
```

---

### ステップ3: Phase 5A-7 実装（3-4週間）

#### 3.1 Phase 5A: Content Classification

```python
# models/haiku_classifier.py - Content分類用に拡張

class ContentClassifier:
    """Phase 5A: Content DNA Classification"""
    
    def classify_posts(self, posts: List[Dict]) -> List[Dict]:
        """
        Haiku で 600投稿を分類
        
        各投稿に以下を付与：
        - topic
        - content_pillar
        - hook
        - format
        - narrative
        - emotion
        - audience
        - confidence
        """
        
        # Token Funnel: 大量投稿は Haiku へ
        classified = []
        
        for post in posts:
            result = self._classify_single_post(post)
            classified.append(result)
        
        # 品質Gate: confidence < 0.75 だけを Sonnet へ
        low_confidence = [p for p in classified if p['confidence'] < 0.75]
        
        return classified, low_confidence
    
    def _classify_single_post(self, post: Dict) -> Dict:
        """単一投稿を分類"""
```

#### 3.2 Phase 5B: Pattern Intelligence

```python
# models/sonnet_analyst.py

class PatternAnalyst:
    """Phase 5B: Pattern Intelligence Analyst"""
    
    def analyze_patterns(
        self,
        classified_posts: List[Dict],
        metrics: Dict
    ) -> Dict:
        """
        Haiku分類済みデータから、
        パフォーマンス差を分析
        
        入力：
        - TOP 10%投稿
        - MIDDLE代表投稿
        - BOTTOM 10%投稿
        """
        
        # Python で投稿をランク分け
        top_posts = self._get_top_percentile(classified_posts, metrics, 10)
        middle_posts = self._get_representative_sample(classified_posts, metrics, 50)
        bottom_posts = self._get_bottom_percentile(classified_posts, metrics, 10)
        
        # Sonnet へ送信（全投稿ではなく代表だけ）
        patterns = self._send_to_sonnet_analyst(
            top=top_posts,
            middle=middle_posts,
            bottom=bottom_posts
        )
        
        return patterns
```

#### 3.3 Phase 6: Competitor Intelligence

```python
# models/sonnet_analyst.py - Competitor分析用に拡張

class CompetitorAnalyst:
    """Phase 6: Competitive SNS Intelligence"""
    
    def analyze_competitors(
        self,
        target: Dict,
        competitors: List[Dict]
    ) -> Dict:
        """
        フォロワー数ではなく相対指標で比較
        """
        
        analysis = {
            "target": self._analyze_single_account(target),
            "competitors": [
                self._analyze_single_account(c) for c in competitors
            ],
            "comparison": self._compare_accounts(target, competitors),
            "whitespace": self._find_whitespace(target, competitors),
        }
        
        # Opus 昇格判定
        if self._should_escalate_to_opus(analysis):
            analysis["opus_deep_dive"] = self._send_to_opus(analysis)
        
        return analysis
```

#### 3.4 Phase 7: Strategy Engine

```python
# models/sonnet_analyst.py - Strategy生成用に拡張

class StrategyPlanner:
    """Phase 7: SNS Growth Strategy Engine"""
    
    def generate_strategies(
        self,
        target: Dict,
        analysis_results: Dict
    ) -> Dict:
        """
        分析結果を実行可能な戦略へ変換
        
        構造：
        Evidence → Insight → Opportunity → Strategy → Action
        """
        
        strategies = []
        
        for opportunity in analysis_results["opportunities"]:
            strategy = {
                "evidence": opportunity["supporting_evidence"],
                "insight": self._generate_insight(opportunity),
                "hypothesis": self._generate_hypothesis(opportunity),
                "action": self._generate_action(opportunity),
                "frequency": "daily" | "3x/week" | "weekly",
                "duration": "30 days" | "90 days" | "ongoing",
                "kpi": self._define_kpi(opportunity),
                "success_threshold": 0.85,
                "stop_condition": "engagement < baseline",
                "risk": self._identify_risk(opportunity),
            }
            strategies.append(strategy)
        
        return strategies
```

---

### ステップ4: Model Routing 実装（2週間）

#### 4.1 router.py

```python
# models/router.py

class ModelRouter:
    """
    KENGOOD SNS Intelligence Engine v2
    Model Routing Logic
    """
    
    def __init__(self, config: Dict):
        self.config = config
        self.mode = config.get("mode", "standard")
        self.clients = {
            "haiku": self._init_haiku_client(),
            "sonnet": self._init_sonnet_client(),
            "opus": self._init_opus_client(),
            "gpt": self._init_gpt_client(),
        }
    
    def route(self, task: Dict) -> Dict:
        """
        Task を最適なモデルへルーティング
        
        基本戦略：
        1. 最小限のモデルで開始
        2. 十分な品質なら終了
        3. 品質不足なら昇格
        """
        
        # Phase 判定
        phase = task.get("phase")
        
        if phase == "target_resolution":
            return self._route_phase0(task)
        elif phase == "content_classification":
            return self._route_phase5a(task)
        elif phase == "pattern_analysis":
            return self._route_phase5b(task)
        elif phase == "competitor_analysis":
            return self._route_phase6(task)
        elif phase == "strategy_generation":
            return self._route_phase7(task)
    
    def _route_phase5a(self, task: Dict) -> Dict:
        """
        Phase 5A: Content Classification
        
        - Default: Haiku
        - Escalation: Sonnet (if confidence < 0.75)
        """
        
        # Haiku で大量投稿を分類
        haiku_result = self._send_to_haiku(task)
        
        # 品質 Gate
        low_confidence_items = [
            item for item in haiku_result
            if item.get("confidence", 1.0) < 0.75
        ]
        
        if low_confidence_items:
            # Sonnet へ昇格
            sonnet_result = self._send_to_sonnet(low_confidence_items)
            # マージ
            haiku_result = self._merge_results(haiku_result, sonnet_result)
        
        return haiku_result
    
    def _adaptive_escalation(self, result: Dict) -> Dict:
        """
        自動昇格ロジック
        
        STANDARD
           ↓
        Sonnet confidence確認
           ↓
        confidence >= 0.85 → 終了
        confidence < 0.85 → Opus
           ↓
        Opus分析
           ↓
        矛盾なし ↓
        Evidence十分 → 終了
        
        矛盾あり ↓
        Evidence不足 → GPT-5.6 Sol
        """
```

#### 4.2 model-routing.yaml

```yaml
# config/model-routing.yaml

default_mode: standard

models:
  classifier:
    provider: anthropic
    model: claude-haiku-4-5-20251001
    max_tokens: 1024

  analyst:
    provider: anthropic
    model: claude-sonnet-5-20250514
    max_tokens: 2048

  strategist:
    provider: anthropic
    model: claude-opus-5-20250514
    max_tokens: 4096

  challenger:
    provider: openai
    model: gpt-5.6-sol
    max_tokens: 2048

modes:
  fast:
    classifier: true
    analyst: false
    strategist: false
    challenger: false
    max_tokens: 1024

  standard:
    classifier: true
    analyst: true
    strategist: conditional
    challenger: conditional
    max_tokens: 8192

  deep:
    classifier: true
    analyst: true
    strategist: true
    challenger: conditional
    max_tokens: 12288

  audit:
    classifier: true
    analyst: true
    strategist: true
    challenger: true
    max_tokens: 16384

escalation:
  classifier_to_analyst:
    confidence_below: 0.75
    trigger: "low_confidence_items"

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

---

### ステップ5: Phase 8 実装（1-2週間）

#### 5.1 Evaluator & Auditor

```python
# models/gpt_auditor.py

class AuditAgent:
    """Phase 8: Independent Adversarial Auditor"""
    
    def audit(self, analysis_result: Dict) -> Dict:
        """
        GPT-5.6 Sol で分析結果を監査
        
        検証対象：
        1. Evidence不足
        2. Unsupported Claim
        3. 数値と文章の矛盾
        4. 相関と因果の混同
        5. Survivorship Bias
        ...
        """
        
        audit_prompt = """
        ROLE:
        Independent Adversarial SNS Intelligence Auditor

        IMPORTANT:
        あなたの仕事は分析結果を改善することではなく、
        まず疑うことです。
        
        以下を徹底的に検証してください：
        ...
        """
        
        # 重要Claim抽出
        important_claims = self._extract_important_claims(analysis_result)
        
        # GPT-5.6 Sol で監査
        audit_response = self.client.messages.create(
            model="gpt-5.6-sol",
            messages=[...]
        )
        
        return self._parse_audit_result(audit_response)
    
    def should_trigger_audit(self, result: Dict) -> bool:
        """
        自動監査発火条件
        """
        return (
            result.get("quality_score", 100) < 85 or
            result.get("has_conflicting_evidence") or
            result.get("is_executive_proposal") or
            result.get("is_external_publication")
        )
```

---

### ステップ6: CLI & 統合（1週間）

#### 6.1 main.py

```python
# main.py

import click
from models.router import ModelRouter

@click.command()
@click.argument('target')
@click.option('--mode', default='standard', 
              type=click.Choice(['fast', 'standard', 'deep', 'audit']))
@click.option('--depth', is_flag=True, help='Deep analysis')
@click.option('--audit', is_flag=True, help='Full audit')
def analyze_sns(target, mode, depth, audit):
    """
    SNS Intelligence 分析エンジン
    
    使用例：
    python main.py いちさん
    python main.py いちさん --mode deep
    python main.py いちさん --audit
    """
    
    router = ModelRouter(config={
        "mode": mode if not (depth or audit) else 
                "deep" if depth else "audit"
    })
    
    # Phase 0: Target Resolution
    target_resolved = router.route({
        "phase": "target_resolution",
        "input": target
    })
    
    # Phase 1: Source Gateway
    raw_data = scraper.scrape_x_posts_oauth(
        target_resolved["candidate_accounts"]
    )
    
    # Phase 2-4: Evidence Engine + Normalization + Metrics
    evidence = process_through_phases(raw_data)
    
    # Phase 5-7: Content Classification → Pattern → Strategy
    analysis = router.route({
        "phase": "content_classification",
        "posts": raw_data
    })
    
    # Phase 8: Audit（if needed）
    if router.should_trigger_audit(analysis):
        audit_result = audit_agent.audit(analysis)
        analysis["audit"] = audit_result
    
    # 出力
    click.echo(json.dumps(analysis, indent=2, ensure_ascii=False))
```

#### 6.2 CLI 使用例

```bash
# FAST: 大量企業スクリーニング
python main.py トヨタ --mode fast

# STANDARD: 通常分析（デフォルト）
python main.py いちさん

# DEEP: 営業提案用
python main.py いちさん --mode deep

# AUDIT: 最終品質保証
python main.py いちさん --mode audit
```

---

## ✅ 実装チェックリスト

### Phase 1-4（基盤層）
- [ ] Python 計算エンジン実装
- [ ] Normalizer 実装
- [ ] Metrics Calculator 実装
- [ ] Evidence Scorer 実装
- [ ] Phase 0 テスト

### Phase 5A-7（LLM層）
- [ ] Haiku Classifier 実装
- [ ] Sonnet Analyst 実装
- [ ] Opus Strategist 実装
- [ ] Token Funnel 実装
- [ ] Adaptive Escalation 実装

### Model Routing
- [ ] router.py 実装
- [ ] model-routing.yaml 作成
- [ ] 昇格ロジック実装
- [ ] ログ・監視機能

### Phase 8（品質保証）
- [ ] GPT Auditor 実装
- [ ] 自動監査発火条件
- [ ] Audit レポート生成

### 統合・テスト
- [ ] CLI 実装
- [ ] エンドツーエンドテスト
- [ ] パフォーマンステスト
- [ ] コスト監視

### ドキュメント
- [ ] API ドキュメント
- [ ] デプロイメントガイド
- [ ] トラブルシューティング

---

## 📊 実装の進捗管理

```
Week 1-2:  Phase 0-4 基盤層
           ├─ Python Engine
           ├─ Normalizer
           ├─ Metrics Calculator
           └─ Evidence Engine

Week 3-4:  Phase 5A-7 LLM層
           ├─ Haiku Classifier
           ├─ Sonnet Analyst
           ├─ Opus Strategist
           └─ Token Funnel

Week 5-6:  Model Routing
           ├─ Router 実装
           ├─ Escalation Logic
           └─ CLI

Week 7:    Phase 8 + 統合
           ├─ GPT Auditor
           ├─ エンドツーエンドテスト
           └─ デプロイ
```

---

## 🚀 成功条件

- ✅ Haiku で 600投稿を分類（1秒あたり）
- ✅ Sonnet へは低Confidence投稿だけ送信（10-20%削減）
- ✅ Opus は複雑な戦略にのみ使用
- ✅ GPT-5.6 Sol は最終監査のみ
- ✅ コスト削減：30-40%（モデルローテーション）
- ✅ 品質向上：Audit Score >= 85

---

## 💡 実装のコツ

1. **段階的に実装**
   - 一度にすべてを作らない
   - Phase ごとにテスト

2. **Token Funnel を厳密に**
   - 大量データ → Haiku
   - 代表データ → Sonnet
   - 難問 → Opus

3. **Evidence を大切に**
   - すべての主張に Evidence ID
   - confidence を厳密に
   - UNKNOWN を無視しない

4. **昇格の自動化**
   - Adaptive Escalation で QA 工程を削減
   - confidenceベースの判定

5. **監査の自動化**
   - GPT-5.6 Sol で品質保証
   - Bias 検出の自動化

---

**このチェックリストに従って実装すれば、
エンタープライズグレードの SNS Intelligence Platform が完成します！** 🎯
