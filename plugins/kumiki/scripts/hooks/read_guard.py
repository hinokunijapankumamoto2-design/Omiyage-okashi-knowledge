#!/usr/bin/env python3
"""PreToolUse guard: replace the first bulk read of a huge file with its map.

Reading a 40k-token file to find one section is the most common way an agent
burns a context window. This hook intercepts that read *once* and hands back
the file's outline instead, so the next move can be a targeted read.

It is deliberately a one-shot per file per session. A second Read of the same
path goes straight through: the guard's job is to make the cheap option
visible, not to argue with a decision that has already been made.

Behaviour
    off switch          KUMIKI_READ_GUARD=off
    threshold           KUMIKI_READ_GUARD_TOKENS (default 25000 est. tokens)
    fails open          any error at all exits 0 and allows the read
"""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

DEFAULT_THRESHOLD = 25_000
OUTLINE_CHAR_CAP = 1800


def allow() -> None:
    sys.exit(0)


def state_path(session_id: str) -> str:
    base = os.environ.get("CLAUDE_PLUGIN_DATA") or os.path.join(
        os.path.expanduser("~"), ".cache", "kumiki")
    directory = os.path.join(base, "read-guard")
    os.makedirs(directory, exist_ok=True)
    safe = "".join(c for c in (session_id or "nosession") if c.isalnum() or c in "-_")
    return os.path.join(directory, (safe or "nosession") + ".json")


def already_seen(session_id: str, path: str) -> bool:
    """Record ``path`` for this session; True when it was already recorded."""
    store = state_path(session_id)
    try:
        with open(store, "r", encoding="utf-8") as handle:
            seen = set(json.load(handle))
    except (OSError, ValueError):
        seen = set()
    if path in seen:
        return True
    seen.add(path)
    if len(seen) > 500:
        seen = set(list(seen)[-500:])
    try:
        with open(store, "w", encoding="utf-8") as handle:
            json.dump(sorted(seen), handle)
    except OSError:
        pass
    return False


def main() -> None:
    if os.environ.get("KUMIKI_READ_GUARD", "").lower() in {"off", "0", "false", "no"}:
        allow()

    try:
        payload = json.load(sys.stdin)
    except (ValueError, OSError):
        allow()

    if payload.get("tool_name") != "Read":
        allow()

    tool_input = payload.get("tool_input") or {}
    path = tool_input.get("file_path") or ""
    # A read that already declares a window is a targeted read; leave it alone.
    if not path or tool_input.get("limit") or tool_input.get("offset"):
        allow()
    if not os.path.isfile(path):
        allow()

    from kumikilib import thrift, tokens  # imported late so failures fail open

    if not thrift.is_text_file(path):
        allow()

    try:
        threshold = int(os.environ.get("KUMIKI_READ_GUARD_TOKENS", DEFAULT_THRESHOLD))
    except ValueError:
        threshold = DEFAULT_THRESHOLD

    # Cheap pre-filter: no file under threshold bytes can exceed threshold tokens.
    try:
        if os.path.getsize(path) < threshold:
            allow()
    except OSError:
        allow()

    estimate = tokens.estimate_file(path)
    if estimate < threshold:
        allow()

    if already_seen(payload.get("session_id", ""), path):
        allow()

    try:
        structure = thrift.outline(path)
    except (OSError, ValueError):
        allow()

    lines = []
    for section in structure["sections"]:
        lines.append("{}L{}-{} ({} tok) {}".format(
            "  " * (section["level"] - 1), section["line"], section["end_line"],
            tokens.human(section["est_tokens"]), section["title"]))
    outline_text = "\n".join(lines)
    if len(outline_text) > OUTLINE_CHAR_CAP:
        outline_text = outline_text[:OUTLINE_CHAR_CAP] + "\n… (outline truncated)"

    if not outline_text:
        # No structure to offer, so the guard has nothing better to suggest.
        allow()

    reason = (
        "Kumiki read guard: {path} is ~{cost} tokens ({lines} lines). "
        "Here is its map instead — read only the span you need with "
        "Read(offset=…, limit=…), or `kumiki thrift slice {path} \"<heading>\"`.\n\n"
        "{outline}\n\n"
        "If you genuinely need the whole file, issue the same Read again and it "
        "will go through (this guard fires once per file per session)."
    ).format(path=path, cost=tokens.human(estimate),
             lines=structure["lines"], outline=outline_text)

    json.dump({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }, sys.stdout, ensure_ascii=False)
    sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # A guard that breaks a session is worse than no guard.
        sys.exit(0)
