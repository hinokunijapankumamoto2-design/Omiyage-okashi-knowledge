#!/usr/bin/env python3
"""
KENGOOD SNS Intelligence Engine v2
Phase 6: Competitor Intelligence / Opus Strategic Deep Dive

設計方針（KENGOOD_SNS_Intelligence_Engine_v2.md §12〜14 準拠）：
- Power Profile（Reach/Engagement/Viral/Content Power等）は
  Phase 4 の実測メトリクスから算出する Python 決定論的処理。
  algorithm上導出できない指標（Authority/Community等、note・YouTube等の
  外部データが必要なもの）は無理に補完せず None（unknown）のままにする
  （COMMON SYSTEM RULE禁止事項2「未取得データを0として扱わない」準拠）。
- Default: Sonnet 5。フォロワー数だけでなく相対指標で比較する。
  目的はランキングではなく「どこなら対象企業が勝てるか」の発見。
  必ず Competitor Strength / Competitor Weakness / Target Strength /
  Target Weakness / Capability Gap / Whitespace を分離する。
- Opus昇格条件（§13）を満たす場合のみ Opus 5 による
  Strategic Deep Dive（§14）を実行する。

client（Sonnet用）/ opus_client（Opus用）が渡されない場合は、
Power Profileの数値比較のみに基づく決定論的フォールバックで代替する。
"""

from dataclasses import dataclass, field, asdict
from statistics import mean
from typing import Any, Dict, List, Optional

from phase5_common import COMMON_SYSTEM_RULE, DEFAULT_MODELS, call_model, extract_json_object

PHASE6_INSTRUCTION = """ROLE:
Competitive SNS Intelligence Analyst

TASK:
対象企業と競合企業を、フォロワー数だけではなく相対指標で比較してください。

目的はランキングではありません。

目的は、「どこなら対象企業が勝てるか」を発見することです。

必ず以下を分離してください。

1. Competitor Strength
2. Competitor Weakness
3. Target Strength
4. Target Weakness
5. Capability Gap
6. Whitespace

出力は次のJSON Schemaに厳密に従ってください:

{
  "competitor_strength": [],
  "competitor_weakness": [],
  "target_strength": [],
  "target_weakness": [],
  "capability_gap": [],
  "whitespace": [],
  "confidence": 0.0
}"""

PHASE14_INSTRUCTION = """ROLE:
Senior SNS Competitive Strategy Architect

TASK:
単に競合との差を説明するのではなく、
「どの市場・Audience・Content Positionを取れば対象企業が最も高い確率で
優位性を構築できるか」を判断してください。

検討: Demand, Brand Fit, Competitive Intensity, Evidence Strength,
Reproducibility, Production Cost, Conversion Potential, Defensibility

最低3案を比較し、最終的に1〜2案へ絞ってください。
Evidenceの弱い戦略を魅力的な文章で補強してはいけません。

出力は次のJSON Schemaに厳密に従ってください:

{
  "candidates_considered": [],
  "finalists": [
    {
      "position": "",
      "rationale": "",
      "evidence_strength": "",
      "reproducibility": "",
      "risk": ""
    }
  ],
  "confidence": 0.0
}"""

# Power Profile算出対象の指標（Phase 4出力キー -> Power Profileキー）
_METRIC_TO_POWER_KEY = {
    "avg_reach_efficiency": "reach_power",
    "avg_engagement_rate": "engagement_power",
    "viral_rate": "viral_power",
    "hit_rate": "content_power",
    "avg_velocity": "growth_momentum",
    "post_count": "consistency",
}

# Sonnetでも算出困難（Xの投稿メトリクスだけでは求まらない）指標
_EXTERNAL_DATA_REQUIRED_KEYS = ["authority", "community", "stock_search_power", "conversion_design"]


@dataclass
class AccountPowerProfile:
    """設計書 §12 の10指標のうち、Phase4出力から算出可能な範囲をPythonで計算する"""
    reach_power: Optional[float] = None
    engagement_power: Optional[float] = None
    viral_power: Optional[float] = None
    content_power: Optional[float] = None
    authority: Optional[float] = None            # 外部データ要（note/YouTube等）。本モジュールでは常にNone
    community: Optional[float] = None             # 同上
    stock_search_power: Optional[float] = None    # 同上
    conversion_design: Optional[float] = None      # 同上
    consistency: Optional[float] = None
    growth_momentum: Optional[float] = None

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class CompetitorComparison:
    competitor_strength: List[str] = field(default_factory=list)
    competitor_weakness: List[str] = field(default_factory=list)
    target_strength: List[str] = field(default_factory=list)
    target_weakness: List[str] = field(default_factory=list)
    capability_gap: List[str] = field(default_factory=list)
    whitespace: List[str] = field(default_factory=list)
    confidence: float = 0.0
    analysis_source: str = "unknown"

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class StrategicDeepDive:
    candidates_considered: List[str] = field(default_factory=list)
    finalists: List[Dict] = field(default_factory=list)
    confidence: float = 0.0
    analysis_source: str = "unknown"

    def to_dict(self) -> Dict:
        return asdict(self)


def compute_relative_power_profiles(
    accounts_summary: Dict[str, Dict[str, Optional[float]]]
) -> Dict[str, AccountPowerProfile]:
    """
    複数アカウントの集計指標（Phase4出力の平均値等）から、
    アカウント間の相対的な Power Profile（0〜1に min-max 正規化）を算出する。

    Args:
        accounts_summary: {
            "target": {"avg_engagement_rate": 2.1, "viral_rate": 0.1, ...},
            "competitor_a": {...},
            ...
        }
        欠損している指標キーは無視される（0として補完しない）。

    Returns:
        {account_name: AccountPowerProfile}
    """
    profiles = {name: {} for name in accounts_summary}

    for metric_key, power_key in _METRIC_TO_POWER_KEY.items():
        values = {
            name: summary[metric_key]
            for name, summary in accounts_summary.items()
            if summary.get(metric_key) is not None
        }
        if len(values) < 2:
            # 比較対象が1件以下では「相対指標」が算出できないためunknownのまま
            for name in accounts_summary:
                profiles[name][power_key] = None
            continue

        lo, hi = min(values.values()), max(values.values())
        for name, value in values.items():
            if hi == lo:
                profiles[name][power_key] = 0.5  # 全員同値 = 相対差なし
            else:
                profiles[name][power_key] = round((value - lo) / (hi - lo), 4)

    result = {}
    for name in accounts_summary:
        result[name] = AccountPowerProfile(**profiles[name])
    return result


class CompetitorAnalyst:
    """Phase 6: Competitive SNS Intelligence Analyst"""

    # Opus昇格条件（設計書 §13）
    OPUS_ESCALATION_MIN_COMPETITORS = 5
    OPUS_ESCALATION_CONFIDENCE_THRESHOLD = 0.80

    def __init__(self, client: Optional[Any] = None, model: Optional[str] = None):
        self.client = client
        self.model = model or DEFAULT_MODELS["analyst"]

    def analyze_competitors(
        self,
        power_profiles: Dict[str, AccountPowerProfile],
        target_key: str = "target",
    ) -> CompetitorComparison:
        if target_key not in power_profiles:
            raise ValueError(f"target_key '{target_key}' not found in power_profiles")

        if self.client is not None:
            return self._analyze_with_llm(power_profiles, target_key)
        return self._analyze_with_fallback(power_profiles, target_key)

    def should_escalate_to_opus(
        self,
        competitor_count: int,
        comparison: CompetitorComparison,
        multi_platform_complexity: bool = False,
    ) -> bool:
        """設計書 §13 の Opus昇格条件"""
        no_clear_whitespace = len(comparison.whitespace) == 0
        return (
            (competitor_count >= self.OPUS_ESCALATION_MIN_COMPETITORS and no_clear_whitespace)
            or comparison.confidence < self.OPUS_ESCALATION_CONFIDENCE_THRESHOLD
            or multi_platform_complexity
        )

    # ---------------- 実LLM呼び出し ----------------

    def _analyze_with_llm(
        self, power_profiles: Dict[str, AccountPowerProfile], target_key: str
    ) -> CompetitorComparison:
        system_prompt = f"{COMMON_SYSTEM_RULE}\n\n{PHASE6_INSTRUCTION}"
        user_content = self._build_profile_table(power_profiles, target_key)

        try:
            raw_text = call_model(self.client, self.model, system_prompt, user_content, max_tokens=2048)
        except Exception:
            return CompetitorComparison(analysis_source="llm_error")

        parsed = extract_json_object(raw_text)
        if not parsed:
            return CompetitorComparison(analysis_source="llm_parse_error")

        return CompetitorComparison(
            competitor_strength=parsed.get("competitor_strength", []) or [],
            competitor_weakness=parsed.get("competitor_weakness", []) or [],
            target_strength=parsed.get("target_strength", []) or [],
            target_weakness=parsed.get("target_weakness", []) or [],
            capability_gap=parsed.get("capability_gap", []) or [],
            whitespace=parsed.get("whitespace", []) or [],
            confidence=float(parsed.get("confidence", 0.0) or 0.0),
            analysis_source="llm",
        )

    @staticmethod
    def _build_profile_table(power_profiles: Dict[str, AccountPowerProfile], target_key: str) -> str:
        lines = [f"target: {target_key}"]
        for name, profile in power_profiles.items():
            lines.append(f"- {name}: {profile.to_dict()}")
        return "\n".join(lines)

    # ---------------- フォールバック（Python決定論的） ----------------

    def _analyze_with_fallback(
        self, power_profiles: Dict[str, AccountPowerProfile], target_key: str
    ) -> CompetitorComparison:
        """
        Power Profileの数値比較のみで機械的に強み・弱み・Whitespaceを判定する。
        意味理解は行わない（例: なぜその指標が強いのかは説明しない）。
        """
        target_profile = power_profiles[target_key].to_dict()
        competitor_names = [k for k in power_profiles if k != target_key]

        target_strength, target_weakness = [], []
        capability_gap, whitespace = [], []
        competitor_strength, competitor_weakness = [], []

        for dim in _METRIC_TO_POWER_KEY.values():
            target_score = target_profile.get(dim)
            competitor_scores = [
                power_profiles[c].to_dict().get(dim)
                for c in competitor_names
                if power_profiles[c].to_dict().get(dim) is not None
            ]
            if target_score is None or not competitor_scores:
                continue

            comp_avg = mean(competitor_scores)
            comp_max = max(competitor_scores)
            comp_min = min(competitor_scores)

            if target_score >= comp_max:
                target_strength.append(dim)
            elif target_score <= comp_min:
                target_weakness.append(dim)

            if comp_max >= 0.7 and target_score < 0.5:
                competitor_strength.append(dim)
            if comp_avg <= 0.3 and target_score < 0.5:
                # 競合も弱く、対象も弱い = 誰も取れていない領域
                whitespace.append(dim)
            if target_score < comp_avg - 0.3:
                capability_gap.append(dim)
            if comp_min <= 0.2 and target_score >= 0.5:
                competitor_weakness.append(dim)

        known_dims = sum(
            1 for dim in _METRIC_TO_POWER_KEY.values() if target_profile.get(dim) is not None
        )
        # 判定できた指標の割合をconfidenceの代理指標とする（意味理解が無い分、上限を抑える）
        confidence = round(min(0.6, known_dims / len(_METRIC_TO_POWER_KEY)), 2) if known_dims else 0.0

        return CompetitorComparison(
            competitor_strength=competitor_strength,
            competitor_weakness=competitor_weakness,
            target_strength=target_strength,
            target_weakness=target_weakness,
            capability_gap=capability_gap,
            whitespace=whitespace,
            confidence=confidence,
            analysis_source="fallback_heuristic",
        )


class OpusStrategist:
    """Phase 14: Strategic Deep Dive（Opus昇格時のみ呼び出す）"""

    def __init__(self, client: Optional[Any] = None, model: Optional[str] = None):
        self.client = client
        self.model = model or DEFAULT_MODELS["strategist"]

    def deep_dive(self, comparison: CompetitorComparison) -> StrategicDeepDive:
        candidates = list(dict.fromkeys(comparison.whitespace + comparison.target_strength))

        if self.client is not None:
            return self._deep_dive_with_llm(comparison, candidates)
        return self._deep_dive_with_fallback(candidates)

    def _deep_dive_with_llm(
        self, comparison: CompetitorComparison, candidates: List[str]
    ) -> StrategicDeepDive:
        system_prompt = f"{COMMON_SYSTEM_RULE}\n\n{PHASE14_INSTRUCTION}"
        user_content = (
            f"whitespace候補: {comparison.whitespace}\n"
            f"target_strength: {comparison.target_strength}\n"
            f"capability_gap: {comparison.capability_gap}\n"
        )

        try:
            raw_text = call_model(self.client, self.model, system_prompt, user_content, max_tokens=2048)
        except Exception:
            return StrategicDeepDive(candidates_considered=candidates, analysis_source="llm_error")

        parsed = extract_json_object(raw_text)
        if not parsed:
            return StrategicDeepDive(candidates_considered=candidates, analysis_source="llm_parse_error")

        return StrategicDeepDive(
            candidates_considered=parsed.get("candidates_considered", candidates) or candidates,
            finalists=parsed.get("finalists", []) or [],
            confidence=float(parsed.get("confidence", 0.0) or 0.0),
            analysis_source="llm",
        )

    def _deep_dive_with_fallback(self, candidates: List[str]) -> StrategicDeepDive:
        """
        実LLMによる評価（Demand/Brand Fit/Competitive Intensity等）は行わず、
        候補をそのまま提示するに留める。誤って確信度の高い戦略提案を
        捏造しないよう、confidenceは低く固定する。
        """
        finalists = [
            {
                "position": candidate,
                "rationale": "フォールバック分析のため未評価（Opus 5による実評価が必要）",
                "evidence_strength": "unknown",
                "reproducibility": "unknown",
                "risk": "unknown",
            }
            for candidate in candidates[:2]
        ]
        return StrategicDeepDive(
            candidates_considered=candidates,
            finalists=finalists,
            confidence=0.0 if candidates else 0.0,
            analysis_source="fallback_heuristic",
        )


if __name__ == "__main__":
    import json

    accounts_summary = {
        "target": {"avg_engagement_rate": 1.2, "viral_rate": 0.05, "hit_rate": 0.3, "post_count": 50},
        "competitor_a": {"avg_engagement_rate": 3.5, "viral_rate": 0.2, "hit_rate": 0.4, "post_count": 80},
        "competitor_b": {"avg_engagement_rate": 0.8, "viral_rate": 0.01, "hit_rate": 0.1, "post_count": 20},
    }

    profiles = compute_relative_power_profiles(accounts_summary)
    analyst = CompetitorAnalyst()
    comparison = analyst.analyze_competitors(profiles, target_key="target")

    should_escalate = analyst.should_escalate_to_opus(competitor_count=2, comparison=comparison)

    print(json.dumps({
        "power_profiles": {k: v.to_dict() for k, v in profiles.items()},
        "comparison": comparison.to_dict(),
        "should_escalate_to_opus": should_escalate,
    }, ensure_ascii=False, indent=2))

    if should_escalate:
        strategist = OpusStrategist()
        deep_dive = strategist.deep_dive(comparison)
        print(json.dumps(deep_dive.to_dict(), ensure_ascii=False, indent=2))
