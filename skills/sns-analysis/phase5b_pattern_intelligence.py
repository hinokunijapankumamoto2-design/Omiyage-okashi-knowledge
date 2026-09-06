#!/usr/bin/env python3
"""
KENGOOD SNS Intelligence Engine v2
Phase 5B: Pattern Intelligence / Viral Pattern Engine

設計方針（KENGOOD_SNS_Intelligence_Engine_v2.md §10, §11 準拠）：
- Default: Sonnet 5。Haiku分類済みデータ（Phase 5A）と
  Python Metrics（Phase 4）を入力とする。
- 全投稿ではなく TOP 10% / MIDDLE代表サンプル / BOTTOM 10% だけを
  比較対象とする（Token Funnel）。
- 「伸びた投稿と伸びなかった投稿で何が異なるか」を、
  Observed Fact → Pattern → Possible Explanation → Counter Evidence →
  Reproducibility → Confidence の順で出力する。
- 相関を因果と断定しない。

client（anthropic.Anthropic() 等）が渡されない場合は、
TOP/BOTTOM群の属性頻度を単純比較する決定論的フォールバックで代替する
（意味理解は行わない。オフライン検証専用）。
"""

from collections import Counter
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional

from phase5_common import COMMON_SYSTEM_RULE, DEFAULT_MODELS, call_model, extract_json_object

PHASE5B_INSTRUCTION = """ROLE:
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

出力は次のJSON Schemaに厳密に従ってください:

{
  "insights": [
    {
      "observed_fact": "",
      "pattern": "",
      "possible_explanation": "",
      "counter_evidence": [],
      "reproducibility": "reproducible | difficult | unknown",
      "confidence": 0.0
    }
  ]
}"""

# 属性差の判定に使う最小サンプル数（フォールバック用）
_MIN_SAMPLES_FOR_REPRODUCIBLE = 3


@dataclass
class PatternInsight:
    """Phase 5B 出力スキーマ（設計書 §10 準拠）"""
    observed_fact: str
    pattern: str
    possible_explanation: str
    counter_evidence: List[str] = field(default_factory=list)
    reproducibility: str = "unknown"  # reproducible / difficult / unknown
    confidence: float = 0.0
    analysis_source: str = "unknown"  # "llm" or "fallback_heuristic"

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class ViralPatternResult:
    """Phase 11: Viral Pattern Engine 出力"""
    factors: Dict[str, str] = field(default_factory=dict)
    reproducibility: str = "unknown"
    confidence: float = 0.0
    notes: List[str] = field(default_factory=list)
    analysis_source: str = "unknown"

    def to_dict(self) -> Dict:
        return asdict(self)


class SonnetPatternAnalyst:
    """Phase 5B / 11: Pattern Intelligence & Viral Pattern Engine"""

    def __init__(self, client: Optional[Any] = None, model: Optional[str] = None):
        self.client = client
        self.model = model or DEFAULT_MODELS["analyst"]

    # ==================== サンプリング（Token Funnel, Python決定論的） ====================

    @staticmethod
    def select_representative_samples(
        posts: List[Dict],
        metric_path: tuple = ("metrics", "engagement_rate"),
        top_pct: float = 10.0,
        bottom_pct: float = 10.0,
        middle_sample_size: int = 50,
    ) -> Dict[str, List[Dict]]:
        """
        投稿群を指標でソートし、TOP/MIDDLE代表サンプル/BOTTOMへ分割する。
        全投稿をSonnetへ渡さないための Token Funnel の中核処理。
        """
        if not posts:
            return {"top": [], "middle": [], "bottom": []}

        def _metric_value(p: Dict) -> float:
            value = p
            for key in metric_path:
                value = value.get(key, {}) if isinstance(value, dict) else None
            return value if isinstance(value, (int, float)) else 0.0

        sorted_posts = sorted(posts, key=_metric_value, reverse=True)
        n = len(sorted_posts)

        top_n = max(1, round(n * top_pct / 100))
        bottom_n = max(1, round(n * bottom_pct / 100))
        # 小規模データでTOP/BOTTOMが重複しないよう調整
        top_n = min(top_n, n)
        bottom_n = min(bottom_n, max(0, n - top_n))

        top = sorted_posts[:top_n]
        bottom = sorted_posts[n - bottom_n:] if bottom_n > 0 else []
        remaining = sorted_posts[top_n:n - bottom_n] if n - bottom_n > top_n else []

        if len(remaining) <= middle_sample_size:
            middle = remaining
        else:
            step = len(remaining) / middle_sample_size
            middle = [remaining[int(i * step)] for i in range(middle_sample_size)]

        return {"top": top, "middle": middle, "bottom": bottom}

    # ==================== Phase 5B: Pattern Intelligence ====================

    def analyze_patterns(
        self,
        top: List[Dict],
        middle: List[Dict],
        bottom: List[Dict],
    ) -> List[PatternInsight]:
        if self.client is not None:
            return self._analyze_with_llm(top, middle, bottom)
        return self._analyze_with_fallback(top, bottom)

    def _analyze_with_llm(
        self, top: List[Dict], middle: List[Dict], bottom: List[Dict]
    ) -> List[PatternInsight]:
        system_prompt = f"{COMMON_SYSTEM_RULE}\n\n{PHASE5B_INSTRUCTION}"
        user_content = self._build_group_summary(top, middle, bottom)

        try:
            raw_text = call_model(self.client, self.model, system_prompt, user_content, max_tokens=2048)
        except Exception:
            return []

        parsed = extract_json_object(raw_text)
        if not parsed or "insights" not in parsed:
            return []

        insights = []
        for item in parsed.get("insights", []):
            insights.append(PatternInsight(
                observed_fact=item.get("observed_fact", ""),
                pattern=item.get("pattern", ""),
                possible_explanation=item.get("possible_explanation", ""),
                counter_evidence=item.get("counter_evidence", []) or [],
                reproducibility=item.get("reproducibility", "unknown"),
                confidence=float(item.get("confidence", 0.0) or 0.0),
                analysis_source="llm",
            ))
        return insights

    @staticmethod
    def _build_group_summary(top: List[Dict], middle: List[Dict], bottom: List[Dict]) -> str:
        """LLMへ渡すコンパクトな要約（生データ全量を渡さない）"""
        def summarize_group(name: str, group: List[Dict]) -> str:
            lines = [f"[{name}] n={len(group)}"]
            for item in group[:20]:  # 代表のみ抜粋（さらなるToken節約）
                classification = item.get("classification", {})
                metrics = item.get("metrics", {})
                text = (item.get("post", {}) or {}).get("text", "")[:60]
                lines.append(
                    f"- topic={classification.get('topic')} "
                    f"format={classification.get('format')} "
                    f"emotion={classification.get('emotion')} "
                    f"engagement_rate={metrics.get('engagement_rate')} "
                    f"text=\"{text}\""
                )
            return "\n".join(lines)

        return "\n\n".join([
            summarize_group("TOP", top),
            summarize_group("MIDDLE", middle),
            summarize_group("BOTTOM", bottom),
        ])

    def _analyze_with_fallback(self, top: List[Dict], bottom: List[Dict]) -> List[PatternInsight]:
        """
        TOP/BOTTOM群の属性頻度を単純比較するフォールバック。
        意味理解は行わず、頻度差のみを機械的に報告する。
        """
        insights: List[PatternInsight] = []
        fields_to_compare = ["content_pillar", "hook", "format", "narrative", "authority", "novelty"]

        for field_name in fields_to_compare:
            top_counter = Counter(
                self._get_classification_field(p, field_name) for p in top
            )
            bottom_counter = Counter(
                self._get_classification_field(p, field_name) for p in bottom
            )

            top_common = top_counter.most_common(1)
            if not top_common or top_common[0][0] in (None, "unknown"):
                continue

            top_value, top_count = top_common[0]
            bottom_count = bottom_counter.get(top_value, 0)

            top_ratio = top_count / len(top) if top else 0.0
            bottom_ratio = bottom_count / len(bottom) if bottom else 0.0

            if top_ratio - bottom_ratio < 0.2:
                continue  # 有意な差とみなさない

            reproducibility = (
                "reproducible" if top_count >= _MIN_SAMPLES_FOR_REPRODUCIBLE else "difficult"
            )
            confidence = round(min(0.7, top_ratio - bottom_ratio), 2)  # フォールバックは高confidence化しない

            insights.append(PatternInsight(
                observed_fact=(
                    f"TOP群の{top_ratio:.0%}が {field_name}={top_value} である一方、"
                    f"BOTTOM群では{bottom_ratio:.0%}"
                ),
                pattern=f"{field_name}={top_value} はTOP群に偏っている",
                possible_explanation=(
                    "相関のみ観測。因果関係は未検証（フォールバック分析のため要Sonnet再検証）"
                ),
                counter_evidence=[],
                reproducibility=reproducibility,
                confidence=confidence,
                analysis_source="fallback_heuristic",
            ))

        return insights

    @staticmethod
    def _get_classification_field(item: Dict, field_name: str) -> Optional[str]:
        classification = item.get("classification", {}) or {}
        value = classification.get(field_name)
        if isinstance(value, list):
            return value[0] if value else None
        return value

    # ==================== Phase 11: Viral Pattern Engine ====================

    def build_viral_pattern_engine(self, top_posts: List[Dict]) -> ViralPatternResult:
        """
        WHY VIRAL: Topic × Hook × Emotion × Format × Timing × Authority ×
        Novelty × Shareability × Audience Fit の組み合わせを分析する。
        「再現可能 / 再現困難 / 不明」を必ず分離する。
        """
        if self.client is not None:
            return self._viral_with_llm(top_posts)
        return self._viral_with_fallback(top_posts)

    def _viral_with_llm(self, top_posts: List[Dict]) -> ViralPatternResult:
        system_prompt = f"{COMMON_SYSTEM_RULE}\n\nROLE:\nViral Pattern Engine\n\nTASK:\nTOP群の投稿からWHY VIRALの共通要因を特定し、次のJSON Schemaで出力してください:\n{{\"factors\": {{}}, \"reproducibility\": \"reproducible|difficult|unknown\", \"confidence\": 0.0, \"notes\": []}}"
        user_content = self._build_group_summary(top_posts, [], [])

        try:
            raw_text = call_model(self.client, self.model, system_prompt, user_content, max_tokens=1024)
        except Exception:
            return ViralPatternResult(analysis_source="llm_error")

        parsed = extract_json_object(raw_text)
        if not parsed:
            return ViralPatternResult(analysis_source="llm_parse_error")

        return ViralPatternResult(
            factors=parsed.get("factors", {}) or {},
            reproducibility=parsed.get("reproducibility", "unknown"),
            confidence=float(parsed.get("confidence", 0.0) or 0.0),
            notes=parsed.get("notes", []) or [],
            analysis_source="llm",
        )

    def _viral_with_fallback(self, top_posts: List[Dict]) -> ViralPatternResult:
        if not top_posts:
            return ViralPatternResult(reproducibility="unknown", analysis_source="fallback_heuristic")

        factors = {}
        for field_name in ["content_pillar", "hook", "format", "narrative", "authority", "novelty"]:
            values = [self._get_classification_field(p, field_name) for p in top_posts]
            values = [v for v in values if v and v != "unknown"]
            if not values:
                factors[field_name] = "unknown"
                continue
            most_common_value, count = Counter(values).most_common(1)[0]
            coverage = count / len(top_posts)
            # 半々（タイ）は「一貫したパターン」とみなさない
            factors[field_name] = most_common_value if coverage > 0.5 else "unknown"

        known_factor_count = sum(1 for v in factors.values() if v != "unknown")
        if known_factor_count == 0:
            reproducibility = "unknown"
        elif len(top_posts) >= _MIN_SAMPLES_FOR_REPRODUCIBLE and known_factor_count >= 2:
            reproducibility = "reproducible"
        else:
            reproducibility = "difficult"

        return ViralPatternResult(
            factors=factors,
            reproducibility=reproducibility,
            confidence=round(min(0.6, known_factor_count / 6), 2),
            notes=["フォールバック分析（頻度ベース）。意味理解によるSonnet再検証を推奨"],
            analysis_source="fallback_heuristic",
        )


if __name__ == "__main__":
    import json

    analyst = SonnetPatternAnalyst()  # client未指定 = フォールバックモード

    sample_posts = [
        {
            "post": {"text": f"post {i}"},
            "classification": {"content_pillar": "education" if i < 3 else "promotion", "format": "question" if i < 3 else "statement"},
            "metrics": {"engagement_rate": 10.0 - i},
        }
        for i in range(10)
    ]

    groups = analyst.select_representative_samples(sample_posts, top_pct=30, bottom_pct=30, middle_sample_size=10)
    insights = analyst.analyze_patterns(groups["top"], groups["middle"], groups["bottom"])
    viral = analyst.build_viral_pattern_engine(groups["top"])

    print(json.dumps({
        "insights": [i.to_dict() for i in insights],
        "viral": viral.to_dict(),
    }, ensure_ascii=False, indent=2))
