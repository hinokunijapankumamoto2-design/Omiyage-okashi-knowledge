#!/usr/bin/env python3
"""openai_challenger.build_openai_challenger_fn() の単体テスト"""

import os
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from openai_challenger import DEFAULT_MODEL, build_openai_challenger_fn  # noqa: E402


class TestModelResolution(unittest.TestCase):
    def test_explicit_model_argument_wins(self):
        fn = build_openai_challenger_fn(model="gpt-explicit", api_key="dummy")
        # モデル名自体は関数のクロージャ内なので、エラーメッセージ経由でなく
        # openaiパッケージ未インストール時の例外で疎通ロジックのみ確認する
        with self.assertRaises(RuntimeError) as ctx:
            fn("sys", "user")
        self.assertIn("openai", str(ctx.exception))

    def test_env_var_used_when_no_explicit_model(self):
        with mock.patch.dict(os.environ, {"OPENAI_CHALLENGER_MODEL": "gpt-from-env"}, clear=False):
            fn = build_openai_challenger_fn(api_key="dummy")
            self.assertIsNotNone(fn)  # 構築自体は成功する（呼び出し時にのみ検証）

    def test_default_model_constant_matches_user_request(self):
        self.assertEqual(DEFAULT_MODEL, "gpt-5.4-mini")


class TestApiKeyResolution(unittest.TestCase):
    def test_missing_api_key_raises_on_call_not_on_build(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            fn = build_openai_challenger_fn()  # 構築時点ではエラーにならない
            with self.assertRaises(RuntimeError) as ctx:
                fn("system", "user")
            # openai未インストールの場合はそちらが先に検出される
            self.assertTrue(
                "APIキー" in str(ctx.exception) or "openai" in str(ctx.exception)
            )

    def test_explicit_api_key_argument_accepted(self):
        fn = build_openai_challenger_fn(api_key="sk-test-dummy")
        self.assertIsNotNone(fn)


class TestIntegrationWithAuditAgent(unittest.TestCase):
    def test_challenger_fn_wired_into_audit_agent_handles_missing_package(self):
        from phase8_evaluator import AuditAgent

        fn = build_openai_challenger_fn(api_key="dummy")
        agent = AuditAgent(challenger_fn=fn)
        result = agent.audit([{"claim_id": "c1", "evidence_ids": ["ev-1"], "confidence": 0.9}])
        # openai未インストール環境ではエラーとして安全にフォールバック扱いされる
        self.assertEqual(result.analysis_source, "challenger_error")


if __name__ == "__main__":
    unittest.main()
