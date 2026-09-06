#!/usr/bin/env python3
"""Phase 5B: Pattern Intelligence / Viral Pattern Engine の単体テスト"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from phase5b_pattern_intelligence import SonnetPatternAnalyst  # noqa: E402


def _make_post(i, engagement_rate, pillar="unknown", fmt="unknown"):
    return {
        "post": {"text": f"post {i}"},
        "classification": {"content_pillar": pillar, "format": fmt},
        "metrics": {"engagement_rate": engagement_rate},
    }


class TestSelectRepresentativeSamples(unittest.TestCase):
    def test_splits_into_top_middle_bottom(self):
        posts = [_make_post(i, engagement_rate=float(10 - i)) for i in range(10)]
        groups = SonnetPatternAnalyst.select_representative_samples(
            posts, top_pct=20, bottom_pct=20, middle_sample_size=10
        )
        self.assertEqual(len(groups["top"]), 2)
        self.assertEqual(len(groups["bottom"]), 2)
        self.assertEqual(len(groups["middle"]), 6)

    def test_top_has_highest_engagement(self):
        posts = [_make_post(i, engagement_rate=float(10 - i)) for i in range(10)]
        groups = SonnetPatternAnalyst.select_representative_samples(posts, top_pct=10, bottom_pct=10)
        self.assertEqual(groups["top"][0]["metrics"]["engagement_rate"], 10.0)

    def test_bottom_has_lowest_engagement(self):
        posts = [_make_post(i, engagement_rate=float(10 - i)) for i in range(10)]
        groups = SonnetPatternAnalyst.select_representative_samples(posts, top_pct=10, bottom_pct=10)
        self.assertEqual(groups["bottom"][-1]["metrics"]["engagement_rate"], 1.0)

    def test_empty_input(self):
        groups = SonnetPatternAnalyst.select_representative_samples([])
        self.assertEqual(groups, {"top": [], "middle": [], "bottom": []})

    def test_middle_sample_capped(self):
        posts = [_make_post(i, engagement_rate=float(100 - i)) for i in range(100)]
        groups = SonnetPatternAnalyst.select_representative_samples(
            posts, top_pct=10, bottom_pct=10, middle_sample_size=5
        )
        self.assertEqual(len(groups["middle"]), 5)

    def test_small_dataset_does_not_overlap_top_and_bottom(self):
        posts = [_make_post(i, engagement_rate=float(3 - i)) for i in range(3)]
        groups = SonnetPatternAnalyst.select_representative_samples(posts, top_pct=50, bottom_pct=50)
        top_ids = {id(p) for p in groups["top"]}
        bottom_ids = {id(p) for p in groups["bottom"]}
        self.assertEqual(top_ids & bottom_ids, set())


class TestAnalyzePatternsFallback(unittest.TestCase):
    def setUp(self):
        self.analyst = SonnetPatternAnalyst()  # client=None

    def test_detects_distinguishing_attribute(self):
        top = [_make_post(i, 10.0, pillar="education") for i in range(5)]
        bottom = [_make_post(i, 1.0, pillar="promotion") for i in range(5)]
        insights = self.analyst.analyze_patterns(top, [], bottom)
        self.assertTrue(any("education" in i.pattern for i in insights))
        for insight in insights:
            self.assertEqual(insight.analysis_source, "fallback_heuristic")
            self.assertIn("因果関係は未検証", insight.possible_explanation)

    def test_no_difference_yields_no_insight_for_that_field(self):
        top = [_make_post(i, 10.0, pillar="education") for i in range(5)]
        bottom = [_make_post(i, 1.0, pillar="education") for i in range(5)]
        insights = self.analyst.analyze_patterns(top, [], bottom)
        self.assertFalse(any("content_pillar=education" in i.pattern for i in insights))

    def test_empty_groups_return_no_insights(self):
        insights = self.analyst.analyze_patterns([], [], [])
        self.assertEqual(insights, [])


class TestViralPatternEngineFallback(unittest.TestCase):
    def setUp(self):
        self.analyst = SonnetPatternAnalyst()

    def test_reproducible_when_consistent_pattern(self):
        top = [_make_post(i, 10.0, pillar="education", fmt="question") for i in range(5)]
        result = self.analyst.build_viral_pattern_engine(top)
        self.assertEqual(result.factors["content_pillar"], "education")
        self.assertEqual(result.factors["format"], "question")
        self.assertEqual(result.reproducibility, "reproducible")

    def test_empty_top_posts_is_unknown(self):
        result = self.analyst.build_viral_pattern_engine([])
        self.assertEqual(result.reproducibility, "unknown")

    def test_inconsistent_pattern_is_not_falsely_reproducible(self):
        top = [
            _make_post(0, 10.0, pillar="education", fmt="question"),
            _make_post(1, 9.0, pillar="promotion", fmt="statement"),
        ]
        result = self.analyst.build_viral_pattern_engine(top)
        self.assertEqual(result.factors["content_pillar"], "unknown")
        self.assertEqual(result.factors["format"], "unknown")


class TestAnalyzePatternsWithFakeClient(unittest.TestCase):
    def test_llm_path_parses_insights(self):
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
                    '{"insights": [{"observed_fact": "f", "pattern": "p", '
                    '"possible_explanation": "e", "counter_evidence": [], '
                    '"reproducibility": "reproducible", "confidence": 0.8}]}'
                )

        analyst = SonnetPatternAnalyst(client=_FakeClient())
        insights = analyst.analyze_patterns([_make_post(0, 10.0)], [], [_make_post(1, 1.0)])
        self.assertEqual(len(insights), 1)
        self.assertEqual(insights[0].analysis_source, "llm")
        self.assertEqual(insights[0].confidence, 0.8)


if __name__ == "__main__":
    unittest.main()
