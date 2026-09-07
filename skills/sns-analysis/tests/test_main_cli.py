#!/usr/bin/env python3
"""main.py（CLI）の単体テスト"""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import main  # noqa: E402


def _write_sample_input(tmp_dir: Path) -> Path:
    data = {
        "ichiaimarketer": [
            {
                "author": "ichiaimarketer",
                "text": "テスト投稿です",
                "likes": "100",
                "retweets": "10",
                "replies": 2,
                "impressions": "5000",
                "url": "https://x.com/ichiaimarketer/status/1",
                "timestamp": "2026-08-20T09:00:00Z",
            },
        ],
    }
    path = tmp_dir / "input.json"
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return path


class TestCliArgumentValidation(unittest.TestCase):
    def test_no_input_or_fetch_live_returns_error(self):
        exit_code = main.main(["いちさん"])
        self.assertEqual(exit_code, 1)

    def test_fetch_live_without_bearer_token_returns_error(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            exit_code = main.main(["いちさん", "--fetch-live", "--handles", "someone"])
            self.assertEqual(exit_code, 1)

    def test_fetch_live_without_handles_returns_error(self):
        with mock.patch.dict(os.environ, {"X_BEARER_TOKEN": "dummy"}, clear=False):
            exit_code = main.main(["いちさん", "--fetch-live"])
            self.assertEqual(exit_code, 1)

    def test_mode_and_deep_are_mutually_exclusive(self):
        with self.assertRaises(SystemExit):
            main.build_arg_parser().parse_args(
                ["いちさん", "--input", "x.json", "--mode", "fast", "--deep"]
            )


class TestCliRunWithSampleInput(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = Path(tempfile.mkdtemp())
        self.input_path = _write_sample_input(self.tmp_dir)
        self.output_path = self.tmp_dir / "output.json"

    def test_runs_end_to_end_with_no_llm_flag(self):
        exit_code = main.main([
            "いちさん", "--input", str(self.input_path),
            "--mode", "standard", "--no-llm", "--output", str(self.output_path),
        ])
        self.assertEqual(exit_code, 0)
        self.assertTrue(self.output_path.exists())

        result = json.loads(self.output_path.read_text(encoding="utf-8"))
        self.assertEqual(result["mode"], "standard")
        self.assertFalse(result["blocked"])

    def test_fast_mode_skips_llm_phases(self):
        exit_code = main.main([
            "いちさん", "--input", str(self.input_path),
            "--mode", "fast", "--no-llm", "--output", str(self.output_path),
        ])
        self.assertEqual(exit_code, 0)
        result = json.loads(self.output_path.read_text(encoding="utf-8"))
        self.assertTrue(result["phase7"]["skipped"])

    def test_audit_flag_triggers_audit(self):
        exit_code = main.main([
            "いちさん", "--input", str(self.input_path),
            "--audit", "--no-llm", "--output", str(self.output_path),
        ])
        self.assertEqual(exit_code, 0)
        result = json.loads(self.output_path.read_text(encoding="utf-8"))
        self.assertEqual(result["mode"], "audit")
        self.assertTrue(result["phase8"]["audit_triggered"])

    def test_empty_input_file_returns_error(self):
        empty_path = self.tmp_dir / "empty.json"
        empty_path.write_text("{}", encoding="utf-8")
        exit_code = main.main(["いちさん", "--input", str(empty_path), "--no-llm"])
        self.assertEqual(exit_code, 1)


if __name__ == "__main__":
    unittest.main()
