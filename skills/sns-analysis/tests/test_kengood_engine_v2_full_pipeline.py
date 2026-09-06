#!/usr/bin/env python3
"""kengood_engine_v2.KengoodEngineV2.run_full_pipeline() の単体テスト"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from kengood_engine_v2 import KengoodEngineV2  # noqa: E402


def _sample_raw_posts():
    return {
        "ichiaimarketer": [
            {
                "author": "ichiaimarketer",
                "text": "Claude Codeの新機能を試してみた",
                "likes": "1.2K",
                "retweets": "300",
                "replies": 45,
                "impressions": "80000",
                "url": "https://x.com/ichiaimarketer/status/1",
                "timestamp": "2026-08-20T09:00:00Z",
            },
            {
                "author": "ichiaimarketer",
                "text": "AirCleコミュニティの近況はいかがですか？",
                "likes": "80",
                "retweets": "10",
                "replies": 2,
                "impressions": "5000",
                "url": "https://x.com/ichiaimarketer/status/2",
                "timestamp": "2026-08-21T09:00:00Z",
            },
        ],
    }


class TestRunFullPipelineFastMode(unittest.TestCase):
    def test_fast_mode_only_runs_phase5a(self):
        engine = KengoodEngineV2()
        result = engine.run_full_pipeline(
            canonical_name="いちさん", target_type="creator",
            raw_posts_by_account=_sample_raw_posts(), mode="fast",
        )
        self.assertEqual(result["mode"], "fast")
        # Phase 5A分類は付与されている
        first_post = result["accounts"]["ichiaimarketer"]["posts"][0]
        self.assertIn("classification", first_post)
        # 5B以降はスキップ
        self.assertTrue(result["phase5b"]["skipped"])
        self.assertTrue(result["phase6"]["skipped"])
        self.assertTrue(result["phase7"]["skipped"])
        self.assertTrue(result["phase8"]["skipped"])


class TestRunFullPipelineStandardMode(unittest.TestCase):
    def setUp(self):
        self.engine = KengoodEngineV2()
        self.result = self.engine.run_full_pipeline(
            canonical_name="いちさん（株式会社PLai代表、AirCle代表）",
            target_type="creator",
            company_name="株式会社PLai",
            raw_posts_by_account=_sample_raw_posts(),
            mode="standard",
        )

    def test_not_blocked(self):
        self.assertFalse(self.result["blocked"])

    def test_phase5a_classification_attached_to_every_post(self):
        posts = self.result["accounts"]["ichiaimarketer"]["posts"]
        self.assertEqual(len(posts), 2)
        for p in posts:
            self.assertIn("classification", p)

    def test_phase5b_produces_insights_and_viral_pattern(self):
        self.assertIn("insights", self.result["phase5b"])
        self.assertIn("viral_pattern", self.result["phase5b"])

    def test_phase6_skipped_without_competitors(self):
        self.assertTrue(self.result["phase6"]["skipped"])
        self.assertEqual(self.result["phase6"]["reason"], "no_competitors_summary_provided")

    def test_phase7_produces_strategies(self):
        self.assertIn("strategies", self.result["phase7"])
        self.assertGreaterEqual(len(self.result["phase7"]["strategies"]), 1)

    def test_phase8_self_review_present(self):
        self.assertIn("self_review", self.result["phase8"])
        self.assertIn("audit_triggered", self.result["phase8"])

    def test_trace_includes_all_executed_phases(self):
        phases = [t["phase"] for t in self.result["trace"]]
        self.assertIn("phase0_target_resolver", phases)
        self.assertIn("phase05_source_policy_gate", phases)
        self.assertIn("phase2_4_evidence_normalize_metrics", phases)
        self.assertIn("phase5a_content_classification", phases)
        self.assertIn("phase5b_pattern_intelligence", phases)
        self.assertIn("phase7_strategy_engine", phases)
        self.assertIn("phase8_evaluator", phases)


class TestRunFullPipelineWithCompetitors(unittest.TestCase):
    def test_phase6_runs_when_competitors_summary_provided(self):
        engine = KengoodEngineV2()
        result = engine.run_full_pipeline(
            canonical_name="いちさん", target_type="creator",
            raw_posts_by_account=_sample_raw_posts(),
            mode="standard",
            competitors_summary={
                "competitor_a": {"avg_engagement_rate": 5.0, "viral_rate": 0.3, "hit_rate": 0.5, "post_count": 100},
            },
        )
        self.assertFalse(result["phase6"].get("skipped", False))
        self.assertIn("comparison", result["phase6"])
        self.assertIn("power_profiles", result["phase6"])


class TestRunFullPipelineBlocked(unittest.TestCase):
    def test_blocked_pipeline_skips_all_llm_phases(self):
        engine = KengoodEngineV2()
        result = engine.run_full_pipeline(
            canonical_name="第三者アカウント", target_type="creator",
            raw_posts_by_account={},  # known_accounts無し = creatorはブロックされる
            mode="standard",
        )
        self.assertTrue(result["blocked"])
        for phase_key in ("phase5a", "phase5b", "phase6", "phase7", "phase8"):
            self.assertTrue(result[phase_key]["skipped"])


class TestRunFullPipelineAuditMode(unittest.TestCase):
    def test_audit_mode_always_triggers_audit(self):
        engine = KengoodEngineV2()
        result = engine.run_full_pipeline(
            canonical_name="いちさん", target_type="creator",
            raw_posts_by_account=_sample_raw_posts(), mode="audit",
        )
        self.assertTrue(result["phase8"]["audit_triggered"])
        self.assertIsNotNone(result["phase8"]["audit_result"])


if __name__ == "__main__":
    unittest.main()
