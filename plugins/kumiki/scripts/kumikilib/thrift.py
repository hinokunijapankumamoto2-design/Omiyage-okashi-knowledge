"""Token thrift: read the map before you read the territory.

The single largest avoidable cost in agentic work is reading whole files to
find one section. These helpers make the cheap move available:

``budget``   what would this cost me, before I spend it
``outline``  the structure of a file, at roughly 2% of its token cost
``slice``    one section, by heading, with its line range
``index``    a corpus-wide map so retrieval replaces bulk reading
``plan``     a read strategy for a set of files against a fixed budget
"""

from __future__ import annotations

import fnmatch
import json
import os
import re
import time
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from . import tokens

TEXT_EXTENSIONS = frozenset(
    """.md .markdown .txt .rst .org .csv .tsv .json .jsonl .yaml .yml .toml .ini
    .cfg .py .js .jsx .ts .tsx .go .rs .rb .java .kt .c .h .cc .cpp .cs .php
    .sh .bash .zsh .ps1 .sql .html .htm .css .scss .vue .svelte .lua .r
    .swift .m .mm .pl .ex .exs .clj .scala .dart .tf .proto .graphql""".split()
)

SKIP_DIRECTORIES = frozenset(
    """.git .hg .svn node_modules .venv venv __pycache__ .mypy_cache .pytest_cache
    .ruff_cache dist build out target .next .nuxt .cache coverage .idea .vscode
    .terraform vendor .gradle .tox site-packages""".split()
)

# A file this size is almost never worth reading whole on the first pass.
LARGE_FILE_TOKENS = 2_000

_MD_HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
_SYMBOL_PATTERNS: Tuple[Tuple[str, "re.Pattern[str]"], ...] = (
    (".py", re.compile(r"^(?P<indent>\s*)(?:async\s+)?(?P<kind>def|class)\s+(?P<name>\w+)")),
    (".js", re.compile(r"^(?P<indent>\s*)(?:export\s+)?(?:async\s+)?(?P<kind>function|class|const|let)\s+(?P<name>\w+)")),
    (".ts", re.compile(r"^(?P<indent>\s*)(?:export\s+)?(?:async\s+)?(?P<kind>function|class|interface|type|const|enum)\s+(?P<name>\w+)")),
    (".go", re.compile(r"^(?P<indent>)(?P<kind>func|type)\s+(?P<name>[\w\(\)\*\s]+)")),
    (".rs", re.compile(r"^(?P<indent>\s*)(?:pub\s+)?(?P<kind>fn|struct|enum|trait|impl|mod)\s+(?P<name>\w+)")),
    (".rb", re.compile(r"^(?P<indent>\s*)(?P<kind>def|class|module)\s+(?P<name>[\w:\.]+)")),
    (".sh", re.compile(r"^(?P<indent>)(?P<kind>function\s+)?(?P<name>\w+)\s*\(\)\s*\{")),
)
_SYMBOL_ALIASES = {".jsx": ".js", ".mjs": ".js", ".cjs": ".js", ".tsx": ".ts",
                   ".bash": ".sh", ".zsh": ".sh"}


def read_text(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="replace") as handle:
        return handle.read()


def is_text_file(path: str) -> bool:
    return os.path.splitext(path)[1].lower() in TEXT_EXTENSIONS


def iter_files(root: str, include: Optional[Sequence[str]] = None,
               exclude: Optional[Sequence[str]] = None,
               max_files: int = 5000) -> List[str]:
    """Walk ``root`` for text files, skipping build and VCS noise."""
    root = os.path.abspath(os.path.expanduser(root))
    if os.path.isfile(root):
        return [root]
    found: List[str] = []
    for directory, subdirs, files in os.walk(root):
        subdirs[:] = [d for d in subdirs
                      if d not in SKIP_DIRECTORIES and not d.startswith(".")
                      or d in {".claude", ".claude-plugin", ".github"}]
        for name in sorted(files):
            path = os.path.join(directory, name)
            relative = os.path.relpath(path, root)
            if include and not any(fnmatch.fnmatch(relative, p) or
                                   fnmatch.fnmatch(name, p) for p in include):
                continue
            if exclude and any(fnmatch.fnmatch(relative, p) or
                               fnmatch.fnmatch(name, p) for p in exclude):
                continue
            if not include and not is_text_file(path):
                continue
            found.append(path)
            if len(found) >= max_files:
                return found
    return found


# ---------------------------------------------------------------------------
# budget
# ---------------------------------------------------------------------------

def budget(paths: Sequence[str], include: Optional[Sequence[str]] = None,
           exclude: Optional[Sequence[str]] = None) -> Dict[str, Any]:
    """Cost every path before reading any of it."""
    entries: List[Dict[str, Any]] = []
    for target in paths:
        for path in iter_files(target, include, exclude):
            try:
                size = os.path.getsize(path)
            except OSError:
                continue
            estimate = tokens.estimate_file(path)
            entries.append({
                "path": path,
                "bytes": size,
                "est_tokens": estimate,
                "verdict": _verdict(estimate),
            })
    entries.sort(key=lambda e: e["est_tokens"], reverse=True)
    total = sum(e["est_tokens"] for e in entries)
    return {
        "files": len(entries),
        "total_est_tokens": total,
        "total_human": tokens.human(total),
        "entries": entries,
    }


def _verdict(estimate: int) -> str:
    if estimate <= 400:
        return "read-whole"
    if estimate <= LARGE_FILE_TOKENS:
        return "read-whole-if-central"
    if estimate <= 12_000:
        return "outline-then-slice"
    return "index-and-search"


# ---------------------------------------------------------------------------
# outline
# ---------------------------------------------------------------------------

def outline(path: str, max_depth: int = 6) -> Dict[str, Any]:
    """Structure of one file: headings for Markdown, symbols for code."""
    text = read_text(path)
    lines = text.split("\n")
    extension = os.path.splitext(path)[1].lower()
    extension = _SYMBOL_ALIASES.get(extension, extension)

    sections: List[Dict[str, Any]] = []
    if extension in {".md", ".markdown", ".rst", ".org", ".txt", ""}:
        for number, line in enumerate(lines, start=1):
            match = _MD_HEADING.match(line)
            if match and len(match.group(1)) <= max_depth:
                sections.append({
                    "level": len(match.group(1)),
                    "title": match.group(2).strip(),
                    "line": number,
                    "kind": "heading",
                })
    else:
        pattern = dict(_SYMBOL_PATTERNS).get(extension)
        if pattern:
            for number, line in enumerate(lines, start=1):
                match = pattern.match(line)
                if not match:
                    continue
                indent = len(match.groupdict().get("indent") or "")
                sections.append({
                    "level": 1 + indent // 4,
                    "title": "{} {}".format(
                        (match.groupdict().get("kind") or "").strip(),
                        match.group("name").strip()).strip(),
                    "line": number,
                    "kind": "symbol",
                })

    # Attribute the token cost of each span to the section that opens it.
    for index, section in enumerate(sections):
        start = section["line"]
        end = sections[index + 1]["line"] - 1 if index + 1 < len(sections) else len(lines)
        section["end_line"] = end
        section["est_tokens"] = tokens.estimate("\n".join(lines[start - 1:end]))

    total = tokens.estimate(text)
    outline_cost = tokens.estimate("\n".join(
        "{} {}".format("#" * s["level"], s["title"]) for s in sections))
    return {
        "path": path,
        "lines": len(lines),
        "total_est_tokens": total,
        "outline_est_tokens": outline_cost,
        "savings_ratio": round(1 - (outline_cost / total), 3) if total else 0.0,
        "sections": sections,
    }


def render_outline(data: Dict[str, Any]) -> str:
    lines = [
        "# outline: {}".format(data["path"]),
        "",
        "{} lines · {} tokens whole · {} tokens as outline ({}% cheaper)".format(
            data["lines"], tokens.human(data["total_est_tokens"]),
            tokens.human(data["outline_est_tokens"]),
            int(data["savings_ratio"] * 100)),
        "",
    ]
    if not data["sections"]:
        lines.append("_No headings or symbols found; this file has no cheap map._")
        return "\n".join(lines)
    for section in data["sections"]:
        lines.append("{}{} L{}-{} · {} tok · {}".format(
            "  " * (section["level"] - 1), "-", section["line"],
            section["end_line"], tokens.human(section["est_tokens"]),
            section["title"]))
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# slice
# ---------------------------------------------------------------------------

def slice_section(path: str, needle: str, include_subsections: bool = True
                  ) -> Optional[Dict[str, Any]]:
    """Return the section whose heading matches ``needle`` (case-insensitive)."""
    data = outline(path)
    sections = data["sections"]
    if not sections:
        return None
    needle_lower = needle.lower()
    match = None
    for section in sections:
        if needle_lower == section["title"].lower():
            match = section
            break
    if match is None:
        for section in sections:
            if needle_lower in section["title"].lower():
                match = section
                break
    if match is None:
        return None

    lines = read_text(path).split("\n")
    start = match["line"]
    if include_subsections:
        end = len(lines)
        for section in sections:
            if section["line"] > start and section["level"] <= match["level"]:
                end = section["line"] - 1
                break
    else:
        end = match["end_line"]
    body = "\n".join(lines[start - 1:end])
    return {
        "path": path,
        "title": match["title"],
        "start_line": start,
        "end_line": end,
        "est_tokens": tokens.estimate(body),
        "whole_file_est_tokens": data["total_est_tokens"],
        "text": body,
    }


# ---------------------------------------------------------------------------
# index
# ---------------------------------------------------------------------------

def build_index(root: str, include: Optional[Sequence[str]] = None,
                exclude: Optional[Sequence[str]] = None,
                headings_per_file: int = 6,
                max_files: int = 5000) -> Dict[str, Any]:
    """Compact map of a corpus: path, size, cost, and top headings."""
    root = os.path.abspath(os.path.expanduser(root))
    entries: List[Dict[str, Any]] = []
    for path in iter_files(root, include, exclude, max_files):
        try:
            text = read_text(path)
        except OSError:
            continue
        estimate = tokens.estimate(text)
        headings = [m.group(2).strip() for m in
                    (_MD_HEADING.match(line) for line in text.split("\n")) if m]
        first_line = next((l.strip() for l in text.split("\n")[:20] if l.strip()), "")
        entries.append({
            "path": os.path.relpath(path, root),
            "est_tokens": estimate,
            "lines": text.count("\n") + 1,
            "title": headings[0] if headings else first_line[:80],
            "headings": headings[1:headings_per_file + 1],
        })
    entries.sort(key=lambda e: e["path"])
    total = sum(e["est_tokens"] for e in entries)
    index_text = render_index({"root": root, "entries": entries})
    return {
        "root": root,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "files": len(entries),
        "corpus_est_tokens": total,
        "index_est_tokens": tokens.estimate(index_text),
        "entries": entries,
    }


def render_index(data: Dict[str, Any]) -> str:
    lines = ["# Kumiki index", ""]
    if data.get("generated_at"):
        lines.append("generated: {}".format(data["generated_at"]))
    if data.get("files") is not None:
        lines.append("{} files · corpus {} tokens · this index {} tokens".format(
            data.get("files", len(data["entries"])),
            tokens.human(data.get("corpus_est_tokens", 0)),
            tokens.human(data.get("index_est_tokens", 0))))
    lines += ["", "| file | tok | title | sections |", "| --- | --- | --- | --- |"]
    for entry in data["entries"]:
        sections = " · ".join(entry["headings"][:4])
        lines.append("| `{}` | {} | {} | {} |".format(
            entry["path"], tokens.human(entry["est_tokens"]),
            entry["title"].replace("|", "\\|")[:70],
            sections.replace("|", "\\|")[:110]))
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# plan
# ---------------------------------------------------------------------------

def plan(paths: Sequence[str], token_budget: int,
         include: Optional[Sequence[str]] = None,
         exclude: Optional[Sequence[str]] = None) -> Dict[str, Any]:
    """Decide how to read a set of files without blowing ``token_budget``.

    Small files are read whole. Large ones are outlined first and sliced on
    demand. When even the outlines do not fit, the corpus gets indexed and
    read by search instead.
    """
    costed = budget(paths, include, exclude)
    read_whole: List[Dict[str, Any]] = []
    outline_first: List[Dict[str, Any]] = []
    search_only: List[Dict[str, Any]] = []
    spent = 0

    for entry in sorted(costed["entries"], key=lambda e: e["est_tokens"]):
        cost = entry["est_tokens"]
        if cost <= LARGE_FILE_TOKENS and spent + cost <= token_budget:
            read_whole.append(entry)
            spent += cost
            continue
        try:
            structure = outline(entry["path"])
        except OSError:
            search_only.append(entry)
            continue
        outline_cost = structure["outline_est_tokens"]
        if structure["sections"] and spent + outline_cost <= token_budget:
            item = dict(entry)
            item["outline_est_tokens"] = outline_cost
            item["sections"] = len(structure["sections"])
            outline_first.append(item)
            spent += outline_cost
        else:
            search_only.append(entry)

    return {
        "token_budget": token_budget,
        "planned_spend": spent,
        "naive_spend": costed["total_est_tokens"],
        "saved": max(0, costed["total_est_tokens"] - spent),
        "saved_pct": (
            int(100 * (1 - spent / costed["total_est_tokens"]))
            if costed["total_est_tokens"] else 0
        ),
        "read_whole": read_whole,
        "outline_first": outline_first,
        "search_only": search_only,
    }


def render_plan(data: Dict[str, Any]) -> str:
    lines = [
        "# read plan",
        "",
        "budget {} · planned {} · naive {} · saved {} ({}%)".format(
            tokens.human(data["token_budget"]), tokens.human(data["planned_spend"]),
            tokens.human(data["naive_spend"]), tokens.human(data["saved"]),
            data["saved_pct"]),
        "",
    ]
    def block(title: str, items: List[Dict[str, Any]], note: str) -> None:
        if not items:
            return
        lines.append("## {} ({})".format(title, len(items)))
        lines.append("_{}_".format(note))
        lines.append("")
        for entry in items[:60]:
            lines.append("- `{}` — {} tok".format(
                entry["path"], tokens.human(entry["est_tokens"])))
        if len(items) > 60:
            lines.append("- …and {} more".format(len(items) - 60))
        lines.append("")

    block("Read whole", data["read_whole"], "Small enough that slicing costs more than reading.")
    block("Outline first", data["outline_first"], "Run `thrift outline`, then `thrift slice` only the sections you need.")
    block("Search only", data["search_only"], "Do not open. Use Grep, or build an index and query it.")
    return "\n".join(lines)
