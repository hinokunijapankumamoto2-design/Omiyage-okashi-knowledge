#!/usr/bin/env python3
"""Phase 0: Target Resolver の単体テスト（標準ライブラリ unittest のみ使用）"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from phase0_target_resolver import TargetResolver, TargetType  # noqa: E402


class TestTargetResolver(unittest.TestCase):
    def setUp(self):
        self.resolver = TargetResolver()

    def test_high_confidence_with_multiple_known_accounts(self):
        identity = self.resolver.resolve(
            canonical_name="いちさん（株式会社PLai代表、AirCle代表）",
            target_type=TargetType.CREATOR.value,
            company_name="株式会社PLai",
            known_accounts={"x": [
                "ichiaimarketer", "ClaudeCode_love", "AiAircle34052",
                "Codestudiopjbk", "obsidianstudio9",
            ]},
        )
        self.assertGreaterEqual(identity.identity_confidence, 0.90)
        self.assertFalse(identity.needs_escalation)
        self.assertEqual(len(identity.candidate_accounts["x"]), 5)

    def test_missing_canonical_name_flags_unknown(self):
        identity = self.resolver.resolve(canonical_name="", target_type=TargetType.COMPANY.value)
        self.assertIn("canonical_name", identity.unknown)
        self.assertTrue(identity.needs_escalation)

    def test_missing_target_type_flags_unknown(self):
        identity = self.resolver.resolve(canonical_name="トヨタ")
        self.assertIn("target_type", identity.unknown)

    def test_invalid_x_handle_triggers_escalation(self):
        identity = self.resolver.resolve(
            canonical_name="テスト企業",
            target_type=TargetType.COMPANY.value,
            known_accounts={"x": ["this handle has spaces and is way too long"]},
        )
        self.assertTrue(identity.needs_escalation)
        self.assertEqual(identity.candidate_accounts["x"], [])

    def test_at_prefix_is_stripped(self):
        identity = self.resolver.resolve(
            canonical_name="テスト",
            target_type=TargetType.BRAND.value,
            known_accounts={"x": ["@some_handle"]},
        )
        self.assertEqual(identity.candidate_accounts["x"], ["some_handle"])

    def test_duplicate_handles_in_same_platform_are_deduped(self):
        identity = self.resolver.resolve(
            canonical_name="テスト",
            target_type=TargetType.BRAND.value,
            known_accounts={"x": ["same_handle", "@same_handle"]},
        )
        self.assertEqual(identity.candidate_accounts["x"], ["same_handle"])

    def test_cross_platform_duplicate_flags_escalation(self):
        identity = self.resolver.resolve(
            canonical_name="テスト",
            target_type=TargetType.BRAND.value,
            known_accounts={"x": ["shared_name"], "youtube": ["shared_name"]},
        )
        self.assertTrue(identity.needs_escalation)
        self.assertTrue(
            any("duplicate_handles_across_platforms" in r for r in identity.escalation_reasons)
        )

    def test_no_accounts_gives_low_confidence(self):
        identity = self.resolver.resolve(
            canonical_name="トヨタ", target_type=TargetType.COMPANY.value
        )
        self.assertLess(identity.identity_confidence, 0.90)
        self.assertTrue(identity.needs_escalation)

    def test_confidence_bounded_between_0_and_1(self):
        identity = self.resolver.resolve(
            canonical_name="テスト",
            target_type=TargetType.COMPANY.value,
            company_name="テスト株式会社",
            known_accounts={"x": [f"handle{i}" for i in range(20)]},
        )
        self.assertLessEqual(identity.identity_confidence, 1.0)


if __name__ == "__main__":
    unittest.main()
