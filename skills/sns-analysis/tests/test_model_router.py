#!/usr/bin/env python3
"""Model Router の単体テスト"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from model_router import ModelRouter  # noqa: E402


class TestResolveMode(unittest.TestCase):
    def setUp(self):
        self.router = ModelRouter()

    def test_default_mode_is_standard(self):
        self.assertEqual(self.router.resolve_mode(), "standard")

    def test_explicit_mode(self):
        self.assertEqual(self.router.resolve_mode(explicit_mode="fast"), "fast")

    def test_deep_flag_wins_over_explicit_mode(self):
        self.assertEqual(self.router.resolve_mode(explicit_mode="fast", deep=True), "deep")

    def test_audit_flag_wins_over_deep_flag(self):
        self.assertEqual(self.router.resolve_mode(deep=True, audit=True), "audit")

    def test_invalid_mode_raises(self):
        with self.assertRaises(ValueError):
            self.router.resolve_mode(explicit_mode="not_a_real_mode")


class TestModeConfig(unittest.TestCase):
    def setUp(self):
        self.router = ModelRouter()

    def test_fast_mode_only_uses_classifier(self):
        self.assertTrue(self.router.is_role_enabled("fast", "classifier"))
        self.assertFalse(self.router.is_role_enabled("fast", "analyst"))
        self.assertFalse(self.router.is_role_enabled("fast", "strategist"))
        self.assertFalse(self.router.is_role_enabled("fast", "challenger"))

    def test_audit_mode_uses_everything(self):
        for role in ("classifier", "analyst", "strategist", "challenger"):
            self.assertTrue(self.router.is_role_enabled("audit", role))

    def test_standard_mode_strategist_is_conditional(self):
        self.assertTrue(self.router.is_role_conditional("standard", "strategist"))
        self.assertFalse(self.router.is_role_enabled("standard", "strategist"))

    def test_unknown_mode_raises(self):
        with self.assertRaises(ValueError):
            self.router.get_mode_config("nonexistent")


class TestModelConfig(unittest.TestCase):
    def test_get_known_role(self):
        config = ModelRouter().get_model_config("classifier")
        self.assertEqual(config["provider"], "anthropic")

    def test_unknown_role_raises(self):
        with self.assertRaises(KeyError):
            ModelRouter().get_model_config("not_a_role")


class TestEscalation(unittest.TestCase):
    def setUp(self):
        self.router = ModelRouter()

    def test_classifier_escalates_below_threshold(self):
        self.assertTrue(self.router.should_escalate_classifier_to_analyst(0.5))
        self.assertFalse(self.router.should_escalate_classifier_to_analyst(0.9))

    def test_analyst_escalates_below_threshold(self):
        self.assertTrue(self.router.should_escalate_analyst_to_strategist(0.8))
        self.assertFalse(self.router.should_escalate_analyst_to_strategist(0.95))

    def test_challenger_escalates_on_conflicting_evidence(self):
        self.assertTrue(self.router.should_escalate_strategist_to_challenger(conflicting_evidence=True))

    def test_challenger_escalates_on_low_quality(self):
        self.assertTrue(self.router.should_escalate_strategist_to_challenger(final_quality_score=50))
        self.assertFalse(self.router.should_escalate_strategist_to_challenger(final_quality_score=95))

    def test_challenger_escalates_on_external_publication(self):
        self.assertTrue(self.router.should_escalate_strategist_to_challenger(external_publication=True))

    def test_challenger_no_escalation_by_default(self):
        self.assertFalse(self.router.should_escalate_strategist_to_challenger())


if __name__ == "__main__":
    unittest.main()
