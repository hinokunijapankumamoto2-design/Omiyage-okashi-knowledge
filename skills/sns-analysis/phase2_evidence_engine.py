#!/usr/bin/env python3
"""
KENGOOD SNS Intelligence Engine v2
Phase 2: Evidence Engine

設計方針（KENGOOD_SNS_Intelligence_Engine_v2.md §6 準拠）：
- Freshness / Coverage / Cross-validation / Extraction certainty /
  Source Authority / Evidence Score は Python の決定論的計算とする。
- Claim Type（FACT / INFERENCE / HYPOTHESIS / UNKNOWN）分類は
  設計書上はHaikuの担当だが、本レイヤー（Phase 0-4 基盤層）では
  Python のみのルールベース分類として実装する。
  Evidence不足時はHYPOTHESISではなくUNKNOWNを優先する
  （設計書の重要原則に準拠）。
"""

import re
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional


class ClaimType(Enum):
    FACT = "FACT"
    INFERENCE = "INFERENCE"
    HYPOTHESIS = "HYPOTHESIS"
    UNKNOWN = "UNKNOWN"


class ExtractionMethod(Enum):
    """抽出方法の信頼度階層（高い順）"""
    OFFICIAL_API = "official_api"                # 例: X API v2, YouTube Data API
    STRUCTURED_SCRAPE = "structured_scrape"       # 例: JSON埋め込み・data属性からの抽出
    REGEX_FALLBACK = "regex_fallback"             # 例: 本文中の正規表現マッチ
    MANUAL_INPUT = "manual_input"                 # 例: ユーザー手動入力


# 抽出方法ごとの extraction_certainty（決定論的な固定値）
_EXTRACTION_CERTAINTY = {
    ExtractionMethod.OFFICIAL_API.value: 1.0,
    ExtractionMethod.STRUCTURED_SCRAPE.value: 0.8,
    ExtractionMethod.REGEX_FALLBACK.value: 0.5,
    ExtractionMethod.MANUAL_INPUT.value: 0.3,
}

# source_type ごとの source_authority（Phase 0.5 の decision と対応）
_SOURCE_AUTHORITY = {
    "API_ONLY": 1.0,
    "ALLOW": 0.9,
    "PUBLIC_ONLY": 0.7,
    "MANUAL_ONLY": 0.4,
    "USER_DATA_ONLY": 0.6,
    "BLOCK": 0.0,
}


@dataclass
class Evidence:
    """1件の観測事実（Evidence）"""
    evidence_id: str
    platform: str
    author: Optional[str]
    source_url: str
    extraction_method: str
    source_decision: str            # Phase 0.5 の decision 値（API_ONLY 等）
    post_timestamp: Optional[str] = None   # ISO8601（投稿日時）
    captured_at: Optional[str] = None      # ISO8601（取得日時）
    field_name: str = ""             # 何を観測したか（例: "likes"）
    value: Optional[object] = None
    notes: str = ""

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class EvidenceScore:
    """Evidence群のスコアリング結果"""
    freshness: float
    coverage: float
    cross_validation: float
    extraction_certainty: float
    source_authority: float
    overall: float

    def to_dict(self) -> Dict:
        return asdict(self)


@dataclass
class ClaimClassification:
    """Claim（主張）の分類結果"""
    claim_type: str
    supporting_evidence: List[str] = field(default_factory=list)
    contradicting_evidence: List[str] = field(default_factory=list)
    confidence: float = 0.0
    needs_review: bool = False
    counter_evidence: List[str] = field(default_factory=list)
    limitations: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return asdict(self)


class EvidenceEngine:
    """
    Phase 2: Evidence Engine（Python決定論的実装）

    - extract_metadata(): 生データからメタデータ（投稿日時・著者・URL）を抽出
    - build_evidence(): Evidence レコードを構築
    - score_evidence(): Evidence Score を計算
    - classify_claim(): FACT/INFERENCE/HYPOTHESIS/UNKNOWN を判定
    """

    # cross-validation で「独立した裏付け」とみなす最小ソース数
    CROSS_VALIDATION_MIN_SOURCES = 2

    # freshness の半減期（日数）。これより古いデータは freshness が大きく減衰する。
    FRESHNESS_HALF_LIFE_DAYS = 30.0

    def extract_metadata(self, raw_post: Dict) -> Dict:
        """
        生の投稿データ（dict または PostMetrics.to_dict() 互換）から
        メタデータ（投稿日時・著者・URL）を抽出する。

        欠落しているフィールドは None のまま返す（UNKNOWNとして扱われる）。
        """
        return {
            "author": raw_post.get("author"),
            "post_timestamp": raw_post.get("timestamp") or raw_post.get("post_timestamp"),
            "source_url": raw_post.get("url") or raw_post.get("source_url", ""),
        }

    def build_evidence(
        self,
        evidence_id: str,
        platform: str,
        raw_post: Dict,
        field_name: str,
        extraction_method: str,
        source_decision: str,
        captured_at: Optional[str] = None,
    ) -> Evidence:
        """1件のEvidenceを構築する"""
        metadata = self.extract_metadata(raw_post)
        return Evidence(
            evidence_id=evidence_id,
            platform=platform,
            author=metadata["author"],
            source_url=metadata["source_url"],
            extraction_method=extraction_method,
            source_decision=source_decision,
            post_timestamp=metadata["post_timestamp"],
            captured_at=captured_at or datetime.now(timezone.utc).isoformat(),
            field_name=field_name,
            value=raw_post.get(field_name),
        )

    def score_evidence(
        self,
        evidence_list: List[Evidence],
        expected_source_count: Optional[int] = None,
        as_of: Optional[datetime] = None,
    ) -> EvidenceScore:
        """
        Evidence群からEvidence Scoreを計算する（すべてPython決定論的計算）。

        Args:
            evidence_list: 同一Claimを裏付けるEvidenceのリスト
            expected_source_count: coverage計算の分母（例: 分析対象アカウント総数）。
                省略時は evidence_list に現れるユニークなsourceの数を分母とする。
            as_of: freshness計算の基準時刻（省略時は現在時刻UTC）
        """
        if not evidence_list:
            zero = 0.0
            return EvidenceScore(zero, zero, zero, zero, zero, zero)

        as_of = as_of or datetime.now(timezone.utc)

        freshness = self._calculate_freshness(evidence_list, as_of)
        coverage = self._calculate_coverage(evidence_list, expected_source_count)
        cross_validation = self._calculate_cross_validation(evidence_list)
        extraction_certainty = self._calculate_extraction_certainty(evidence_list)
        source_authority = self._calculate_source_authority(evidence_list)

        # 設計書の重み付け例（README/IMPLEMENTATION_CHECKLIST準拠の加重平均）
        overall = (
            freshness * 0.2
            + coverage * 0.2
            + cross_validation * 0.2
            + extraction_certainty * 0.2
            + source_authority * 0.2
        )

        return EvidenceScore(
            freshness=round(freshness, 4),
            coverage=round(coverage, 4),
            cross_validation=round(cross_validation, 4),
            extraction_certainty=round(extraction_certainty, 4),
            source_authority=round(source_authority, 4),
            overall=round(overall, 4),
        )

    def classify_claim(
        self,
        claim_value: Optional[object],
        evidence_list: List[Evidence],
        contradicting_values: Optional[List[object]] = None,
    ) -> ClaimClassification:
        """
        Claimを FACT / INFERENCE / HYPOTHESIS / UNKNOWN に分類する。

        ルール（設計書 §6, §COMMON SYSTEM RULE 準拠）：
        1. Evidenceが1件もない → UNKNOWN
        2. Evidence同士が矛盾する（値が食い違う） → 片方を勝手に採用せず、
           needs_review=True、claim_type は HYPOTHESIS ではなく UNKNOWN を優先
        3. official_api 由来のEvidenceが1件でもある → FACT
        4. structured_scrape 由来のEvidenceが2件以上（cross-validation済み） → FACT
        5. Evidenceはあるが単一ソース・低信頼度 → INFERENCE（複数の弱い根拠から導く）
           ただし evidence が1件かつ低信頼度のみ → HYPOTHESIS
        """
        contradicting_values = contradicting_values or []
        limitations: List[str] = []

        if not evidence_list:
            return ClaimClassification(
                claim_type=ClaimType.UNKNOWN.value,
                confidence=0.0,
                needs_review=False,
                limitations=["no_evidence_available"],
            )

        supporting_ids = [e.evidence_id for e in evidence_list]

        has_contradiction = self._has_contradiction(claim_value, contradicting_values)
        if has_contradiction:
            return ClaimClassification(
                claim_type=ClaimType.UNKNOWN.value,
                supporting_evidence=supporting_ids,
                confidence=0.0,
                needs_review=True,
                counter_evidence=[str(v) for v in contradicting_values],
                limitations=["conflicting_evidence_not_auto_resolved"],
            )

        has_official_api = any(
            e.extraction_method == ExtractionMethod.OFFICIAL_API.value
            for e in evidence_list
        )
        independent_sources = self._count_independent_sources(evidence_list)

        if has_official_api:
            claim_type = ClaimType.FACT
            confidence = 0.95
        elif independent_sources >= self.CROSS_VALIDATION_MIN_SOURCES:
            claim_type = ClaimType.FACT
            confidence = 0.85
        elif len(evidence_list) >= 2:
            claim_type = ClaimType.INFERENCE
            confidence = 0.6
            limitations.append("single_source_family_multiple_records")
        else:
            claim_type = ClaimType.HYPOTHESIS
            confidence = 0.4
            limitations.append("single_low_confidence_evidence")

        needs_review = confidence < 0.80

        return ClaimClassification(
            claim_type=claim_type.value,
            supporting_evidence=supporting_ids,
            confidence=confidence,
            needs_review=needs_review,
            limitations=limitations,
        )

    # ==================== 内部計算処理 ====================

    def _calculate_freshness(
        self, evidence_list: List[Evidence], as_of: datetime
    ) -> float:
        """
        投稿日時からの経過日数に基づく freshness（指数減衰、半減期30日）。
        post_timestamp が無いEvidenceは freshness=0 として扱う。
        """
        scores = []
        for e in evidence_list:
            ts = self._parse_iso(e.post_timestamp)
            if ts is None:
                scores.append(0.0)
                continue
            age_days = max(0.0, (as_of - ts).total_seconds() / 86400.0)
            decay = 0.5 ** (age_days / self.FRESHNESS_HALF_LIFE_DAYS)
            scores.append(decay)
        return sum(scores) / len(scores) if scores else 0.0

    def _calculate_coverage(
        self, evidence_list: List[Evidence], expected_source_count: Optional[int]
    ) -> float:
        """観測できたユニークソース数 / 期待されるソース総数"""
        unique_sources = {e.source_url or e.author for e in evidence_list}
        denominator = expected_source_count or len(unique_sources)
        if denominator <= 0:
            return 0.0
        return min(1.0, len(unique_sources) / denominator)

    def _calculate_cross_validation(self, evidence_list: List[Evidence]) -> float:
        """独立ソース数に基づくクロスバリデーションスコア"""
        independent = self._count_independent_sources(evidence_list)
        if independent <= 1:
            return 0.0
        # 2ソースで0.5、4ソース以上で1.0に到達する単純な線形スケール
        return min(1.0, (independent - 1) / 3.0)

    def _calculate_extraction_certainty(self, evidence_list: List[Evidence]) -> float:
        values = [
            _EXTRACTION_CERTAINTY.get(e.extraction_method, 0.3)
            for e in evidence_list
        ]
        return sum(values) / len(values) if values else 0.0

    def _calculate_source_authority(self, evidence_list: List[Evidence]) -> float:
        values = [
            _SOURCE_AUTHORITY.get(e.source_decision, 0.3)
            for e in evidence_list
        ]
        return sum(values) / len(values) if values else 0.0

    def _count_independent_sources(self, evidence_list: List[Evidence]) -> int:
        return len({e.source_url or e.author or e.evidence_id for e in evidence_list})

    def _has_contradiction(
        self, claim_value: Optional[object], contradicting_values: List[object]
    ) -> bool:
        if claim_value is None or not contradicting_values:
            return False
        for v in contradicting_values:
            if v is None:
                continue
            if isinstance(claim_value, (int, float)) and isinstance(v, (int, float)):
                # 数値は10%以上の乖離を矛盾とみなす
                base = max(abs(claim_value), abs(v), 1e-9)
                if abs(claim_value - v) / base > 0.10:
                    return True
            elif str(claim_value) != str(v):
                return True
        return False

    @staticmethod
    def _parse_iso(value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        try:
            # phase3_normalizer.Normalizer.normalize_timestamp() が
            # 出力する "YYYY-MM-DDTHH:MM:SS+00:00" 形式を想定
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except (ValueError, AttributeError):
            return None


if __name__ == "__main__":
    import json

    engine = EvidenceEngine()

    sample_post = {
        "author": "ichiaimarketer",
        "timestamp": "2026-08-20T09:00:00+00:00",
        "url": "https://x.com/ichiaimarketer/status/123456789",
        "likes": 1200,
    }

    ev = engine.build_evidence(
        evidence_id="ev-001",
        platform="x",
        raw_post=sample_post,
        field_name="likes",
        extraction_method=ExtractionMethod.OFFICIAL_API.value,
        source_decision="API_ONLY",
    )

    score = engine.score_evidence([ev], expected_source_count=1)
    classification = engine.classify_claim(claim_value=1200, evidence_list=[ev])

    print(json.dumps({
        "evidence": ev.to_dict(),
        "score": score.to_dict(),
        "classification": classification.to_dict(),
    }, ensure_ascii=False, indent=2))
