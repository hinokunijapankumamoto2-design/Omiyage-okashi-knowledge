#!/usr/bin/env python3
"""PostToolUse ledger: remember which URLs actually entered this session.

`/kumiki:weave` uses this to reconstruct provenance for claims that arrived
through WebFetch or WebSearch rather than through `kumiki gather`, so a note
built mid-conversation can still be sourced.

Writes one JSON object per line to
``$CLAUDE_PLUGIN_DATA/ledger/YYYY-MM-DD.jsonl``. Never blocks, never prints,
never fails a tool call. Set ``KUMIKI_LEDGER=off`` to disable.
"""

from __future__ import annotations

import json
import os
import sys
import time


def main() -> None:
    if os.environ.get("KUMIKI_LEDGER", "").lower() in {"off", "0", "false", "no"}:
        return
    try:
        payload = json.load(sys.stdin)
    except (ValueError, OSError):
        return

    tool = payload.get("tool_name", "")
    if tool not in {"WebFetch", "WebSearch"}:
        return
    tool_input = payload.get("tool_input") or {}

    entry = {
        "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "session_id": payload.get("session_id", ""),
        "tool": tool,
        "url": tool_input.get("url", ""),
        "query": tool_input.get("query", ""),
        "prompt": (tool_input.get("prompt") or "")[:200],
        "cwd": payload.get("cwd", ""),
    }
    if not entry["url"] and not entry["query"]:
        return

    base = os.environ.get("CLAUDE_PLUGIN_DATA") or os.path.join(
        os.path.expanduser("~"), ".cache", "kumiki")
    directory = os.path.join(base, "ledger")
    try:
        os.makedirs(directory, exist_ok=True)
        path = os.path.join(directory, time.strftime("%Y-%m-%d") + ".jsonl")
        with open(path, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except OSError:
        return


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
