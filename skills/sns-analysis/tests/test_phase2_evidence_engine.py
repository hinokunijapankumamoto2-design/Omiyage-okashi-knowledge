#!/usr/bin/env python3
"""Phase 2: Evidence Engine の単体テスト"""

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from phase2_evidence_engine import EvidenceEngine, ExtractionMethod, ClaimType  # noqa: E402


class TestEvidenceEngine(unittest.TestCase):
    def setUp(self):
        self.engine = EvidenceEngine()
        self.sample_post = {
            "author": "ichiaimarketer",
            "timestamp": "2026-08-20T09:00:00+00:00",
            "url": "https://x.com/ichiaimarketer/status/1",
            "likes": 1200,
        }

    def _build_evidence(self, extraction_method, source_decision="API_ONLY"):
        return self.engine.build_evidence(
            evidence_id="ev-1",
            platform="x",
            raw_post=self.sample_post,
            field_name="likes",
            extraction_method=extraction_method,
            source_decision=source_decision,
        )

    def test_extract_metadata(self):
        meta = self.engine.extract_metadata(self.sample_post)
        self.assertEqual(meta["author"], "ichiaimarketer")
        self.assertEqual(meta["post_timestamp"], "2026-08-20T09:00:00+00:00")
        self.assertEqual(meta["source_url"], "https://x.com/ichiaimarketer/status/1")

    def test_no_evidence_is_unknown(self):
        classification = self.engine.classify_claim(claim_value=100, evidence_list=[])
        self.assertEqual(classification.claim_type, ClaimType.UNKNOWN.value)
        self.assertEqual(classification.confidence, 0.0)

    def test_official_api_evidence_is_fact(self):
        evidence = self._build_evidence(ExtractionMethod.OFFICIAL_API.value)
        classification = self.engine.classify_claim(claim_value=1200, evidence_list=[evidence])
        self.assertEqual(classification.claim_type, ClaimType.FACT.value)
        self.assertFalse(classification.needs_review)

    def test_single_low_confidence_evidence_is_hypothesis(self):
        evidence = self._build_evidence(ExtractionMethod.MANUAL_INPUT.value, source_decision="MANUAL_ONLY")
        classification = self.engine.classify_claim(claim_value=1200, evidence_list=[evidence])
        self.assertEqual(classification.claim_type, ClaimType.HYPOTHESIS.value)
        self.assertTrue(classification.needs_review)

    def test_contradicting_evidence_prefers_unknown_over_hypothesis(self):
        evidence = self._build_evidence(ExtractionMethod.OFFICIAL_API.value)
        classification = self.engine.classify_claim(
            claim_value=1200, evidence_list=[evidence], contradicting_values=[5000]
        )
        self.assertEqual(classification.claim_type, ClaimType.UNKNOWN.value)
        self.assertTrue(classification.needs_review)

    def test_small_numeric_deviation_is_not_contradiction(self):
        evidence = self._build_evidence(ExtractionMethod.OFFICIAL_API.value)
        classification = self.engine.classify_claim(
            claim_value=1200, evidence_list=[evidence], contradicting_values=[1210]
        )
        self.assertEqual(classification.claim_type, ClaimType.FACT.value)

    def test_score_evidence_empty_list_is_all_zero(self):
        score = self.engine.score_evidence([])
        self.assertEqual(score.overall, 0.0)

    def test_score_evidence_official_api_has_high_authority_and_certainty(self):
        evidence = self._build_evidence(ExtractionMethod.OFFICIAL_API.value)
        score = self.engine.score_evidence([evidence], expected_source_count=1)
        self.assertEqual(score.extraction_certainty, 1.0)
        self.assertEqual(score.source_authority, 1.0)
        self.assertEqual(score.coverage, 1.0)

    def test_freshness_decays_with_age(self):
        old_post = dict(self.sample_post, timestamp="2020-01-01T00:00:00+00:00")
        old_evidence = self.engine.build_evidence(
            evidence_id="ev-old", platform="x", raw_post=old_post,
            field_name="likes", extraction_method=ExtractionMethod.OFFICIAL_API.value,
            source_decision="API_ONLY",
        )
        fresh_evidence = self._build_evidence(ExtractionMethod.OFFICIAL_API.value)

        old_score = self.engine.score_evidence(
            [old_evidence], as_of=datetime(2026, 9, 6, tzinfo=timezone.utc)
        )
        fresh_score = self.engine.score_evidence(
            [fresh_evidence], as_of=datetime(2026, 9, 6, tzinfo=timezone.utc)
        )
        self.assertLess(old_score.freshness, fresh_score.freshness)


if __name__ == "__main__":
    unittest.main()
