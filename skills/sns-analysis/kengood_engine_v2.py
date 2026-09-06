#!/usr/bin/env python3
"""
KENGOOD SNS Intelligence Engine v2
統合レイヤー（Phase 0 〜 Phase 4 基盤層）

Phase 0    : Target Resolver        (phase0_target_resolver.py)
Phase 0.5  : Source Policy Gate     (phase05_source_policy_gate.yaml)
Phase 1    : Source Gateway         (scraper.py / analyzer.py - 既存実装)
Phase 2    : Evidence Engine        (phase2_evidence_engine.py)
Phase 3    : Normalize              (phase3_normalizer.py)
Phase 4    : Metrics Engine         (phase4_metrics_engine.py)

Phase 5以降（Content Classification 〜 Strategy Engine などLLM統合層）は
本ファイルのスコープ外（KENGOOD_SNS_Intelligence_Engine_v2.md 参照）。

本ファイルはPhase 1（実データ取得）そのものは行わない。
scraper.py / analyzer.py で取得した生データ（PostMetrics.to_dict() 相当）を
raw_posts_by_account として受け取り、Phase 0.5 のゲートチェックを経て
Phase 2〜4 を適用し、エビデンストレース付きのJSONを組み立てる。
"""

import json
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import yaml

try:
    from .phase0_target_resolver import TargetResolver, TargetIdentity
    from .phase2_evidence_engine import EvidenceEngine
    from .phase3_normalizer import Normalizer
    from .phase4_metrics_engine import MetricsEngine
except ImportError:
    from phase0_target_resolver import TargetResolver, TargetIdentity
    from phase2_evidence_engine import EvidenceEngine
    from phase3_normalizer import Normalizer
    from phase4_metrics_engine import MetricsEngine


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

    def __init__(self, policy_path: Optional[Path] = None):
        self.resolver = TargetResolver()
        self.policy_gate = SourcePolicyGate(policy_path)
        self.evidence_engine = EvidenceEngine()
        self.trace: List[PhaseTraceEntry] = []

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

    result = engine.run(
        canonical_name="いちさん（株式会社PLai代表、AirCle代表）",
        target_type="creator",
        company_name="株式会社PLai",
        raw_posts_by_account=sample_raw_posts,
        followers_by_account={"ichiaimarketer": 15000},
    )

    print(json.dumps(result, ensure_ascii=False, indent=2))
