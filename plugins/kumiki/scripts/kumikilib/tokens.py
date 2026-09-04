"""Token estimation that does not lie about Japanese text.

Character-count heuristics built for English (``len(text) / 4``) undercount
Japanese by a factor of three or more, which is exactly the failure mode that
makes context budgets useless for bilingual work. This module splits text into
CJK and non-CJK runs and applies a different ratio to each.

The result is an *estimate*, not a tokenizer. Measured against Claude's
tokenizer on mixed ja/en technical prose it lands within roughly +/-15%.
Use it for budgeting decisions, never for billing.
"""

from __future__ import annotations

import re
from typing import Dict, Iterable, List, Tuple

# Average characters consumed per token, per script family.
CJK_CHARS_PER_TOKEN = 1.05
LATIN_CHARS_PER_TOKEN = 3.8

# Ranges treated as "one character is roughly one token".
_CJK_RANGES: Tuple[Tuple[int, int], ...] = (
    (0x2E80, 0x2FFF),    # CJK radicals, Kangxi
    (0x3000, 0x303F),    # CJK symbols and punctuation
    (0x3040, 0x309F),    # Hiragana
    (0x30A0, 0x30FF),    # Katakana
    (0x3400, 0x4DBF),    # CJK unified ideographs extension A
    (0x4E00, 0x9FFF),    # CJK unified ideographs
    (0xA000, 0xA4CF),    # Yi
    (0xAC00, 0xD7AF),    # Hangul syllables
    (0xF900, 0xFAFF),    # CJK compatibility ideographs
    (0xFE30, 0xFE4F),    # CJK compatibility forms
    (0xFF00, 0xFFEF),    # Halfwidth and fullwidth forms
    (0x1F300, 0x1FAFF),  # Emoji and pictographs
    (0x20000, 0x2FA1F),  # CJK extensions B-F
)


def is_cjk(ch: str) -> bool:
    """True when ``ch`` belongs to a script where one char is about one token."""
    code = ord(ch)
    for low, high in _CJK_RANGES:
        if low <= code <= high:
            return True
        if code < low:
            break
    return False


def count_scripts(text: str) -> Dict[str, int]:
    """Return the raw character split used by :func:`estimate`."""
    cjk = 0
    for ch in text:
        if is_cjk(ch):
            cjk += 1
    return {"total": len(text), "cjk": cjk, "latin": len(text) - cjk}


def estimate(text: str) -> int:
    """Estimate the token cost of ``text``.

    >>> estimate("hello world") > 0
    True
    >>> estimate("お土産お菓子") > estimate("omiyage")
    True
    """
    if not text:
        return 0
    counts = count_scripts(text)
    cjk_tokens = counts["cjk"] / CJK_CHARS_PER_TOKEN
    latin_tokens = counts["latin"] / LATIN_CHARS_PER_TOKEN
    return max(1, int(round(cjk_tokens + latin_tokens)))


def estimate_file(path: str, encoding: str = "utf-8") -> int:
    """Estimate the token cost of a file, returning 0 for unreadable files."""
    try:
        with open(path, "r", encoding=encoding, errors="replace") as handle:
            return estimate(handle.read())
    except (OSError, UnicodeError):
        return 0


def human(n: int) -> str:
    """Render a token count compactly: 1234 -> '1.2k'."""
    if n < 1000:
        return str(n)
    if n < 1_000_000:
        return "{:.1f}k".format(n / 1000.0)
    return "{:.2f}M".format(n / 1_000_000.0)


_SENTENCE_SPLIT = re.compile(r"(?<=[。．！？!?\n])")


def split_sentences(text: str) -> List[str]:
    """Split on Japanese and ASCII sentence terminators, keeping the terminator."""
    parts = [p for p in _SENTENCE_SPLIT.split(text) if p.strip()]
    return parts


def truncate_to_tokens(text: str, budget: int, marker: str = "\n…[truncated]") -> str:
    """Trim ``text`` so its estimate fits ``budget``, cutting at sentence bounds."""
    if budget <= 0:
        return ""
    if estimate(text) <= budget:
        return text
    kept: List[str] = []
    used = 0
    reserve = estimate(marker)
    for sentence in split_sentences(text):
        cost = estimate(sentence)
        if used + cost + reserve > budget:
            break
        kept.append(sentence)
        used += cost
    if not kept:
        # No sentence boundary fit; fall back to a proportional character cut.
        ratio = budget / max(1, estimate(text))
        cut = max(1, int(len(text) * ratio * 0.9))
        return text[:cut] + marker
    return "".join(kept) + marker


def pack(items: Iterable[Tuple[str, str]], budget: int) -> Tuple[List[Tuple[str, str]], List[str]]:
    """Greedily fit ``(label, text)`` pairs into ``budget`` tokens.

    Returns ``(kept, dropped_labels)``. Order is preserved: callers are expected
    to sort by relevance before calling, because this function does not rank.
    """
    kept: List[Tuple[str, str]] = []
    dropped: List[str] = []
    used = 0
    for label, text in items:
        cost = estimate(text)
        if used + cost <= budget:
            kept.append((label, text))
            used += cost
        else:
            dropped.append(label)
    return kept, dropped
