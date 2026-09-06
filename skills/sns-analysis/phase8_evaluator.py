#!/usr/bin/env python3
"""
KENGOOD SNS Intelligence Engine v2
Phase 8: Evaluator（STANDARD: Sonnet Self Review / AUDIT: GPT-5.6 Sol Challenger）

設計方針（KENGOOD_SNS_Intelligence_Engine_v2.md §17〜20 準拠）：
- STANDARD: SonnetによるSelf Review。
- AUDIT: GPT-5.6 Sol を独立した敵対的監査官（Challenger）として使用する。
  監査対象は「分析結果を改善すること」ではなく「まず疑うこと」。
- 各重要Insightについて SUPPORT / CHALLENGE / REJECT / UNKNOWN を判定する。
- 自動発火条件（§20）を満たす場合のみAUDITを実行する。

Phase 8のChallenger（GPT-5.6 Sol）はAnthropic以外のプロバイダを
想定しているため、本モジュールでは phase5_common.call_model の
Anthropic Messages API前提のシグネチャに縛られず、
`challenger_fn(system_prompt: str, user_content: str) -> str` という
プロバイダ非依存の呼び出し関数を注入する方式とする。
challenger_fn が渡されない場合は、構造的チェックのみを行う
決定論的フォールバック（意味理解を伴う敵対的レビューは行わない）で代替する。
"""

from dataclasses import dataclass, field, asdict
from typing import Callable, Dict, List, Optional

from phase5_common import COMMON_SYSTEM_RULE, DEFAULT_MODELS, call_model, extract_json_object

PHASE8_AUDIT_INSTRUCTION = """ROLE:
Independent Adversarial SNS Intelligence Auditor

IMPORTANT:
あなたの仕事は分析結果を改善することではなく、まず疑うことです。

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

各重要Insightについて、SUPPORT / CHALLENGE / REJECT / UNKNOWN の
いずれかを判定してください。

分析者の結論に同意する必要はありません。
Evidenceが不足していれば明確に否定してください。

出力は次のJSON Schemaに厳密に従ってください:

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
}"""


@dataclass
class ClaimVerdict:
    claim_id: str
    verdict: str = "UNKNOWN"  # SUPPORT / CHALLENGE / REJECT / UNKNOWN
    confidence: float = 0.0
    reason: str = ""
    missing_evidence: List[str] = field(default_factory=list)
    alternative_explanation: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class AuditResult:
    audit_score: float = 0.0
    claims: List[Dict] = field(default_factory=list)
    critical_issues: List[str] = field(default_factory=list)
    unsupported_claims: List[str] = field(default_factory=list)
    recommended_revisions: List[str] = field(default_factory=list)
    final_quality_score: float = 0.0
    analysis_source: str = "unknown"

    def to_dict(self) -> Dict:
        return asdict(self)


class SonnetSelfReviewer:
    """STANDARD モード: Sonnet 自身によるセルフレビュー"""

    def __init__(self, client=None, model: Optional[str] = None):
        self.client = client
        self.model = model or DEFAULT_MODELS["analyst"]

    def review(self, claims: List[Dict]) -> AuditResult:
        if self.client is not None:
            return self._review_with_llm(claims)
        return self._review_with_fallback(claims)

    def _review_with_llm(self, claims: List[Dict]) -> AuditResult:
        system_prompt = f"{COMMON_SYSTEM_RULE}\n\n以下の主張群を自己レビューし、{PHASE8_AUDIT_INSTRUCTION}"
        user_content = "\n".join(
            f"- claim_id={c.get('claim_id')} statement={c.get('statement')} "
            f"evidence_ids={c.get('evidence_ids')} confidence={c.get('confidence')}"
            for c in claims
        )
        try:
            raw_text = call_model(self.client, self.model, system_prompt, user_content, max_tokens=2048)
        except Exception:
            return AuditResult(analysis_source="llm_error")

        parsed = extract_json_object(raw_text)
        if not parsed:
            return AuditResult(analysis_source="llm_parse_error")

        return _audit_result_from_parsed(parsed, analysis_source="llm")

    def _review_with_fallback(self, claims: List[Dict]) -> AuditResult:
        return _structural_fallback_audit(claims)


class AuditAgent:
    """AUDIT モード: GPT-5.6 Sol（または設定されたChallenger）による敵対的監査"""

    # 設計書 §20 の final_quality_below 既定値
    DEFAULT_QUALITY_THRESHOLD = 85

    def __init__(self, challenger_fn: Optional[Callable[[str, str], str]] = None):
        """
        Args:
            challenger_fn: `(system_prompt, user_content) -> raw_response_text` を満たす
                プロバイダ非依存の呼び出し関数。省略時は構造的フォールバック監査を行う。
        """
        self.challenger_fn = challenger_fn

    def audit(self, claims: List[Dict]) -> AuditResult:
        if self.challenger_fn is not None:
            return self._audit_with_challenger(claims)
        return _structural_fallback_audit(claims)

    def should_trigger_audit(
        self,
        user_requested_audit: bool = False,
        final_quality_score: Optional[float] = None,
        evidence_score_for_important_strategy: Optional[float] = None,
        conflicting_expert_conclusions: bool = False,
        counter_evidence_on_important_claim: bool = False,
        executive_proposal: bool = False,
        external_publication: bool = False,
        high_value_deal: bool = False,
    ) -> bool:
        """設計書 §20 の GPT-5.6 Sol 自動発火条件"""
        low_quality = (
            final_quality_score is not None
            and final_quality_score < self.DEFAULT_QUALITY_THRESHOLD
        )
        low_evidence = (
            evidence_score_for_important_strategy is not None
            and evidence_score_for_important_strategy < 80
        )
        return bool(
            user_requested_audit
            or low_quality
            or low_evidence
            or conflicting_expert_conclusions
            or counter_evidence_on_important_claim
            or executive_proposal
            or external_publication
            or high_value_deal
        )

    def _audit_with_challenger(self, claims: List[Dict]) -> AuditResult:
        system_prompt = f"{COMMON_SYSTEM_RULE}\n\n{PHASE8_AUDIT_INSTRUCTION}"
        user_content = "\n".join(
            f"- claim_id={c.get('claim_id')} statement={c.get('statement')} "
            f"evidence_ids={c.get('evidence_ids')} confidence={c.get('confidence')} "
            f"counter_evidence={c.get('counter_evidence')}"
            for c in claims
        )
        try:
            raw_text = self.challenger_fn(system_prompt, user_content)
        except Exception:
            return AuditResult(analysis_source="challenger_error")

        parsed = extract_json_object(raw_text)
        if not parsed:
            return AuditResult(analysis_source="challenger_parse_error")

        return _audit_result_from_parsed(parsed, analysis_source="llm")


# ==================== 共有ヘルパー ====================

def _audit_result_from_parsed(parsed: Dict, analysis_source: str) -> AuditResult:
    return AuditResult(
        audit_score=float(parsed.get("audit_score", 0.0) or 0.0),
        claims=parsed.get("claims", []) or [],
        critical_issues=parsed.get("critical_issues", []) or [],
        unsupported_claims=parsed.get("unsupported_claims", []) or [],
        recommended_revisions=parsed.get("recommended_revisions", []) or [],
        final_quality_score=float(parsed.get("final_quality_score", 0.0) or 0.0),
        analysis_source=analysis_source,
    )


def _structural_fallback_audit(claims: List[Dict]) -> AuditResult:
    """
    意味理解を伴う敵対的レビューは行わず、構造的な健全性チェックのみ行う：
    - evidence_ids が空 → REJECT（Evidence不足）
    - counter_evidence があるのに confidence が高い → CHALLENGE
    - confidence が低い → UNKNOWN
    - それ以外 → SUPPORT（弱い自己申告。意味的な検証はしていないと明記）
    """
    verdicts: List[ClaimVerdict] = []
    critical_issues: List[str] = []
    unsupported_claims: List[str] = []

    for claim in claims:
        claim_id = claim.get("claim_id", "")
        evidence_ids = claim.get("evidence_ids", []) or []
        confidence = float(claim.get("confidence", 0.0) or 0.0)
        counter_evidence = claim.get("counter_evidence", []) or []

        if not evidence_ids:
            verdicts.append(ClaimVerdict(
                claim_id=claim_id, verdict="REJECT", confidence=0.0,
                reason="evidence_idsが空（Evidence不足）",
                missing_evidence=["evidence_ids"],
            ))
            unsupported_claims.append(claim_id)
            critical_issues.append(f"{claim_id}: no_evidence_ids")
            continue

        if counter_evidence and confidence >= 0.8:
            verdicts.append(ClaimVerdict(
                claim_id=claim_id, verdict="CHALLENGE", confidence=0.5,
                reason="counter_evidenceが存在するにもかかわらずconfidenceが高い",
                alternative_explanation=list(counter_evidence),
            ))
            critical_issues.append(f"{claim_id}: high_confidence_despite_counter_evidence")
            continue

        if confidence < 0.5:
            verdicts.append(ClaimVerdict(
                claim_id=claim_id, verdict="UNKNOWN", confidence=confidence,
                reason="confidenceが低く、判断を保留",
            ))
            continue

        verdicts.append(ClaimVerdict(
            claim_id=claim_id, verdict="SUPPORT", confidence=confidence,
            reason="構造的チェックのみ通過（意味的な敵対的検証は未実施）",
        ))

    final_quality_score = max(0.0, 100.0 - 20.0 * len(critical_issues) - 10.0 * len(unsupported_claims))

    return AuditResult(
        audit_score=final_quality_score,
        claims=[v.to_dict() for v in verdicts],
        critical_issues=critical_issues,
        unsupported_claims=unsupported_claims,
        recommended_revisions=(
            ["Evidence不足のClaimを再検証してください"] if unsupported_claims else []
        ),
        final_quality_score=final_quality_score,
        analysis_source="fallback_heuristic",
    )


if __name__ == "__main__":
    import json

    sample_claims = [
        {"claim_id": "c1", "statement": "TOPアカウントはengagement_rateが高い", "evidence_ids": ["ev-1"], "confidence": 0.9},
        {"claim_id": "c2", "statement": "根拠のない主張", "evidence_ids": [], "confidence": 0.9},
        {"claim_id": "c3", "statement": "矛盾する証拠あり", "evidence_ids": ["ev-3"], "confidence": 0.85, "counter_evidence": ["ev-3b"]},
    ]

    reviewer = SonnetSelfReviewer()  # client未指定 = フォールバック
    review_result = reviewer.review(sample_claims)
    print(json.dumps(review_result.to_dict(), ensure_ascii=False, indent=2))

    agent = AuditAgent()  # challenger_fn未指定 = フォールバック
    should_audit = agent.should_trigger_audit(final_quality_score=review_result.final_quality_score)
    print(f"\nshould_trigger_audit: {should_audit}")
    if should_audit:
        audit_result = agent.audit(sample_claims)
        print(json.dumps(audit_result.to_dict(), ensure_ascii=False, indent=2))
