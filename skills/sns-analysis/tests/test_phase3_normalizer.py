#!/usr/bin/env python3
"""Phase 3: Normalizer の単体テスト"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from phase3_normalizer import Normalizer  # noqa: E402


class TestParseMetric(unittest.TestCase):
    def test_plain_number_string(self):
        self.assertEqual(Normalizer.parse_metric("3200"), 3200)

    def test_comma_separated(self):
        self.assertEqual(Normalizer.parse_metric("3,200"), 3200)

    def test_k_suffix(self):
        self.assertEqual(Normalizer.parse_metric("1.5K"), 1500)

    def test_m_suffix(self):
        self.assertEqual(Normalizer.parse_metric("1.2M"), 1_200_000)

    def test_man_suffix(self):
        self.assertEqual(Normalizer.parse_metric("1.5万"), 15000)

    def test_oku_suffix(self):
        self.assertEqual(Normalizer.parse_metric("2億"), 200_000_000)

    def test_int_passthrough(self):
        self.assertEqual(Normalizer.parse_metric(890), 890)

    def test_none_returns_none(self):
        self.assertIsNone(Normalizer.parse_metric(None))

    def test_empty_string_returns_none(self):
        self.assertIsNone(Normalizer.parse_metric(""))

    def test_garbage_returns_none(self):
        self.assertIsNone(Normalizer.parse_metric("not a number"))


class TestNormalizeTimestamp(unittest.TestCase):
    def test_iso_with_z(self):
        result = Normalizer.normalize_timestamp("2026-08-20T09:00:00Z")
        self.assertEqual(result, "2026-08-20T09:00:00+00:00")

    def test_x_api_v1_format(self):
        result = Normalizer.normalize_timestamp("Wed Oct 10 20:19:24 +0000 2018")
        self.assertEqual(result, "2018-10-10T20:19:24+00:00")

    def test_unix_seconds(self):
        result = Normalizer.normalize_timestamp(1755680400)
        self.assertTrue(result.startswith("2025-08-20"))

    def test_unix_milliseconds(self):
        result = Normalizer.normalize_timestamp(1755680400000)
        self.assertTrue(result.startswith("2025-08-20"))

    def test_space_separated_datetime(self):
        result = Normalizer.normalize_timestamp("2026-08-20 09:00:00")
        self.assertEqual(result, "2026-08-20T09:00:00+00:00")

    def test_none_returns_none(self):
        self.assertIsNone(Normalizer.normalize_timestamp(None))

    def test_garbage_returns_none(self):
        self.assertIsNone(Normalizer.normalize_timestamp("not a date"))


class TestNormalizeHandle(unittest.TestCase):
    def test_strips_at_and_lowercases(self):
        self.assertEqual(Normalizer.normalize_handle("@IchiAIMarketer"), "ichiaimarketer")

    def test_none_returns_none(self):
        self.assertIsNone(Normalizer.normalize_handle(None))


class TestNormalizeUrl(unittest.TestCase):
    def test_removes_tracking_params_and_fragment(self):
        result = Normalizer.normalize_url(
            "https://X.com/ichiaimarketer/status/123?utm_source=x&s=20#reply"
        )
        self.assertEqual(result, "https://x.com/ichiaimarketer/status/123")

    def test_strips_trailing_slash(self):
        self.assertEqual(Normalizer.normalize_url("https://example.com/path/"), "https://example.com/path")

    def test_none_returns_none(self):
        self.assertIsNone(Normalizer.normalize_url(None))


class TestNormalizePostAndDedupe(unittest.TestCase):
    def test_normalize_post_maps_all_fields(self):
        post = {
            "author": "@ichiaimarketer",
            "text": "  hello world  ",
            "likes": "1.5K",
            "retweets": "300",
            "replies": "45",
            "impressions": "80000",
            "url": "https://x.com/ichiaimarketer/status/1?utm_source=x",
            "timestamp": "2026-08-20T09:00:00Z",
        }
        normalized = Normalizer.normalize_post(post)
        self.assertEqual(normalized["author"], "ichiaimarketer")
        self.assertEqual(normalized["text"], "hello world")
        self.assertEqual(normalized["likes"], 1500)
        self.assertEqual(normalized["url"], "https://x.com/ichiaimarketer/status/1")

    def test_dedupe_by_author_and_url(self):
        posts = [
            {"author": "a", "url": "https://x.com/a/1", "text": "x"},
            {"author": "a", "url": "https://x.com/a/1", "text": "x duplicate"},
            {"author": "a", "url": "https://x.com/a/2", "text": "y"},
        ]
        deduped = Normalizer.dedupe_posts(posts)
        self.assertEqual(len(deduped), 2)

    def test_dedupe_fallback_to_text_when_no_url(self):
        posts = [
            {"author": "a", "url": None, "text": "same text"},
            {"author": "a", "url": None, "text": "same text"},
            {"author": "a", "url": None, "text": "different text"},
        ]
        deduped = Normalizer.dedupe_posts(posts)
        self.assertEqual(len(deduped), 2)


if __name__ == "__main__":
    unittest.main()
