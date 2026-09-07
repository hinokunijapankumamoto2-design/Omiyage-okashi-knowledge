#!/usr/bin/env python3
"""anthropic_client.py の単体テスト"""

import os
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from anthropic_client import build_anthropic_client, try_build_anthropic_client  # noqa: E402


class TestBuildAnthropicClient(unittest.TestCase):
    def test_missing_api_key_raises(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(RuntimeError) as ctx:
                build_anthropic_client()
            self.assertIn("APIキー", str(ctx.exception))

    def test_missing_package_raises_when_key_present(self):
        # anthropicパッケージ未インストール環境では、キーがあってもImportErrorになる
        with mock.patch.dict(os.environ, {"ANTHROPIC_API_KEY": "sk-ant-dummy"}, clear=False):
            with self.assertRaises(RuntimeError) as ctx:
                build_anthropic_client()
            self.assertIn("anthropic", str(ctx.exception))

    def test_explicit_api_key_argument_used_over_env(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            # パッケージ未インストールのためRuntimeErrorになるが、
            # 「APIキー未設定」エラーにはならない（キー自体は渡っている）ことを確認
            with self.assertRaises(RuntimeError) as ctx:
                build_anthropic_client(api_key="sk-ant-explicit")
            self.assertIn("anthropic", str(ctx.exception))
            self.assertNotIn("設定されていません", str(ctx.exception))


class TestTryBuildAnthropicClient(unittest.TestCase):
    def test_returns_none_instead_of_raising(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertIsNone(try_build_anthropic_client())

    def test_returns_none_when_package_missing_even_with_key(self):
        with mock.patch.dict(os.environ, {"ANTHROPIC_API_KEY": "sk-ant-dummy"}, clear=False):
            self.assertIsNone(try_build_anthropic_client())


if __name__ == "__main__":
    unittest.main()
