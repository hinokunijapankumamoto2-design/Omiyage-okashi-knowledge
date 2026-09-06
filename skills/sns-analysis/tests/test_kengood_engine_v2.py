#!/usr/bin/env python3
"""統合レイヤー（Phase 0〜4 / Source Policy Gate）の単体テスト"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from kengood_engine_v2 import KengoodEngineV2, SourcePolicyGate  # noqa: E402


class TestSourcePolicyGate(unittest.TestCase):
    def setUp(self):
        self.gate = SourcePolicyGate()

    def test_known_source_type_decision(self):
        decision = self.gate.decide("x_api_v2_oauth")
        self.assertEqual(decision["decision"], "API_ONLY")

    def test_unknown_source_type_falls_back(self):
        decision = self.gate.decide("some_undefined_source")
        self.assertEqual(decision["decision"], "MANUAL_ONLY")

    def test_block_decision_for_personal_account_without_consent(self):
        decision = self.gate.decide("personal_account_without_consent")
        self.assertEqual(decision["decision"], "BLOCK")

    def test_creator_requires_self_managed_confirmation(self):
        self.assertTrue(self.gate.requires_self_managed_confirmation("creator"))

    def test_company_does_not_require_self_managed_confirmation(self):
        self.assertFalse(self.gate.requires_self_managed_confirmation("company"))


class TestKengoodEngineV2(unittest.TestCase):
    def setUp(self):
        self.engine = KengoodEngineV2()
        self.raw_posts = {
            "ichiaimarketer": [
                {
                    "author": "ichiaimarketer",
                    "text": "sample post",
                    "likes": "1.2K",
                    "retweets": "300",
                    "replies": 45,
                    "impressions": "80000",
                    "url": "https://x.com/ichiaimarketer/status/1",
                    "timestamp": "2026-08-20T09:00:00Z",
                },
            ],
        }

    def test_full_pipeline_runs_and_is_not_blocked(self):
        result = self.engine.run(
            canonical_name="いちさん（株式会社PLai代表、AirCle代表）",
            target_type="creator",
            company_name="株式会社PLai",
            raw_posts_by_account=self.raw_posts,
        )
        self.assertFalse(result["blocked"])
        self.assertIn("ichiaimarketer", result["accounts"])
        self.assertEqual(result["accounts"]["ichiaimarketer"]["post_count"], 1)

    def test_pipeline_produces_evidence_trace_per_post(self):
        result = self.engine.run(
            canonical_name="いちさん（株式会社PLai代表、AirCle代表）",
            target_type="creator",
            raw_posts_by_account=self.raw_posts,
        )
        post_result = result["accounts"]["ichiaimarketer"]["posts"][0]
        self.assertIn("evidence", post_result)
        self.assertIn("evidence_score", post_result)
        self.assertIn("claim_classification", post_result)
        self.assertIn("metrics", post_result)

    def test_creator_without_known_accounts_is_blocked(self):
        result = self.engine.run(
            canonical_name="第三者アカウント",
            target_type="creator",
            raw_posts_by_account={},
        )
        self.assertTrue(result["blocked"])
        self.assertEqual(result["authorization"]["reason"], "personal_account_without_consent")

    def test_trace_records_all_phases(self):
        result = self.engine.run(
            canonical_name="いちさん（株式会社PLai代表、AirCle代表）",
            target_type="creator",
            raw_posts_by_account=self.raw_posts,
        )
        phases = [t["phase"] for t in result["trace"]]
        self.assertEqual(
            phases,
            ["phase0_target_resolver", "phase05_source_policy_gate", "phase2_4_evidence_normalize_metrics"],
        )

    def test_deterministic_output_for_same_input(self):
        result1 = self.engine.run(
            canonical_name="いちさん（株式会社PLai代表、AirCle代表）",
            target_type="creator",
            raw_posts_by_account=self.raw_posts,
        )
        result2 = self.engine.run(
            canonical_name="いちさん（株式会社PLai代表、AirCle代表）",
            target_type="creator",
            raw_posts_by_account=self.raw_posts,
        )
        # captured_at/timestamp を除いた計算結果部分は再現可能であること
        self.assertEqual(
            result1["accounts"]["ichiaimarketer"]["posts"][0]["metrics"],
            result2["accounts"]["ichiaimarketer"]["posts"][0]["metrics"],
        )
        self.assertEqual(
            result1["accounts"]["ichiaimarketer"]["posts"][0]["claim_classification"],
            result2["accounts"]["ichiaimarketer"]["posts"][0]["claim_classification"],
        )


if __name__ == "__main__":
    unittest.main()
