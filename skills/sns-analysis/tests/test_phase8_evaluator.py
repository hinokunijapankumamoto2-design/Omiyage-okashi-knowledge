#!/usr/bin/env python3
"""Phase 8: Evaluator（Self Review / Audit）の単体テスト"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from phase8_evaluator import AuditAgent, SonnetSelfReviewer  # noqa: E402


class TestStructuralFallbackAudit(unittest.TestCase):
    def setUp(self):
        self.reviewer = SonnetSelfReviewer()  # client=None
        self.agent = AuditAgent()  # challenger_fn=None

    def test_missing_evidence_is_rejected(self):
        result = self.reviewer.review([{"claim_id": "c1", "evidence_ids": [], "confidence": 0.9}])
        claim = result.claims[0]
        self.assertEqual(claim["verdict"], "REJECT")
        self.assertIn("c1", result.unsupported_claims)

    def test_counter_evidence_with_high_confidence_is_challenged(self):
        result = self.reviewer.review([
            {"claim_id": "c1", "evidence_ids": ["ev-1"], "confidence": 0.9, "counter_evidence": ["ev-2"]}
        ])
        self.assertEqual(result.claims[0]["verdict"], "CHALLENGE")

    def test_low_confidence_is_unknown(self):
        result = self.reviewer.review([{"claim_id": "c1", "evidence_ids": ["ev-1"], "confidence": 0.2}])
        self.assertEqual(result.claims[0]["verdict"], "UNKNOWN")

    def test_well_formed_claim_is_supported(self):
        result = self.reviewer.review([{"claim_id": "c1", "evidence_ids": ["ev-1"], "confidence": 0.9}])
        self.assertEqual(result.claims[0]["verdict"], "SUPPORT")

    def test_quality_score_drops_with_critical_issues(self):
        clean_result = self.reviewer.review([{"claim_id": "c1", "evidence_ids": ["ev-1"], "confidence": 0.9}])
        bad_result = self.reviewer.review([{"claim_id": "c2", "evidence_ids": [], "confidence": 0.9}])
        self.assertGreater(clean_result.final_quality_score, bad_result.final_quality_score)

    def test_empty_claims_list(self):
        result = self.reviewer.review([])
        self.assertEqual(result.claims, [])
        self.assertEqual(result.final_quality_score, 100.0)

    def test_agent_audit_uses_same_fallback_logic(self):
        result = self.agent.audit([{"claim_id": "c1", "evidence_ids": [], "confidence": 0.9}])
        self.assertEqual(result.analysis_source, "fallback_heuristic")
        self.assertIn("c1", result.unsupported_claims)


class TestShouldTriggerAudit(unittest.TestCase):
    def setUp(self):
        self.agent = AuditAgent()

    def test_triggers_on_explicit_request(self):
        self.assertTrue(self.agent.should_trigger_audit(user_requested_audit=True))

    def test_triggers_on_low_quality_score(self):
        self.assertTrue(self.agent.should_trigger_audit(final_quality_score=70))

    def test_no_trigger_on_high_quality_score(self):
        self.assertFalse(self.agent.should_trigger_audit(final_quality_score=95))

    def test_triggers_on_low_evidence_score(self):
        self.assertTrue(self.agent.should_trigger_audit(evidence_score_for_important_strategy=60))

    def test_triggers_on_conflicting_expert_conclusions(self):
        self.assertTrue(self.agent.should_trigger_audit(conflicting_expert_conclusions=True))

    def test_triggers_on_executive_proposal(self):
        self.assertTrue(self.agent.should_trigger_audit(executive_proposal=True))

    def test_triggers_on_external_publication(self):
        self.assertTrue(self.agent.should_trigger_audit(external_publication=True))

    def test_triggers_on_high_value_deal(self):
        self.assertTrue(self.agent.should_trigger_audit(high_value_deal=True))

    def test_no_trigger_by_default(self):
        self.assertFalse(self.agent.should_trigger_audit())


class TestAuditAgentWithChallengerFn(unittest.TestCase):
    def test_challenger_fn_response_is_parsed(self):
        response_json = (
            '{"audit_score": 40, "claims": [{"claim_id": "c1", "verdict": "REJECT", '
            '"confidence": 0.1, "reason": "no evidence", "missing_evidence": ["ev-x"], '
            '"alternative_explanation": []}], "critical_issues": ["c1"], '
            '"unsupported_claims": ["c1"], "recommended_revisions": ["fix c1"], '
            '"final_quality_score": 40}'
        )

        def fake_challenger(system_prompt, user_content):
            return response_json

        agent = AuditAgent(challenger_fn=fake_challenger)
        result = agent.audit([{"claim_id": "c1", "evidence_ids": [], "confidence": 0.9}])
        self.assertEqual(result.analysis_source, "llm")
        self.assertEqual(result.final_quality_score, 40)
        self.assertEqual(result.claims[0]["verdict"], "REJECT")

    def test_challenger_fn_exception_does_not_propagate(self):
        def raising_challenger(system_prompt, user_content):
            raise RuntimeError("network error")

        agent = AuditAgent(challenger_fn=raising_challenger)
        result = agent.audit([{"claim_id": "c1", "evidence_ids": ["ev-1"], "confidence": 0.9}])
        self.assertEqual(result.analysis_source, "challenger_error")

    def test_challenger_fn_unparseable_response(self):
        def bad_challenger(system_prompt, user_content):
            return "not json at all"

        agent = AuditAgent(challenger_fn=bad_challenger)
        result = agent.audit([{"claim_id": "c1", "evidence_ids": ["ev-1"], "confidence": 0.9}])
        self.assertEqual(result.analysis_source, "challenger_parse_error")


if __name__ == "__main__":
    unittest.main()
