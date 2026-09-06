#!/usr/bin/env python3
"""
KENGOOD SNS Intelligence Engine v2
統合レイヤー（Phase 0〜8 フルパイプライン）

Phase 0    : Target Resolver        (phase0_target_resolver.py)
Phase 0.5  : Source Policy Gate     (phase05_source_policy_gate.yaml)
Phase 1    : Source Gateway         (scraper.py / analyzer.py - 既存実装)
Phase 2    : Evidence Engine        (phase2_evidence_engine.py)
Phase 3    : Normalize              (phase3_normalizer.py)
Phase 4    : Metrics Engine         (phase4_metrics_engine.py)
Phase 5A   : Content Classification (phase5a_content_classifier.py)
Phase 5B   : Pattern Intelligence   (phase5b_pattern_intelligence.py)
Phase 6    : Competitor Intelligence(phase6_competitor_intelligence.py, 任意)
Phase 7    : Strategy Engine        (phase7_strategy_engine.py)
Phase 8    : Evaluator / Audit      (phase8_evaluator.py)
Model Router: モード解決・昇格判定    (model_router.py)

本ファイルはPhase 1（実データ取得）そのものは行わない。
scraper.py / analyzer.py で取得した生データ（PostMetrics.to_dict() 相当）を
raw_posts_by_account として受け取り、Phase 0.5 のゲートチェックを経て
Phase 2〜8 を適用し、エビデンストレース付きのJSONを組み立てる。

重要：Phase 5以降の各クライアント（classifier_client/analyst_client/
strategist_client/challenger_fn）を注入しない限り、分類・パターン分析・
戦略立案・監査はすべて決定論的フォールバック（キーワード頻度比較や
構造チェックのみ）で動作する。これは配線・自動化の検証を可能にするが、
実際の分析「精度」を上げるものではない。精度向上には実LLMクライアントの
注入が必須。
"""

import json
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any, Callable, Dict, List, Optional

import yaml

try:
    from .phase0_target_resolver import TargetResolver, TargetIdentity
    from .phase2_evidence_engine import EvidenceEngine
    from .phase3_normalizer import Normalizer
    from .phase4_metrics_engine import MetricsEngine
    from .phase5a_content_classifier import HaikuContentClassifier
    from .phase5b_pattern_intelligence import PatternInsight, SonnetPatternAnalyst
    from .phase6_competitor_intelligence import (
        CompetitorAnalyst,
        OpusStrategist,
        compute_relative_power_profiles,
    )
    from .phase7_strategy_engine import StrategyPlanner
    from .phase8_evaluator import AuditAgent, SonnetSelfReviewer
    from .model_router import ModelRouter
except ImportError:
    from phase0_target_resolver import TargetResolver, TargetIdentity
    from phase2_evidence_engine import EvidenceEngine
    from phase3_normalizer import Normalizer
    from phase4_metrics_engine import MetricsEngine
    from phase5a_content_classifier import HaikuContentClassifier
    from phase5b_pattern_intelligence import PatternInsight, SonnetPatternAnalyst
    from phase6_competitor_intelligence import (
        CompetitorAnalyst,
        OpusStrategist,
        compute_relative_power_profiles,
    )
    from phase7_strategy_engine import StrategyPlanner
    from phase8_evaluator import AuditAgent, SonnetSelfReviewer
    from model_router import ModelRouter


_DEFAULT_POLICY_PATH = Path(__file__).parent / "phase05_source_policy_gate.yaml"


class SourcePolicyGate:
    """
    Phase 0.5: Source Policy Gate

    設計書の重要原則「LLMに利用規約判定を最終決定させない」に従い、
    ALLOW/API_ONLY/PUBLIC_ONLY/USER_DATA_ONLY/MANUAL_ONLY/BLOCK の
    最終判断は必ず phase05_source_policy_gate.yaml から決定する。
    """

    def __init__(self, policy_path: Optional[Path] = None):
        path = policy_path or _DEFAULT_POLICY_PATH
        with open(path, "r", encoding="utf-8") as f:
            self.policy = yaml.safe_load(f) or {}

    def decide(self, source_type: str) -> Dict:
        decisions = self.policy.get("decisions", {})
        if source_type not in decisions:
            fallback = self.policy.get("fallback", {}).get(
                "on_unknown_source_type", "BLOCK"
            )
            return {
                "source_type": source_type,
                "decision": fallback,
                "requires": [],
                "description": "unknown_source_type",
            }
        entry = decisions[source_type]
        return {
            "source_type": source_type,
            "decision": entry.get("decision", "BLOCK"),
            "requires": entry.get("requires", []),
            "description": entry.get("description", ""),
        }

    def requires_self_managed_confirmation(self, target_type: str) -> bool:
        rules = self.policy.get("target_type_rules", {})
        return bool(
            rules.get(target_type, {}).get("require_self_managed_confirmation", False)
        )

    def check_target_authorization(self, identity: "TargetIdentity") -> Dict:
        """
        target_type に応じて「自己運用の確認」が必要かを判定する。
        Phase 0 で candidate_accounts（既知アカウント）が渡されていることを
        「本人・運用者が自己管理していることを確認済み」の代理指標として扱う。
        """
        needs_confirmation = self.requires_self_managed_confirmation(identity.target_type)
        has_known_accounts = any(identity.candidate_accounts.values())

        if needs_confirmation and not has_known_accounts:
            return {
                "allowed": False,
                "decision": "BLOCK",
                "reason": "personal_account_without_consent",
            }
        return {
            "allowed": True,
            "decision": "API_ONLY" if needs_confirmation else "ALLOW",
            "reason": "self_managed_confirmed" if needs_confirmation else "not_applicable",
        }


@dataclass
class PhaseTraceEntry:
    phase: str
    summary: str
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> Dict:
        return asdict(self)


class KengoodEngineV2:
    """
    Phase 0〜4 を順番に実行し、エビデンストレース付きのJSONを生成する統合クラス。

    - Phase 1（実データ取得）は本クラスの責務外。scraper.WebScraper /
      analyzer.SNSAnalyzer で取得した PostMetrics 相当の dict を
      raw_posts_by_account として run() に渡す。
    - Bearer Token やネットワークが使えない環境でも、Phase 1 の出力形式に
      合わせたサンプルデータさえあれば Phase 0〜4 を独立して検証できる
      （examples/ichisan_15accounts_analysis.py 参照）。
    """

    def __init__(
        self,
        policy_path: Optional[Path] = None,
        router: Optional[ModelRouter] = None,
        classifier_client: Optional[Any] = None,
        analyst_client: Optional[Any] = None,
        strategist_client: Optional[Any] = None,
        challenger_fn: Optional[Callable[[str, str], str]] = None,
    ):
        """
        Args:
            classifier_client: Phase 5A用（Haiku想定）。省略時はフォールバック分類。
            analyst_client: Phase 5B/6/7/8のSonnet自己レビュー用。省略時はフォールバック。
            strategist_client: Phase 6/7のOpus昇格時に使用。省略時はフォールバック。
            challenger_fn: Phase 8 AUDIT用の `(system, user) -> text` 関数
                （GPT-5.6 Sol等、Anthropic以外のプロバイダを想定）。省略時はフォールバック監査。
        """
        self.resolver = TargetResolver()
        self.policy_gate = SourcePolicyGate(policy_path)
        self.evidence_engine = EvidenceEngine()
        self.trace: List[PhaseTraceEntry] = []

        self.router = router or ModelRouter()

        self.classifier = HaikuContentClassifier(
            client=classifier_client, model=self.router.get_model_config("classifier")["model"]
        )
        self.pattern_analyst = SonnetPatternAnalyst(
            client=analyst_client, model=self.router.get_model_config("analyst")["model"]
        )
        self.competitor_analyst = CompetitorAnalyst(
            client=analyst_client, model=self.router.get_model_config("analyst")["model"]
        )
        self.opus_strategist = OpusStrategist(
            client=strategist_client, model=self.router.get_model_config("strategist")["model"]
        )
        self.strategy_planner = StrategyPlanner(
            client=analyst_client, model=self.router.get_model_config("analyst")["model"]
        )
        self.self_reviewer = SonnetSelfReviewer(
            client=analyst_client, model=self.router.get_model_config("analyst")["model"]
        )
        self.audit_agent = AuditAgent(challenger_fn=challenger_fn)

    def _log(self, phase: str, summary: str) -> None:
        self.trace.append(PhaseTraceEntry(phase=phase, summary=summary))

    def run(
        self,
        canonical_name: str,
        target_type: str,
        raw_posts_by_account: Dict[str, List[Dict]],
        company_name: Optional[str] = None,
        followers_by_account: Optional[Dict[str, int]] = None,
        extraction_method: str = "official_api",
        source_type: str = "x_api_v2_oauth",
    ) -> Dict:
        """
        Args:
            canonical_name: 分析対象の正式名称
            target_type: phase0_target_resolver.TargetType のいずれか
            raw_posts_by_account: {"ハンドル": [PostMetrics.to_dict(), ...], ...}
                Phase 1（scraper.py / analyzer.py）が返す生データ
            followers_by_account: reach_efficiency 計算用のフォロワー数（任意）
            extraction_method: phase2_evidence_engine.ExtractionMethod のいずれか
            source_type: phase05_source_policy_gate.yaml の decisions キー

        Returns:
            Phase 0〜4 のエビデンストレース付き結果を含む dict
        """
        followers_by_account = followers_by_account or {}
        self.trace = []

        # ---------- Phase 0: Target Resolver ----------
        identity = self.resolver.resolve(
            canonical_name=canonical_name,
            target_type=target_type,
            company_name=company_name,
            known_accounts={"x": list(raw_posts_by_account.keys())},
        )
        self._log(
            "phase0_target_resolver",
            f"identity_confidence={identity.identity_confidence} "
            f"needs_escalation={identity.needs_escalation}",
        )

        # ---------- Phase 0.5: Source Policy Gate ----------
        policy_decision = self.policy_gate.decide(source_type)
        authorization = self.policy_gate.check_target_authorization(identity)
        self._log(
            "phase05_source_policy_gate",
            f"policy_decision={policy_decision['decision']} "
            f"authorization={authorization['decision']}",
        )

        if not authorization["allowed"]:
            return {
                "identity": identity.to_dict(),
                "policy_decision": policy_decision,
                "authorization": authorization,
                "blocked": True,
                "accounts": {},
                "trace": [t.to_dict() for t in self.trace],
            }

        # ---------- Phase 2〜4: アカウント・投稿ごとに処理 ----------
        accounts_output: Dict[str, Dict] = {}
        evidence_id_counter = 0

        for account, raw_posts in raw_posts_by_account.items():
            normalized_posts = Normalizer.dedupe_posts(
                Normalizer.normalize_posts(raw_posts)
            )
            followers = followers_by_account.get(account)
            posts_output = []

            for post in normalized_posts:
                evidence_id_counter += 1
                evidence_id = f"ev-{account}-{evidence_id_counter:04d}"

                evidence = self.evidence_engine.build_evidence(
                    evidence_id=evidence_id,
                    platform="x",
                    raw_post=post,
                    field_name="likes",
                    extraction_method=extraction_method,
                    source_decision=policy_decision["decision"],
                )
                score = self.evidence_engine.score_evidence([evidence])
                classification = self.evidence_engine.classify_claim(
                    claim_value=post.get("likes"), evidence_list=[evidence]
                )
                metrics = MetricsEngine.build_engagement_metrics(
                    likes=post.get("likes", 0),
                    retweets=post.get("retweets", 0),
                    replies=post.get("replies", 0),
                    impressions=post.get("impressions", 0),
                    followers=followers,
                    post_timestamp=post.get("timestamp"),
                )

                posts_output.append({
                    "post": post,
                    "evidence": evidence.to_dict(),
                    "evidence_score": score.to_dict(),
                    "claim_classification": classification.to_dict(),
                    "metrics": metrics.to_dict(),
                })

            engagement_rates = [p["metrics"]["engagement_rate"] for p in posts_output]
            accounts_output[account] = {
                "post_count": len(posts_output),
                "posts": posts_output,
                "engagement_rate_percentiles": MetricsEngine.calculate_percentiles(engagement_rates),
                "hit_rate": MetricsEngine.calculate_hit_rate(engagement_rates),
                "viral_rate": MetricsEngine.calculate_viral_rate(engagement_rates),
            }

        self._log(
            "phase2_4_evidence_normalize_metrics",
            f"accounts_processed={len(accounts_output)} "
            f"total_posts={sum(a['post_count'] for a in accounts_output.values())}",
        )

        return {
            "identity": identity.to_dict(),
            "policy_decision": policy_decision,
            "authorization": authorization,
            "blocked": False,
            "accounts": accounts_output,
            "trace": [t.to_dict() for t in self.trace],
        }

    # ==================== Phase 5〜8: フルパイプライン ====================

    def run_full_pipeline(
        self,
        canonical_name: str,
        target_type: str,
        raw_posts_by_account: Dict[str, List[Dict]],
        company_name: Optional[str] = None,
        followers_by_account: Optional[Dict[str, int]] = None,
        extraction_method: str = "official_api",
        source_type: str = "x_api_v2_oauth",
        mode: Optional[str] = None,
        deep: bool = False,
        audit: bool = False,
        competitors_summary: Optional[Dict[str, Dict]] = None,
        business_impact_large: bool = False,
        multi_platform_complexity: bool = False,
        is_executive_or_external_proposal: bool = False,
    ) -> Dict:
        """
        Phase 0〜8 を一気通貫で実行する。

        Args:
            mode/deep/audit: model_router.ModelRouter.resolve_mode() に準拠。
                FAST: Phase 5A（分類）のみ。
                STANDARD: Phase 5A/5B/7 + 条件を満たした場合のみOpus/Audit昇格。
                DEEP: STANDARD + Phase 6（strategist常時）。
                AUDIT: DEEP + Phase 8 Audit常時実行。
            competitors_summary: Phase 6用の競合集計指標
                （{"competitor_a": {"avg_engagement_rate": ..., ...}, ...}）。
                省略時はPhase 6全体をスキップする
                （＝いちさんの15アカウントのような「自己ブランド内比較」の
                ケースでは、外部競合データが無いため既定でスキップされる）。

        Returns:
            Phase 0〜4の結果に加え、phase5a/phase5b/phase6/phase7/phase8の
            結果を含む dict。
        """
        resolved_mode = self.router.resolve_mode(explicit_mode=mode, deep=deep, audit=audit)

        base_result = self.run(
            canonical_name=canonical_name,
            target_type=target_type,
            raw_posts_by_account=raw_posts_by_account,
            company_name=company_name,
            followers_by_account=followers_by_account,
            extraction_method=extraction_method,
            source_type=source_type,
        )

        result = dict(base_result)
        result["mode"] = resolved_mode

        if base_result["blocked"]:
            result["phase5a"] = {"skipped": True, "reason": "blocked_by_policy_gate"}
            result["phase5b"] = {"skipped": True, "reason": "blocked_by_policy_gate"}
            result["phase6"] = {"skipped": True, "reason": "blocked_by_policy_gate"}
            result["phase7"] = {"skipped": True, "reason": "blocked_by_policy_gate"}
            result["phase8"] = {"skipped": True, "reason": "blocked_by_policy_gate"}
            return result

        accounts_output = base_result["accounts"]

        # ---------- Phase 5A: Content Classification ----------
        for account_result in accounts_output.values():
            posts = [p["post"] for p in account_result["posts"]]
            if not posts:
                continue
            classifications, _low_confidence = self.classifier.classify_posts(posts)
            for post_entry, classification in zip(account_result["posts"], classifications):
                post_entry["classification"] = classification.to_dict()
        self._log("phase5a_content_classification", f"mode={resolved_mode}")

        if resolved_mode == "fast":
            # FAST: Haikuの分類のみ。5B以降は実行しない（設計書 §21）。
            result["phase5b"] = {"skipped": True, "reason": "fast_mode"}
            result["phase6"] = {"skipped": True, "reason": "fast_mode"}
            result["phase7"] = {"skipped": True, "reason": "fast_mode"}
            result["phase8"] = {"skipped": True, "reason": "fast_mode"}
            result["accounts"] = accounts_output
            return result

        # ---------- Phase 5B: Pattern Intelligence / Viral Pattern Engine ----------
        all_posts = [p for a in accounts_output.values() for p in a["posts"]]
        groups = self.pattern_analyst.select_representative_samples(all_posts)
        pattern_insights = self.pattern_analyst.analyze_patterns(
            groups["top"], groups["middle"], groups["bottom"]
        )
        viral_pattern = self.pattern_analyst.build_viral_pattern_engine(groups["top"])
        self._log(
            "phase5b_pattern_intelligence",
            f"insights={len(pattern_insights)} top_n={len(groups['top'])}",
        )
        result["phase5b"] = {
            "insights": [i.to_dict() for i in pattern_insights],
            "viral_pattern": viral_pattern.to_dict(),
        }

        # ---------- Phase 6: Competitor Intelligence（任意：競合データがある場合のみ） ----------
        whitespace: List[str] = []
        if competitors_summary:
            target_summary = _aggregate_accounts_summary(accounts_output)
            profiles = compute_relative_power_profiles(
                {"target": target_summary, **competitors_summary}
            )
            comparison = self.competitor_analyst.analyze_competitors(profiles, target_key="target")
            escalate_opus = self.competitor_analyst.should_escalate_to_opus(
                competitor_count=len(competitors_summary),
                comparison=comparison,
                multi_platform_complexity=multi_platform_complexity,
            )
            opus_deep_dive = self.opus_strategist.deep_dive(comparison) if escalate_opus else None
            whitespace = comparison.whitespace

            result["phase6"] = {
                "power_profiles": {k: v.to_dict() for k, v in profiles.items()},
                "comparison": comparison.to_dict(),
                "escalated_to_opus": escalate_opus,
                "opus_deep_dive": opus_deep_dive.to_dict() if opus_deep_dive else None,
            }
            self._log(
                "phase6_competitor_intelligence",
                f"competitors={len(competitors_summary)} escalated_to_opus={escalate_opus}",
            )
        else:
            result["phase6"] = {"skipped": True, "reason": "no_competitors_summary_provided"}

        # ---------- Phase 7: Strategy Engine ----------
        opportunities = _build_opportunities(pattern_insights, whitespace)
        strategies = self.strategy_planner.generate_strategies(opportunities)
        strategies_output = []
        for strategy in strategies:
            escalate = self.strategy_planner.should_escalate_to_opus(
                strategy,
                business_impact_large=business_impact_large,
                multi_channel=multi_platform_complexity,
                is_executive_or_external_proposal=is_executive_or_external_proposal,
                user_requested_deep=(resolved_mode in ("deep", "audit")),
            )
            strategies_output.append({**strategy.to_dict(), "escalated_to_opus": escalate})
        result["phase7"] = {"strategies": strategies_output}
        self._log("phase7_strategy_engine", f"strategies={len(strategies_output)}")

        # ---------- Phase 8: Evaluator / Audit ----------
        claims = _build_claims_from_accounts(accounts_output)
        self_review = self.self_reviewer.review(claims)
        should_audit = self.audit_agent.should_trigger_audit(
            user_requested_audit=(resolved_mode == "audit"),
            final_quality_score=self_review.final_quality_score,
            executive_proposal=is_executive_or_external_proposal,
        )
        audit_result = self.audit_agent.audit(claims) if should_audit else None

        result["phase8"] = {
            "self_review": self_review.to_dict(),
            "audit_triggered": should_audit,
            "audit_result": audit_result.to_dict() if audit_result else None,
        }
        self._log("phase8_evaluator", f"audit_triggered={should_audit}")

        result["accounts"] = accounts_output
        result["trace"] = [t.to_dict() for t in self.trace]
        return result


# ==================== フルパイプライン用ヘルパー ====================

def _aggregate_accounts_summary(accounts_output: Dict[str, Dict]) -> Dict[str, Optional[float]]:
    """複数アカウントの実測値を1つの"target"集計指標へまとめる（Phase6用）"""
    engagement_rates, reach_effs, velocities = [], [], []
    hit_rates, viral_rates, total_posts = [], [], 0

    for account_result in accounts_output.values():
        total_posts += account_result.get("post_count", 0)
        hit_rates.append(account_result.get("hit_rate"))
        viral_rates.append(account_result.get("viral_rate"))
        for post_entry in account_result.get("posts", []):
            m = post_entry.get("metrics", {})
            if m.get("engagement_rate") is not None:
                engagement_rates.append(m["engagement_rate"])
            if m.get("reach_efficiency") is not None:
                reach_effs.append(m["reach_efficiency"])
            if m.get("velocity_per_hour") is not None:
                velocities.append(m["velocity_per_hour"])

    def _avg(values):
        clean = [v for v in values if v is not None]
        return round(mean(clean), 4) if clean else None

    return {
        "avg_engagement_rate": _avg(engagement_rates),
        "avg_reach_efficiency": _avg(reach_effs),
        "avg_velocity": _avg(velocities),
        "hit_rate": _avg(hit_rates),
        "viral_rate": _avg(viral_rates),
        "post_count": total_posts,
    }


def _build_opportunities(pattern_insights: List["PatternInsight"], whitespace: List[str]) -> List[Dict]:
    """Phase 5B/6の結果からPhase 7へ渡すOpportunity候補を組み立てる"""
    opportunities = []
    for i, insight in enumerate(pattern_insights):
        opportunities.append({
            "opportunity_id": f"pattern-{i + 1}",
            "evidence": [],  # フォールバックPatternInsightはEvidence IDを保持しないため空
            "context": insight.pattern,
            "opportunity_score": round(insight.confidence * 100, 1),
        })
    for ws in whitespace:
        opportunities.append({
            "opportunity_id": f"whitespace-{ws}",
            "evidence": [],
            "context": f"競合分析によるWhitespace候補: {ws}",
            "opportunity_score": 70.0,  # 目安値。実運用ではPhase6のconfidenceを反映すべき
        })
    return opportunities


def _build_claims_from_accounts(accounts_output: Dict[str, Dict]) -> List[Dict]:
    """Phase 2の claim_classification をPhase 8監査用のClaimリストへ変換する"""
    claims = []
    for account, account_result in accounts_output.items():
        for post_entry in account_result.get("posts", []):
            evidence = post_entry.get("evidence", {})
            classification = post_entry.get("claim_classification", {})
            claims.append({
                "claim_id": evidence.get("evidence_id"),
                "statement": f"{account}: {evidence.get('field_name')}={evidence.get('value')}",
                "evidence_ids": classification.get("supporting_evidence", []),
                "confidence": classification.get("confidence", 0.0),
                "counter_evidence": classification.get("counter_evidence", []),
            })
    return claims


if __name__ == "__main__":
    engine = KengoodEngineV2()

    sample_raw_posts = {
        "ichiaimarketer": [
            {
                "author": "ichiaimarketer",
                "text": "Claude Codeの新機能を試してみた",
                "likes": "1.2K",
                "retweets": "300",
                "replies": 45,
                "impressions": "80000",
                "url": "https://x.com/ichiaimarketer/status/1?utm_source=x",
                "timestamp": "2026-08-20T09:00:00Z",
            },
        ],
    }

    result = engine.run_full_pipeline(
        canonical_name="いちさん（株式会社PLai代表、AirCle代表）",
        target_type="creator",
        company_name="株式会社PLai",
        raw_posts_by_account=sample_raw_posts,
        followers_by_account={"ichiaimarketer": 15000},
        mode="standard",
    )

    print(json.dumps(result, ensure_ascii=False, indent=2))
