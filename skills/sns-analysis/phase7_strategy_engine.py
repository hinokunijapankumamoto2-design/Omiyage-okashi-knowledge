#!/usr/bin/env python3
"""
KENGOOD SNS Intelligence Engine v2
Phase 7: Strategy Engine

設計方針（KENGOOD_SNS_Intelligence_Engine_v2.md §15, §16 準拠）：
- Default: Sonnet 5。構造は Evidence → Insight → Opportunity → Strategy →
  Action → KPI → Experiment。
- 抽象論は禁止。各Strategyには
  Evidence / Insight / Hypothesis / Action / Frequency / Duration /
  KPI / Success Threshold / Stop Condition / Risk を必ず含める。
- Opus昇格条件（§16）を満たす場合のみ、より深い戦略検討（Phase 6の
  OpusStrategist.deep_dive 相当）へ回す判定を提供する
  （実際の深掘り生成はPhase 6のOpusStrategistが担当）。

client（Sonnet用）が渡されない場合は、Insight/Hypothesis/Actionのような
「意味理解」を要する文章を捏造せず、"unknown"（要Sonnet）として
明示するフォールバックで代替する。
"""

from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

from phase5_common import COMMON_SYSTEM_RULE, DEFAULT_MODELS, call_model, extract_json_object

PHASE7_INSTRUCTION = """ROLE:
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

出力は次のJSON Schemaに厳密に従ってください:

{
  "strategies": [
    {
      "evidence": [],
      "insight": "",
      "hypothesis": "",
      "action": "",
      "frequency": "",
      "duration": "",
      "kpi": "",
      "success_threshold": "",
      "stop_condition": "",
      "risk": ""
    }
  ]
}"""


@dataclass
class Strategy:
    """Phase 7 出力スキーマ（設計書 §15 準拠）"""
    evidence: List[str] = field(default_factory=list)
    insight: str = "unknown"
    hypothesis: str = "unknown"
    action: str = "unknown"
    frequency: str = "unknown"
    duration: str = "unknown"
    kpi: str = "unknown"
    success_threshold: str = "unknown"
    stop_condition: str = "unknown"
    risk: str = "unknown"
    opportunity_score: Optional[float] = None
    analysis_source: str = "unknown"

    def to_dict(self) -> Dict:
        return asdict(self)


class StrategyPlanner:
    """Phase 7: SNS Growth Strategy Engine"""

    # Opus Strategy昇格条件（設計書 §16）
    OPUS_OPPORTUNITY_SCORE_THRESHOLD = 80
    OPUS_DURATION_DAYS_THRESHOLD = 30

    def __init__(self, client: Optional[Any] = None, model: Optional[str] = None):
        self.client = client
        self.model = model or DEFAULT_MODELS["analyst"]

    def generate_strategies(self, opportunities: List[Dict]) -> List[Strategy]:
        """
        Args:
            opportunities: [{
                "opportunity_id": "whitespace-viral_power",
                "evidence": ["ev-001", "ev-002"],
                "context": "target・競合ともviral_powerが低い領域",  # 人間可読な背景情報
                "opportunity_score": 65.0,
            }, ...]
        """
        if self.client is not None:
            return self._generate_with_llm(opportunities)
        return self._generate_with_fallback(opportunities)

    def should_escalate_to_opus(
        self,
        strategy: Strategy,
        business_impact_large: bool = False,
        duration_days: Optional[int] = None,
        multi_channel: bool = False,
        is_executive_or_external_proposal: bool = False,
        user_requested_deep: bool = False,
    ) -> bool:
        """設計書 §16 の Opus Strategy昇格条件"""
        high_opportunity = (
            strategy.opportunity_score is not None
            and strategy.opportunity_score >= self.OPUS_OPPORTUNITY_SCORE_THRESHOLD
            and business_impact_large
        )
        long_term = duration_days is not None and duration_days > self.OPUS_DURATION_DAYS_THRESHOLD

        return bool(
            high_opportunity
            or long_term
            or multi_channel
            or is_executive_or_external_proposal
            or user_requested_deep
        )

    # ---------------- 実LLM呼び出し ----------------

    def _generate_with_llm(self, opportunities: List[Dict]) -> List[Strategy]:
        system_prompt = f"{COMMON_SYSTEM_RULE}\n\n{PHASE7_INSTRUCTION}"
        user_content = "\n".join(
            f"- opportunity_id={o.get('opportunity_id')} "
            f"evidence={o.get('evidence')} "
            f"context={o.get('context')} "
            f"opportunity_score={o.get('opportunity_score')}"
            for o in opportunities
        )

        try:
            raw_text = call_model(self.client, self.model, system_prompt, user_content, max_tokens=2048)
        except Exception:
            return [Strategy(analysis_source="llm_error") for _ in opportunities]

        parsed = extract_json_object(raw_text)
        if not parsed or "strategies" not in parsed:
            return [Strategy(analysis_source="llm_parse_error") for _ in opportunities]

        strategies = []
        for i, item in enumerate(parsed.get("strategies", [])):
            opportunity_score = (
                opportunities[i].get("opportunity_score") if i < len(opportunities) else None
            )
            strategies.append(Strategy(
                evidence=item.get("evidence", []) or [],
                insight=item.get("insight", "unknown"),
                hypothesis=item.get("hypothesis", "unknown"),
                action=item.get("action", "unknown"),
                frequency=item.get("frequency", "unknown"),
                duration=item.get("duration", "unknown"),
                kpi=item.get("kpi", "unknown"),
                success_threshold=item.get("success_threshold", "unknown"),
                stop_condition=item.get("stop_condition", "unknown"),
                risk=item.get("risk", "unknown"),
                opportunity_score=opportunity_score,
                analysis_source="llm",
            ))
        return strategies

    # ---------------- フォールバック（意味理解を伴う文章は捏造しない） ----------------

    def _generate_with_fallback(self, opportunities: List[Dict]) -> List[Strategy]:
        strategies = []
        for opportunity in opportunities:
            strategies.append(Strategy(
                evidence=opportunity.get("evidence", []) or [],
                insight="unknown（Sonnetによる意味理解が必要）",
                hypothesis="unknown（Sonnetによる意味理解が必要）",
                action="unknown（Sonnetによる意味理解が必要）",
                frequency="unknown",
                duration="unknown",
                kpi="unknown",
                success_threshold="unknown",
                stop_condition="unknown",
                risk="unknown",
                opportunity_score=opportunity.get("opportunity_score"),
                analysis_source="fallback_heuristic",
            ))
        return strategies


if __name__ == "__main__":
    import json

    planner = StrategyPlanner()  # client未指定 = フォールバックモード

    opportunities = [
        {
            "opportunity_id": "whitespace-viral_power",
            "evidence": ["ev-001", "ev-002"],
            "context": "target・競合ともviral_powerが低い領域",
            "opportunity_score": 85.0,
        },
    ]

    strategies = planner.generate_strategies(opportunities)
    for s in strategies:
        escalate = planner.should_escalate_to_opus(
            s, business_impact_large=True, duration_days=45
        )
        print(json.dumps({**s.to_dict(), "should_escalate_to_opus": escalate}, ensure_ascii=False, indent=2))
