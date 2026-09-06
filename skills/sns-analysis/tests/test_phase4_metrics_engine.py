#!/usr/bin/env python3
"""Phase 4: Metrics Engine の単体テスト"""

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from phase4_metrics_engine import MetricsEngine  # noqa: E402


class TestBasicRates(unittest.TestCase):
    def test_engagement_count(self):
        self.assertEqual(MetricsEngine.calculate_engagement_count(10, 5, 2), 17)

    def test_engagement_rate(self):
        rate = MetricsEngine.calculate_engagement_rate(likes=10, retweets=5, replies=5, impressions=200)
        self.assertEqual(rate, 10.0)  # (10+5+5)/200*100

    def test_engagement_rate_zero_impressions(self):
        self.assertEqual(
            MetricsEngine.calculate_engagement_rate(10, 5, 5, 0), 0.0
        )

    def test_like_rate(self):
        self.assertEqual(MetricsEngine.calculate_like_rate(50, 1000), 5.0)

    def test_reach_efficiency(self):
        self.assertEqual(MetricsEngine.calculate_reach_efficiency(30000, 15000), 2.0)

    def test_reach_efficiency_no_followers(self):
        self.assertIsNone(MetricsEngine.calculate_reach_efficiency(30000, 0))

    def test_follower_normalized_performance(self):
        self.assertAlmostEqual(
            MetricsEngine.calculate_follower_normalized_performance(150, 1000), 0.15
        )


class TestVelocity(unittest.TestCase):
    def test_velocity_per_hour(self):
        velocity = MetricsEngine.calculate_velocity(
            engagement_count=200,
            post_timestamp="2026-08-20T00:00:00+00:00",
            as_of=datetime(2026, 8, 20, 10, 0, 0, tzinfo=timezone.utc),
        )
        self.assertEqual(velocity, 20.0)  # 200 engagements / 10 hours

    def test_velocity_none_without_timestamp(self):
        self.assertIsNone(MetricsEngine.calculate_velocity(200, None))

    def test_velocity_uses_min_hours_floor(self):
        velocity = MetricsEngine.calculate_velocity(
            engagement_count=100,
            post_timestamp="2026-08-20T09:59:00+00:00",
            as_of=datetime(2026, 8, 20, 10, 0, 0, tzinfo=timezone.utc),
            min_hours=1.0,
        )
        self.assertEqual(velocity, 100.0)  # 1分しか経過していなくても min_hours=1で除算


class TestPercentiles(unittest.TestCase):
    def setUp(self):
        self.values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    def test_median(self):
        self.assertAlmostEqual(MetricsEngine.calculate_median(self.values), 5.5)

    def test_percentiles_monotonic(self):
        p = MetricsEngine.calculate_percentiles(self.values)
        self.assertLessEqual(p["p25"], p["p50"])
        self.assertLessEqual(p["p50"], p["p75"])
        self.assertLessEqual(p["p75"], p["p90"])
        self.assertLessEqual(p["p90"], p["p95"])

    def test_percentile_empty_list(self):
        self.assertEqual(MetricsEngine.percentile([], 50), 0.0)

    def test_percentile_single_value(self):
        self.assertEqual(MetricsEngine.percentile([42], 50), 42.0)


class TestHitAndViralRate(unittest.TestCase):
    def test_hit_rate_above_median(self):
        values = [1, 1, 1, 10, 10]
        # median = 1 -> 値が中央値を超えるのは 10 の2件
        self.assertEqual(MetricsEngine.calculate_hit_rate(values), 0.4)

    def test_hit_rate_empty(self):
        self.assertEqual(MetricsEngine.calculate_hit_rate([]), 0.0)

    def test_viral_rate_detects_outliers(self):
        values = [1, 1, 1, 1, 50]  # median=1, 50 >= 1*5
        self.assertEqual(MetricsEngine.calculate_viral_rate(values, multiplier=5.0), 0.2)

    def test_viral_rate_no_outliers(self):
        values = [1, 1, 1, 1, 2]
        self.assertEqual(MetricsEngine.calculate_viral_rate(values, multiplier=5.0), 0.0)


class TestBuildEngagementMetrics(unittest.TestCase):
    def test_full_build(self):
        metrics = MetricsEngine.build_engagement_metrics(
            likes=100, retweets=20, replies=5, impressions=10000,
            followers=5000, post_timestamp="2026-08-20T00:00:00+00:00",
            as_of=datetime(2026, 8, 20, 5, 0, 0, tzinfo=timezone.utc),
        )
        self.assertEqual(metrics.engagement_count, 125)
        self.assertEqual(metrics.engagement_rate, 1.25)
        self.assertEqual(metrics.reach_efficiency, 2.0)
        self.assertEqual(metrics.velocity_per_hour, 25.0)


if __name__ == "__main__":
    unittest.main()
