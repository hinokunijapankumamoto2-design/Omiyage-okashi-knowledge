#!/usr/bin/env python3
"""Phase 7: Strategy Engine の単体テスト"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from phase7_strategy_engine import Strategy, StrategyPlanner  # noqa: E402


class TestStrategyPlannerFallback(unittest.TestCase):
    def setUp(self):
        self.planner = StrategyPlanner()  # client=None
        self.opportunities = [
            {"opportunity_id": "op-1", "evidence": ["ev-1"], "opportunity_score": 60.0},
        ]

    def test_fallback_preserves_evidence_and_score(self):
        strategies = self.planner.generate_strategies(self.opportunities)
        self.assertEqual(len(strategies), 1)
        self.assertEqual(strategies[0].evidence, ["ev-1"])
        self.assertEqual(strategies[0].opportunity_score, 60.0)

    def test_fallback_does_not_fabricate_insight(self):
        strategies = self.planner.generate_strategies(self.opportunities)
        self.assertIn("unknown", strategies[0].insight)
        self.assertEqual(strategies[0].analysis_source, "fallback_heuristic")

    def test_empty_opportunities_returns_empty_list(self):
        self.assertEqual(self.planner.generate_strategies([]), [])


class TestShouldEscalateToOpus(unittest.TestCase):
    def setUp(self):
        self.planner = StrategyPlanner()

    def test_escalates_on_high_opportunity_and_business_impact(self):
        strategy = Strategy(opportunity_score=85.0)
        self.assertTrue(
            self.planner.should_escalate_to_opus(strategy, business_impact_large=True)
        )

    def test_no_escalation_when_high_score_but_low_business_impact(self):
        strategy = Strategy(opportunity_score=85.0)
        self.assertFalse(
            self.planner.should_escalate_to_opus(strategy, business_impact_large=False)
        )

    def test_escalates_on_long_duration(self):
        strategy = Strategy(opportunity_score=10.0)
        self.assertTrue(self.planner.should_escalate_to_opus(strategy, duration_days=90))

    def test_no_escalation_on_short_duration(self):
        strategy = Strategy(opportunity_score=10.0)
        self.assertFalse(self.planner.should_escalate_to_opus(strategy, duration_days=10))

    def test_escalates_on_multi_channel(self):
        strategy = Strategy()
        self.assertTrue(self.planner.should_escalate_to_opus(strategy, multi_channel=True))

    def test_escalates_on_executive_proposal(self):
        strategy = Strategy()
        self.assertTrue(
            self.planner.should_escalate_to_opus(strategy, is_executive_or_external_proposal=True)
        )

    def test_escalates_on_user_requested_deep(self):
        strategy = Strategy()
        self.assertTrue(self.planner.should_escalate_to_opus(strategy, user_requested_deep=True))

    def test_no_escalation_by_default(self):
        strategy = Strategy(opportunity_score=None)
        self.assertFalse(self.planner.should_escalate_to_opus(strategy))


class TestStrategyPlannerWithFakeClient(unittest.TestCase):
    def test_llm_path_parses_strategies(self):
        class _FakeTextBlock:
            def __init__(self, text):
                self.text = text

        class _FakeResponse:
            def __init__(self, text):
                self.content = [_FakeTextBlock(text)]

        class _FakeClient:
            def __init__(self):
                self.messages = self

            def create(self, **kwargs):
                return _FakeResponse(
                    '{"strategies": [{"evidence": ["ev-1"], "insight": "i", '
                    '"hypothesis": "h", "action": "a", "frequency": "weekly", '
                    '"duration": "30 days", "kpi": "engagement_rate", '
                    '"success_threshold": "2%", "stop_condition": "no lift after 30 days", '
                    '"risk": "low"}]}'
                )

        planner = StrategyPlanner(client=_FakeClient())
        strategies = planner.generate_strategies(
            [{"opportunity_id": "op-1", "evidence": ["ev-1"], "opportunity_score": 70.0}]
        )
        self.assertEqual(len(strategies), 1)
        self.assertEqual(strategies[0].analysis_source, "llm")
        self.assertEqual(strategies[0].frequency, "weekly")
        self.assertEqual(strategies[0].opportunity_score, 70.0)


if __name__ == "__main__":
    unittest.main()
