#!/usr/bin/env python3
"""Phase 6: Competitor Intelligence / Opus Strategic Deep Dive の単体テスト"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from phase6_competitor_intelligence import (  # noqa: E402
    AccountPowerProfile,
    CompetitorAnalyst,
    CompetitorComparison,
    OpusStrategist,
    compute_relative_power_profiles,
)


class TestComputeRelativePowerProfiles(unittest.TestCase):
    def test_normalizes_between_0_and_1(self):
        summary = {
            "target": {"avg_engagement_rate": 1.0},
            "a": {"avg_engagement_rate": 5.0},
            "b": {"avg_engagement_rate": 0.0},
        }
        profiles = compute_relative_power_profiles(summary)
        self.assertEqual(profiles["a"].engagement_power, 1.0)
        self.assertEqual(profiles["b"].engagement_power, 0.0)
        self.assertEqual(profiles["target"].engagement_power, 0.2)

    def test_missing_metric_stays_none_not_zero(self):
        summary = {"target": {}, "a": {"avg_engagement_rate": 5.0}}
        profiles = compute_relative_power_profiles(summary)
        # target に avg_engagement_rate が無い -> 比較対象が1件のみなので両方None
        self.assertIsNone(profiles["target"].engagement_power)
        self.assertIsNone(profiles["a"].engagement_power)

    def test_external_data_fields_always_none(self):
        summary = {"target": {"avg_engagement_rate": 1.0}, "a": {"avg_engagement_rate": 2.0}}
        profiles = compute_relative_power_profiles(summary)
        self.assertIsNone(profiles["target"].authority)
        self.assertIsNone(profiles["target"].community)

    def test_all_equal_values_get_midpoint_score(self):
        summary = {"target": {"avg_engagement_rate": 2.0}, "a": {"avg_engagement_rate": 2.0}}
        profiles = compute_relative_power_profiles(summary)
        self.assertEqual(profiles["target"].engagement_power, 0.5)
        self.assertEqual(profiles["a"].engagement_power, 0.5)


class TestCompetitorAnalystFallback(unittest.TestCase):
    def setUp(self):
        self.analyst = CompetitorAnalyst()  # client=None

    def test_raises_on_missing_target_key(self):
        summary = {"a": {"avg_engagement_rate": 1.0}}
        profiles = compute_relative_power_profiles(summary)
        with self.assertRaises(ValueError):
            self.analyst.analyze_competitors(profiles, target_key="target")

    def test_target_strength_detected_when_best(self):
        summary = {
            "target": {"avg_engagement_rate": 10.0},
            "a": {"avg_engagement_rate": 1.0},
        }
        profiles = compute_relative_power_profiles(summary)
        comparison = self.analyst.analyze_competitors(profiles, target_key="target")
        self.assertIn("engagement_power", comparison.target_strength)
        self.assertEqual(comparison.analysis_source, "fallback_heuristic")

    def test_target_weakness_detected_when_worst(self):
        summary = {
            "target": {"avg_engagement_rate": 0.1},
            "a": {"avg_engagement_rate": 10.0},
        }
        profiles = compute_relative_power_profiles(summary)
        comparison = self.analyst.analyze_competitors(profiles, target_key="target")
        self.assertIn("engagement_power", comparison.target_weakness)

    def test_whitespace_when_everyone_is_weak(self):
        # min-max正規化を経由すると必ず誰かが1.0になってしまうため、
        # ここではPower Profileを直接構築して比較ロジック単体を検証する。
        profiles = {
            "target": AccountPowerProfile(viral_power=0.1),
            "a": AccountPowerProfile(viral_power=0.15),
            "b": AccountPowerProfile(viral_power=0.2),
        }
        comparison = self.analyst.analyze_competitors(profiles, target_key="target")
        # target・競合とも低スコア（誰も強くない）領域はwhitespace候補に入る
        self.assertIn("viral_power", comparison.whitespace)


class TestShouldEscalateToOpus(unittest.TestCase):
    def setUp(self):
        self.analyst = CompetitorAnalyst()

    def test_escalates_when_many_competitors_and_no_whitespace(self):
        comparison = CompetitorComparison(whitespace=[], confidence=0.9)
        self.assertTrue(self.analyst.should_escalate_to_opus(competitor_count=5, comparison=comparison))

    def test_no_escalation_when_few_competitors_and_confident(self):
        comparison = CompetitorComparison(whitespace=["x"], confidence=0.9)
        self.assertFalse(self.analyst.should_escalate_to_opus(competitor_count=2, comparison=comparison))

    def test_escalates_on_low_confidence(self):
        comparison = CompetitorComparison(whitespace=["x"], confidence=0.5)
        self.assertTrue(self.analyst.should_escalate_to_opus(competitor_count=2, comparison=comparison))

    def test_escalates_on_multi_platform_flag(self):
        comparison = CompetitorComparison(whitespace=["x"], confidence=0.95)
        self.assertTrue(
            self.analyst.should_escalate_to_opus(
                competitor_count=1, comparison=comparison, multi_platform_complexity=True
            )
        )


class TestOpusStrategistFallback(unittest.TestCase):
    def test_deep_dive_uses_whitespace_and_strength_as_candidates(self):
        comparison = CompetitorComparison(whitespace=["viral_power"], target_strength=["content_power"])
        strategist = OpusStrategist()  # client=None
        result = strategist.deep_dive(comparison)
        self.assertIn("viral_power", result.candidates_considered)
        self.assertIn("content_power", result.candidates_considered)
        self.assertEqual(result.analysis_source, "fallback_heuristic")

    def test_fallback_never_fabricates_high_confidence(self):
        comparison = CompetitorComparison(whitespace=["a", "b"])
        strategist = OpusStrategist()
        result = strategist.deep_dive(comparison)
        self.assertEqual(result.confidence, 0.0)

    def test_no_candidates_yields_empty_finalists(self):
        comparison = CompetitorComparison()
        strategist = OpusStrategist()
        result = strategist.deep_dive(comparison)
        self.assertEqual(result.finalists, [])


if __name__ == "__main__":
    unittest.main()
