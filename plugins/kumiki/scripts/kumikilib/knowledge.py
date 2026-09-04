"""The knowledge layer: structure, provenance, and an audit that fails loudly.

A knowledge base rots in predictable ways — claims lose their sources, notes
stop being linked from anywhere, figures go stale, one note swells until nobody
reads it. :func:`audit` checks for exactly those, because a base nobody trusts
is worse than no base: it launders guesses into citations.
"""

from __future__ import annotations

import json
import os
import re
import time
from typing import Any, Dict, List, Optional, Sequence, Tuple

from . import thrift, tokens

VAULT_DIRECTORIES = ("sources", "notes", "outputs", "decisions")

# A figure that would need backing if it appeared in a note.
# `\b` and `(?<!\w)` are useless here: Japanese particles are word characters,
# so `は32%` would never match. Anchor on "not already inside a number" instead.
_FIGURE = re.compile(r"(?<![\d.,])\d[\d,\.]*\s*(?:%|％|億|万|千|円|ドル|pt|ポイント|倍|件|社|店)")
_LINK = re.compile(r"\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
_WIKILINK = re.compile(r"\[\[([^\]|#]+)")
_FRONT_MATTER = re.compile(r"\A---\s*\n(.*?)\n---\s*(?:\n|\Z)", re.S)

DEFAULT_STALE_DAYS = 180
DEFAULT_MAX_NOTE_TOKENS = 4000


def parse_front_matter(text: str) -> Tuple[Dict[str, Any], str]:
    """Parse the flat YAML subset Kumiki writes. Unknown shapes are kept as text."""
    match = _FRONT_MATTER.match(text)
    if not match:
        return {}, text
    fields: Dict[str, Any] = {}
    current_list_key: Optional[str] = None
    for line in match.group(1).split("\n"):
        if not line.strip():
            continue
        if line.lstrip().startswith("- ") and current_list_key:
            fields.setdefault(current_list_key, [])
            if isinstance(fields[current_list_key], list):
                fields[current_list_key].append(_scalar(line.lstrip()[2:]))
            continue
        key, separator, value = line.partition(":")
        if not separator:
            continue
        key = key.strip()
        value = value.strip()
        if value == "":
            current_list_key = key
            fields[key] = []
        else:
            current_list_key = None
            fields[key] = _scalar(value)
    return fields, text[match.end():]


def _scalar(raw: str) -> Any:
    raw = raw.strip()
    if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in "\"'":
        return raw[1:-1]
    if re.fullmatch(r"-?\d+", raw):
        return int(raw)
    if raw.lower() in {"true", "yes"}:
        return True
    if raw.lower() in {"false", "no"}:
        return False
    return raw


def _parse_date(value: Any) -> Optional[float]:
    text = str(value or "").strip()
    if not text:
        return None
    for pattern in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d",
                    "%Y/%m/%d", "%Y-%m"):
        try:
            return time.mktime(time.strptime(text[:len(time.strftime(pattern))], pattern))
        except (ValueError, OverflowError):
            continue
    match = re.match(r"(\d{4})-(\d{2})-(\d{2})", text)
    if match:
        try:
            return time.mktime(time.strptime(match.group(0), "%Y-%m-%d"))
        except ValueError:
            return None
    return None


# ---------------------------------------------------------------------------
# init
# ---------------------------------------------------------------------------

_README = """# {name}

Kumiki knowledge base.

| directory | holds | rule |
| --- | --- | --- |
| `sources/` | raw gathered material, one note per source | never edited by hand |
| `notes/` | your synthesis, one claim cluster per note | every figure cites `sources/` |
| `decisions/` | what you concluded and why | dated, never deleted, superseded instead |
| `outputs/` | reports and proposals built from `notes/` | regenerated, not patched |

Run `kumiki knowledge audit .` before you rely on anything in here.
"""


def init_vault(root: str, name: str = "knowledge") -> Dict[str, Any]:
    root = os.path.abspath(os.path.expanduser(root))
    created: List[str] = []
    for directory in VAULT_DIRECTORIES:
        path = os.path.join(root, directory)
        if not os.path.isdir(path):
            os.makedirs(path, exist_ok=True)
            created.append(os.path.relpath(path, root))
        keep = os.path.join(path, ".gitkeep")
        if not os.path.exists(keep):
            open(keep, "w", encoding="utf-8").close()
    readme = os.path.join(root, "README.md")
    if not os.path.exists(readme):
        with open(readme, "w", encoding="utf-8") as handle:
            handle.write(_README.format(name=name))
        created.append("README.md")
    config = os.path.join(root, "kumiki.json")
    if not os.path.exists(config):
        with open(config, "w", encoding="utf-8") as handle:
            json.dump({
                "name": name,
                "stale_days": DEFAULT_STALE_DAYS,
                "max_note_tokens": DEFAULT_MAX_NOTE_TOKENS,
                "require_source_in": ["notes", "sources"],
            }, handle, ensure_ascii=False, indent=2)
        created.append("kumiki.json")
    return {"root": root, "created": created}


def load_config(root: str) -> Dict[str, Any]:
    path = os.path.join(root, "kumiki.json")
    defaults = {
        "name": os.path.basename(os.path.abspath(root)),
        "stale_days": DEFAULT_STALE_DAYS,
        "max_note_tokens": DEFAULT_MAX_NOTE_TOKENS,
        "require_source_in": ["notes", "sources"],
    }
    try:
        with open(path, "r", encoding="utf-8") as handle:
            defaults.update(json.load(handle))
    except (OSError, ValueError):
        pass
    return defaults


# ---------------------------------------------------------------------------
# audit
# ---------------------------------------------------------------------------

class Finding:
    __slots__ = ("severity", "check", "path", "message")

    def __init__(self, severity: str, check: str, path: str, message: str) -> None:
        self.severity = severity
        self.check = check
        self.path = path
        self.message = message

    def as_dict(self) -> Dict[str, str]:
        return {"severity": self.severity, "check": self.check,
                "path": self.path, "message": self.message}


def audit(root: str, stale_days: Optional[int] = None,
          max_note_tokens: Optional[int] = None) -> Dict[str, Any]:
    """Check a knowledge base for the four ways it rots."""
    root = os.path.abspath(os.path.expanduser(root))
    config = load_config(root)
    stale_days = stale_days if stale_days is not None else int(config["stale_days"])
    max_note_tokens = (max_note_tokens if max_note_tokens is not None
                       else int(config["max_note_tokens"]))
    require_source_in = set(config.get("require_source_in") or [])

    paths = [p for p in thrift.iter_files(root, include=["*.md"])
             if os.path.basename(p) != "README.md"]
    findings: List[Finding] = []
    titles: Dict[str, List[str]] = {}
    link_targets: Dict[str, int] = {}
    now = time.time()
    notes: List[Dict[str, Any]] = []

    for path in paths:
        relative = os.path.relpath(path, root)
        top = relative.split(os.sep)[0]
        try:
            text = thrift.read_text(path)
        except OSError as error:
            findings.append(Finding("error", "unreadable", relative, str(error)))
            continue
        fields, body = parse_front_matter(text)
        cost = tokens.estimate(text)
        notes.append({"path": relative, "est_tokens": cost, "fields": fields})

        title = str(fields.get("title") or "").strip()
        if not title:
            heading = re.search(r"^#\s+(.+)$", body, re.M)
            title = heading.group(1).strip() if heading else ""
        if title:
            titles.setdefault(title.lower(), []).append(relative)

        # 1. Provenance.
        has_source = bool(str(fields.get("source") or fields.get("sources") or "").strip())
        if top in require_source_in and not has_source:
            severity = "error" if top == "sources" else "warn"
            findings.append(Finding(
                severity, "missing-source", relative,
                "no `source:` in front matter; this note cannot be cited"))

        # 2. Unbacked figures.
        if not has_source:
            figures = _FIGURE.findall(body)
            if len(figures) >= 3:
                findings.append(Finding(
                    "warn", "unbacked-figures", relative,
                    "{} numeric claims with no source (first: {})".format(
                        len(figures), figures[0])))

        # 3. Staleness.
        stamp = _parse_date(fields.get("fetched_at") or fields.get("updated")
                            or fields.get("published"))
        if stamp is not None:
            age_days = int((now - stamp) / 86400)
            if age_days > stale_days:
                findings.append(Finding(
                    "warn", "stale", relative,
                    "last dated {} days ago (threshold {})".format(age_days, stale_days)))

        # 4. Size.
        if cost > max_note_tokens:
            findings.append(Finding(
                "warn", "oversize", relative,
                "{} tokens; split it or nobody will read it whole".format(
                    tokens.human(cost))))

        # 5. Links.
        for target in _LINK.findall(body):
            if re.match(r"^[a-z][a-z0-9+.\-]*:", target) or target.startswith("//"):
                continue
            resolved = os.path.normpath(
                os.path.join(os.path.dirname(path), target.split("#")[0]))
            link_targets[os.path.relpath(resolved, root)] = \
                link_targets.get(os.path.relpath(resolved, root), 0) + 1
            if not os.path.exists(resolved):
                findings.append(Finding(
                    "error", "broken-link", relative,
                    "link target does not exist: {}".format(target)))
        for target in _WIKILINK.findall(body):
            link_targets[target.strip()] = link_targets.get(target.strip(), 0) + 1

    # 6. Orphans.
    linked_basenames = set()
    for target in link_targets:
        linked_basenames.add(os.path.splitext(os.path.basename(target))[0].lower())
        linked_basenames.add(target.lower())
    for note in notes:
        stem = os.path.splitext(os.path.basename(note["path"]))[0].lower()
        if stem not in linked_basenames and note["path"].lower() not in linked_basenames:
            findings.append(Finding(
                "info", "orphan", note["path"],
                "nothing links here; it will not be found when it matters"))

    # 7. Duplicate titles.
    for title, owners in titles.items():
        if len(owners) > 1:
            findings.append(Finding(
                "warn", "duplicate-title", owners[0],
                "title shared with {}".format(", ".join(owners[1:]))))

    counts = {"error": 0, "warn": 0, "info": 0}
    for finding in findings:
        counts[finding.severity] = counts.get(finding.severity, 0) + 1

    return {
        "root": root,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "notes": len(notes),
        "corpus_est_tokens": sum(n["est_tokens"] for n in notes),
        "counts": counts,
        "findings": [f.as_dict() for f in findings],
    }


_SEVERITY_MARK = {"error": "✗", "warn": "△", "info": "·"}


def render_audit(data: Dict[str, Any]) -> str:
    counts = data["counts"]
    lines = [
        "# knowledge audit — {}".format(data["root"]),
        "",
        "{} notes · {} tokens · {} errors, {} warnings, {} notices".format(
            data["notes"], tokens.human(data["corpus_est_tokens"]),
            counts.get("error", 0), counts.get("warn", 0), counts.get("info", 0)),
        "",
    ]
    if not data["findings"]:
        lines.append("Clean. Every note is sourced, linked, current, and readable.")
        return "\n".join(lines)

    grouped: Dict[str, List[Dict[str, str]]] = {}
    for finding in data["findings"]:
        grouped.setdefault(finding["check"], []).append(finding)
    order = ["missing-source", "broken-link", "unbacked-figures", "stale",
             "oversize", "duplicate-title", "orphan", "unreadable"]
    for check in order + [k for k in grouped if k not in order]:
        items = grouped.get(check)
        if not items:
            continue
        lines.append("## {} ({})".format(check, len(items)))
        lines.append("")
        for finding in items[:40]:
            lines.append("{} `{}` — {}".format(
                _SEVERITY_MARK.get(finding["severity"], "·"),
                finding["path"], finding["message"]))
        if len(items) > 40:
            lines.append("…and {} more".format(len(items) - 40))
        lines.append("")
    return "\n".join(lines)
