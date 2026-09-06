#!/usr/bin/env python3
"""
KENGOOD SNS Intelligence Engine v2
Model Router

設計方針（KENGOOD_SNS_Intelligence_Engine_v2.md §21〜27 準拠）：
- モードは FAST / STANDARD / DEEP / AUDIT の4段階（§21, §22）。
- Router最終原則（§27）:
  「どのモデルが一番賢いか」ではなく、
  Task Complexity / Evidence Quality / Confidence / Business Impact /
  Token Volume / Cost を基準に選択する。
  最小限のモデルで開始し、品質が不足した場合だけ昇格する。
- 実際のprovider/model IDは model-routing.yaml から注入し、
  ビジネスロジックへハードコードしない。

本モジュールは「どのPhase/モデルを使うか」「いつ昇格するか」の
意思決定ロジックのみを提供する（Python決定論的）。
各Phaseの実行そのものは phase5a_content_classifier.py 等、
既存の各Phaseクラスが担う。
"""

from pathlib import Path
from typing import Dict, Optional

import yaml

_DEFAULT_CONFIG_PATH = Path(__file__).parent / "model-routing.yaml"

VALID_MODES = ("fast", "standard", "deep", "audit")


class ModelRouter:
    """Phase横断のモデル選択・エスカレーション判定を担うルーター"""

    def __init__(self, config_path: Optional[Path] = None):
        path = config_path or _DEFAULT_CONFIG_PATH
        with open(path, "r", encoding="utf-8") as f:
            self.config = yaml.safe_load(f) or {}

    # ==================== モデル設定 ====================

    def get_model_config(self, role: str) -> Dict:
        """role: classifier / analyst / strategist / challenger"""
        models = self.config.get("models", {})
        if role not in models:
            raise KeyError(f"Unknown model role: {role}")
        return models[role]

    # ==================== モード解決（§22 CLI準拠） ====================

    def resolve_mode(
        self,
        explicit_mode: Optional[str] = None,
        deep: bool = False,
        audit: bool = False,
    ) -> str:
        """
        CLI引数からモードを決定する。
        優先順位: --audit > --deep > 明示的なmode指定 > default_mode
        """
        if audit:
            return "audit"
        if deep:
            return "deep"
        if explicit_mode:
            if explicit_mode not in VALID_MODES:
                raise ValueError(f"Invalid mode: {explicit_mode!r} (valid: {VALID_MODES})")
            return explicit_mode
        return self.config.get("default_mode", "standard")

    def get_mode_config(self, mode: str) -> Dict:
        modes = self.config.get("modes", {})
        if mode not in modes:
            raise ValueError(f"Unknown mode: {mode!r} (valid: {tuple(modes.keys())})")
        return modes[mode]

    def is_role_enabled(self, mode: str, role: str) -> bool:
        """
        role が該当モードで常時有効かどうか。
        "conditional" はエスカレーション判定に委ねるため、ここではFalseを返す
        （呼び出し側が is_role_conditional() + should_escalate_* で個別判定する）。
        """
        return self.get_mode_config(mode).get(role, False) is True

    def is_role_conditional(self, mode: str, role: str) -> bool:
        return self.get_mode_config(mode).get(role) == "conditional"

    # ==================== Adaptive Escalation（§23） ====================

    def should_escalate_classifier_to_analyst(self, confidence: float) -> bool:
        threshold = (
            self.config.get("escalation", {})
            .get("classifier_to_analyst", {})
            .get("confidence_below", 0.75)
        )
        return confidence < threshold

    def should_escalate_analyst_to_strategist(self, confidence: float) -> bool:
        threshold = (
            self.config.get("escalation", {})
            .get("analyst_to_strategist", {})
            .get("confidence_below", 0.85)
        )
        return confidence < threshold

    def should_escalate_strategist_to_challenger(
        self,
        conflicting_evidence: bool = False,
        final_quality_score: Optional[float] = None,
        external_publication: bool = False,
        executive_decision: bool = False,
    ) -> bool:
        """設計書 §20 の GPT-5.6 Sol 自動発火条件（簡略版）"""
        threshold = (
            self.config.get("escalation", {})
            .get("strategist_to_challenger", {})
            .get("final_quality_below", 85)
        )
        low_quality = final_quality_score is not None and final_quality_score < threshold

        return bool(
            conflicting_evidence
            or low_quality
            or external_publication
            or executive_decision
        )


if __name__ == "__main__":
    router = ModelRouter()

    print("default mode:", router.resolve_mode())
    print("--deep mode:", router.resolve_mode(deep=True))
    print("--audit mode:", router.resolve_mode(audit=True))
    print("classifier model config:", router.get_model_config("classifier"))
    print("standard/strategist is conditional:", router.is_role_conditional("standard", "strategist"))
    print("fast/analyst enabled:", router.is_role_enabled("fast", "analyst"))
    print("escalate classifier->analyst @0.6:", router.should_escalate_classifier_to_analyst(0.6))
    print("escalate analyst->strategist @0.9:", router.should_escalate_analyst_to_strategist(0.9))
    print(
        "escalate strategist->challenger (quality=70):",
        router.should_escalate_strategist_to_challenger(final_quality_score=70),
    )
