#!/usr/bin/env python3
"""
KENGOOD SNS Intelligence Engine v2
Phase 0: Target Resolver

ユーザー入力（企業名・ブランド名・SNSアカウント一覧など）を解析し、
分析対象のIdentityを構造化する。

設計方針（KENGOOD_SNS_Intelligence_Engine_v2.md §3 準拠）：
- 本モジュールはPythonのみで完結する決定論的レイヤー。
  Haikuによる「意味理解」（同名企業/非公式アカウントの曖昧性解消など）は
  上位レイヤーの責務とし、本モジュールは
  「confidenceが閾値未満 → needs_escalation=True」を返すところまでを担う。
- 既知アカウント（known_accounts）が明示的に渡された場合、それは
  「本人・運用者が自己管理していることを確認済み」の入力として扱う。
  無断で第三者アカウントを対象化しないことは、Phase 0.5（Source Policy Gate）
  および呼び出し側の責務。
"""

import re
from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Dict, List, Optional, Tuple


class TargetType(Enum):
    """分析対象のIdentity種別（設計書 §3 準拠）"""
    COMPANY = "company"
    BRAND = "brand"
    PRODUCT = "product"
    ACCOUNT = "account"
    CREATOR = "creator"
    SERVICE = "service"
    CAMPAIGN = "campaign"
    INDUSTRY = "industry"
    COMPETITOR_SET = "competitor_set"
    UNKNOWN = "unknown"


# Xのハンドルとして妥当な形式（英数字とアンダースコア、最大15文字）
_X_HANDLE_RE = re.compile(r"^[A-Za-z0-9_]{1,15}$")

# アカウント検証をプラットフォームごとの正規表現ではなく緩めに扱うプラットフォーム
_LOOSE_VALIDATION_PLATFORMS = {"note", "youtube", "instagram"}


@dataclass
class TargetIdentity:
    """Phase 0 出力スキーマ（設計書 §3 の出力JSONに準拠）"""
    canonical_name: str
    target_type: str
    company_name: Optional[str] = None
    brand_name: Optional[str] = None
    official_domain: Optional[str] = None
    aliases: List[str] = field(default_factory=list)
    candidate_accounts: Dict[str, List[str]] = field(default_factory=dict)
    identity_confidence: float = 0.0
    unknown: List[str] = field(default_factory=list)
    needs_escalation: bool = False
    escalation_reasons: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict:
        return asdict(self)


class TargetResolver:
    """
    Phase 0: Target Identity Resolver（Python決定論的実装）

    設計書は Default: Haiku 4.5 / Escalation: Sonnet 5 としているが、
    基盤レイヤー（Phase 0-4）はLLM不使用の決定論的処理として実装する。
    LLMによる曖昧性解消が必要なケースは needs_escalation / escalation_reasons
    として明示し、実際のモデル呼び出しは上位レイヤー（Phase 5以降の統合層）に委ねる。
    """

    # 設計書 §3「Sonnet昇格条件」の identity_confidence 閾値
    ESCALATION_CONFIDENCE_THRESHOLD = 0.90

    def resolve(
        self,
        canonical_name: str,
        target_type: str = TargetType.UNKNOWN.value,
        company_name: Optional[str] = None,
        brand_name: Optional[str] = None,
        official_domain: Optional[str] = None,
        aliases: Optional[List[str]] = None,
        known_accounts: Optional[Dict[str, List[str]]] = None,
    ) -> TargetIdentity:
        """
        構造化入力から TargetIdentity を解決する。

        Args:
            canonical_name: 対象の正式名称（例: "いちさん（株式会社PLai代表）"）
            target_type: TargetType のいずれか
            company_name: 所属企業名（分かる場合）
            brand_name: ブランド名（分かる場合）
            official_domain: 公式ドメイン（分かる場合）
            aliases: 別名・通称のリスト
            known_accounts: {"x": ["ichiaimarketer", ...], "youtube": [...]}
                プラットフォームごとの既知ハンドル。
                「本人・運用者が自己管理していることを確認済み」の入力として扱う。

        Returns:
            TargetIdentity
        """
        aliases = list(aliases or [])
        known_accounts = known_accounts or {}

        unknown: List[str] = []
        escalation_reasons: List[str] = []

        if not canonical_name or not canonical_name.strip():
            unknown.append("canonical_name")

        if not target_type or target_type == TargetType.UNKNOWN.value:
            unknown.append("target_type")

        validated_accounts, invalid_handles = self._validate_accounts(known_accounts)
        if invalid_handles:
            escalation_reasons.append(
                f"invalid_handle_format: {invalid_handles}"
            )

        duplicate_handles = self._find_cross_platform_duplicates(validated_accounts)
        if duplicate_handles:
            escalation_reasons.append(
                f"duplicate_handles_across_platforms: {duplicate_handles}"
            )

        confidence = self._score_confidence(
            canonical_name=canonical_name,
            company_name=company_name,
            brand_name=brand_name,
            validated_accounts=validated_accounts,
            invalid_handles=invalid_handles,
        )

        if confidence < self.ESCALATION_CONFIDENCE_THRESHOLD:
            escalation_reasons.append(
                f"identity_confidence_below_threshold: {confidence:.2f} < "
                f"{self.ESCALATION_CONFIDENCE_THRESHOLD}"
            )

        return TargetIdentity(
            canonical_name=canonical_name.strip() if canonical_name else "",
            target_type=target_type,
            company_name=company_name,
            brand_name=brand_name,
            official_domain=official_domain,
            aliases=aliases,
            candidate_accounts=validated_accounts,
            identity_confidence=round(confidence, 4),
            unknown=unknown,
            needs_escalation=bool(escalation_reasons),
            escalation_reasons=escalation_reasons,
        )

    # ==================== 内部処理 ====================

    def _validate_accounts(
        self, known_accounts: Dict[str, List[str]]
    ) -> Tuple[Dict[str, List[str]], List[str]]:
        """ハンドル形式を検証し、プラットフォームごとに重複除去する"""
        validated: Dict[str, List[str]] = {}
        invalid: List[str] = []

        for platform, handles in known_accounts.items():
            clean_handles: List[str] = []
            for raw_handle in handles:
                handle = (raw_handle or "").lstrip("@").strip()
                if not handle:
                    invalid.append(f"{platform}:{raw_handle!r}")
                    continue
                if platform == "x" and not _X_HANDLE_RE.match(handle):
                    invalid.append(f"{platform}:{raw_handle!r}")
                    continue
                clean_handles.append(handle)
            # 順序を保ったまま重複除去
            validated[platform] = list(dict.fromkeys(clean_handles))

        return validated, invalid

    def _find_cross_platform_duplicates(
        self, validated_accounts: Dict[str, List[str]]
    ) -> List[str]:
        """同一ハンドルが異なるプラットフォームキーの下で誤登録されていないか検出"""
        seen: Dict[str, str] = {}
        duplicates: List[str] = []
        for platform, handles in validated_accounts.items():
            for handle in handles:
                key = handle.lower()
                if key in seen and seen[key] != platform:
                    duplicates.append(f"{handle} ({seen[key]} / {platform})")
                else:
                    seen[key] = platform
        return duplicates

    def _score_confidence(
        self,
        canonical_name: Optional[str],
        company_name: Optional[str],
        brand_name: Optional[str],
        validated_accounts: Dict[str, List[str]],
        invalid_handles: List[str],
    ) -> float:
        """
        決定論的な identity_confidence スコアリング（0.0〜1.0）。

        - canonical_name が明示されている: +0.4
        - company_name または brand_name の裏付けがある: +0.2
        - 検証済みアカウントが1つ以上ある: +0.3
        - 検証済みアカウントが5つ以上ある（複数アカウントで裏付け）: +0.1
        - 無効なハンドルが混在: -0.1 × 件数
        """
        score = 0.0
        if canonical_name and canonical_name.strip():
            score += 0.4
        if company_name or brand_name:
            score += 0.2

        total_accounts = sum(len(v) for v in validated_accounts.values())
        if total_accounts > 0:
            score += 0.3
        if total_accounts >= 5:
            score += 0.1

        score -= 0.1 * len(invalid_handles)

        return max(0.0, min(1.0, score))


if __name__ == "__main__":
    import json

    resolver = TargetResolver()
    identity = resolver.resolve(
        canonical_name="いちさん（株式会社PLai代表、AirCle代表）",
        target_type=TargetType.CREATOR.value,
        company_name="株式会社PLai",
        known_accounts={
            "x": [
                "ichiaimarketer",
                "ClaudeCode_love",
                "AiAircle34052",
                "Codestudiopjbk",
                "obsidianstudio9",
                "sumika45379",
                "opensourcelab9",
                "AIbusiness9",
            ]
        },
    )
    print(json.dumps(identity.to_dict(), ensure_ascii=False, indent=2))
