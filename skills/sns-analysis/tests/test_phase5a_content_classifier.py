#!/usr/bin/env python3
"""Phase 5A: Content Classifier の単体テスト"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from phase5a_content_classifier import (  # noqa: E402
    CONFIDENCE_ESCALATION_THRESHOLD,
    HaikuContentClassifier,
)


class _FakeTextBlock:
    def __init__(self, text):
        self.text = text


class _FakeResponse:
    def __init__(self, text):
        self.content = [_FakeTextBlock(text)]


class _FakeAnthropicClient:
    """messages.create() を模した高confidenceな固定応答を返すフェイククライアント"""

    def __init__(self, response_json: str):
        self._response_json = response_json
        self.messages = self

    def create(self, **kwargs):
        return _FakeResponse(self._response_json)


class TestHaikuContentClassifierFallback(unittest.TestCase):
    """client未指定時のフォールバック（オフライン検証用）"""

    def setUp(self):
        self.classifier = HaikuContentClassifier()  # client=None

    def test_fallback_confidence_below_escalation_threshold(self):
        result = self.classifier.classify_post({"text": "テスト投稿", "author": "a"})
        self.assertLess(result.confidence, CONFIDENCE_ESCALATION_THRESHOLD)
        self.assertEqual(result.classification_source, "fallback_heuristic")

    def test_question_format_detected(self):
        result = self.classifier.classify_post({"text": "なぜこれが重要なのか？", "author": "a"})
        self.assertEqual(result.format, "question")

    def test_url_triggers_link_click_cta(self):
        result = self.classifier.classify_post({"text": "詳細はこちら https://example.com", "author": "a"})
        self.assertEqual(result.cta, "link_click")

    def test_no_url_means_no_cta(self):
        result = self.classifier.classify_post({"text": "普通の投稿です", "author": "a"})
        self.assertIsNone(result.cta)

    def test_ai_keyword_detected_as_topic(self):
        result = self.classifier.classify_post({"text": "Claude Codeを使ってみた", "author": "a"})
        self.assertIn("AI", result.topic)

    def test_classify_posts_returns_all_as_low_confidence(self):
        posts = [{"text": "a"}, {"text": "b"}, {"text": "c"}]
        classified, low_confidence = self.classifier.classify_posts(posts)
        self.assertEqual(len(classified), 3)
        self.assertEqual(len(low_confidence), 3)  # フォールバックは常に閾値未満


class TestHaikuContentClassifierWithClient(unittest.TestCase):
    """client（フェイクLLM）注入時の実LLM経路"""

    def test_high_confidence_llm_response_is_parsed(self):
        response_json = """{
            "post_id": "p1",
            "topic": ["AI"],
            "content_pillar": "education",
            "hook": "curiosity",
            "format": "question",
            "narrative": "problem_solution",
            "emotion": ["curiosity"],
            "audience": ["developers"],
            "problem": "非効率な開発フロー",
            "promise": "時短",
            "proof": null,
            "cta": "link_click",
            "novelty": "high",
            "authority": "medium",
            "commercial_intent": "low",
            "confidence": 0.92
        }"""
        classifier = HaikuContentClassifier(client=_FakeAnthropicClient(response_json))
        result = classifier.classify_post({"text": "なぜ非効率なのか？", "author": "a"}, post_id="p1")

        self.assertEqual(result.classification_source, "llm")
        self.assertEqual(result.confidence, 0.92)
        self.assertEqual(result.content_pillar, "education")
        self.assertNotIn(result, [])  # 型が壊れていないことの簡易確認

    def test_low_confidence_llm_response_is_escalated(self):
        response_json = '{"post_id": "p2", "confidence": 0.4}'
        classifier = HaikuContentClassifier(client=_FakeAnthropicClient(response_json))
        classified, low_confidence = classifier.classify_posts(
            [{"text": "曖昧な投稿", "author": "a"}]
        )
        self.assertEqual(len(low_confidence), 1)

    def test_unparseable_llm_response_yields_zero_confidence(self):
        classifier = HaikuContentClassifier(client=_FakeAnthropicClient("これはJSONではありません"))
        result = classifier.classify_post({"text": "投稿", "author": "a"})
        self.assertEqual(result.confidence, 0.0)
        self.assertEqual(result.classification_source, "llm_parse_error")

    def test_client_exception_does_not_propagate(self):
        class _RaisingClient:
            class messages:
                @staticmethod
                def create(**kwargs):
                    raise RuntimeError("API error")

        classifier = HaikuContentClassifier(client=_RaisingClient())
        result = classifier.classify_post({"text": "投稿", "author": "a"})
        self.assertEqual(result.confidence, 0.0)
        self.assertEqual(result.classification_source, "llm_error")


if __name__ == "__main__":
    unittest.main()
