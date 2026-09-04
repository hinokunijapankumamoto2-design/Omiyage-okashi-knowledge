"""Turn a raw HTML page into citable, token-cheap Markdown.

Three jobs, in order:

1. :func:`extract_metadata` — title, description, canonical URL, publication
   date, author, and any JSON-LD blocks. This is the citation record; a note
   without it is not usable as evidence.
2. :func:`find_main` — pick the element that actually holds the article. Site
   chrome (nav, footer, cookie banners, related-posts rails) is typically 60-80%
   of a page's characters and none of its meaning.
3. :func:`to_markdown` — render that element as Markdown, dropping attributes
   and inline styling that cost tokens and carry no information.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse

from . import htmldom
from .htmldom import Node

# Elements whose content is never part of the article.
DROP_TAGS = frozenset(
    """script style noscript template svg canvas iframe object embed form
    button select textarea input label nav aside footer header dialog
    figcaption picture source track map area""".split()
)

# Elements that contribute a block break in Markdown output.
BLOCK_TAGS = frozenset(
    """address article aside blockquote details div dl dt dd fieldset figure
    footer form h1 h2 h3 h4 h5 h6 header hr li main nav ol p pre section
    table tbody tfoot thead tr ul""".split()
)

_HEADINGS = {"h1": 1, "h2": 2, "h3": 3, "h4": 4, "h5": 5, "h6": 6}

# Class/id fragments that mark site chrome even inside <main>.
_CHROME_HINT = re.compile(
    r"(nav|menu|sidebar|footer|header|breadcrumb|share|social|comment|related|"
    r"recommend|banner|advert|\bads?\b|promo|cookie|consent|subscribe|newsletter|"
    r"pagination|pager|toc|widget|modal|popup|skip-link)",
    re.I,
)

_WS_RUN = re.compile(r"[ \t　]+")
_BLANK_RUN = re.compile(r"\n{3,}")


# ---------------------------------------------------------------------------
# Metadata
# ---------------------------------------------------------------------------

def _meta_lookup(root: Node) -> Dict[str, str]:
    found: Dict[str, str] = {}
    for node in root.find_all("meta"):
        key = node.get("property") or node.get("name") or node.get("itemprop")
        content = node.get("content")
        if key and content and key.lower() not in found:
            found[key.lower()] = content.strip()
    return found


def _json_ld(root: Node) -> List[Any]:
    blocks: List[Any] = []
    for node in root.find_all("script"):
        if "ld+json" not in node.get("type", "").lower():
            continue
        raw = node.text_content().strip()
        if not raw:
            continue
        try:
            blocks.append(json.loads(raw))
        except (ValueError, RecursionError):
            continue
    return blocks


def _first_ld_value(blocks: List[Any], *keys: str) -> Optional[str]:
    stack: List[Any] = list(blocks)
    while stack:
        item = stack.pop(0)
        if isinstance(item, dict):
            for key in keys:
                value = item.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
                if isinstance(value, dict):
                    name = value.get("name")
                    if isinstance(name, str) and name.strip():
                        return name.strip()
            stack.extend(item.values())
        elif isinstance(item, list):
            stack.extend(item)
    return None


def extract_metadata(html: str, url: str = "", root: Optional[Node] = None) -> Dict[str, Any]:
    """Pull the citation record out of a page.

    Precedence is JSON-LD > OpenGraph > standard meta > visible ``<h1>``,
    because that is the order of decreasing authorial intent.
    """
    root = root if root is not None else htmldom.parse(html)
    meta = _meta_lookup(root)
    ld = _json_ld(root)

    title_node = root.find("title")
    title = (
        _first_ld_value(ld, "headline", "name")
        or meta.get("og:title")
        or meta.get("twitter:title")
        or (title_node.text_content().strip() if title_node else "")
    )
    if not title:
        h1 = root.find("h1")
        title = h1.text_content().strip() if h1 else ""

    canonical = ""
    for link in root.find_all("link"):
        if "canonical" in link.get("rel", "").lower():
            canonical = link.get("href", "")
            break
    if canonical and url:
        canonical = urljoin(url, canonical)

    lang = ""
    html_node = root.find("html")
    if html_node:
        lang = html_node.get("lang", "")
    lang = lang or meta.get("og:locale", "")

    return {
        "url": url,
        "canonical": canonical or url,
        "title": _clean_inline(title),
        "description": _clean_inline(
            meta.get("description") or meta.get("og:description")
            or meta.get("twitter:description") or ""
        ),
        "site_name": meta.get("og:site_name", "") or (urlparse(url).netloc if url else ""),
        "author": _first_ld_value(ld, "author", "creator") or meta.get("author", ""),
        "published": (
            _first_ld_value(ld, "datePublished", "dateCreated")
            or meta.get("article:published_time", "")
            or meta.get("date", "")
        ),
        "modified": (
            _first_ld_value(ld, "dateModified")
            or meta.get("article:modified_time", "")
        ),
        "lang": lang,
        "jsonld_types": sorted({
            t for block in ld for t in _types_of(block)
        }),
    }


def _types_of(block: Any) -> List[str]:
    out: List[str] = []
    stack = [block]
    while stack:
        item = stack.pop()
        if isinstance(item, dict):
            value = item.get("@type")
            if isinstance(value, str):
                out.append(value)
            elif isinstance(value, list):
                out.extend(v for v in value if isinstance(v, str))
            stack.extend(item.values())
        elif isinstance(item, list):
            stack.extend(item)
    return out


# ---------------------------------------------------------------------------
# Main-content detection
# ---------------------------------------------------------------------------

def _visible_length(node: Node) -> int:
    total = 0
    for child in node.walk():
        if child.is_text:
            parent = child.parent
            if parent is not None and parent.tag in DROP_TAGS:
                continue
            total += len(child.text.strip())
    return total


def _link_density(node: Node) -> float:
    total = _visible_length(node)
    if total == 0:
        return 1.0
    linked = sum(_visible_length(a) for a in node.find_all("a"))
    return min(1.0, linked / total)


def _is_chrome(node: Node) -> bool:
    signature = "{} {}".format(node.get("class", ""), node.get("id", ""))
    if node.get("role", "").lower() in {"navigation", "banner", "complementary", "search"}:
        return True
    return bool(_CHROME_HINT.search(signature))


def find_main(root: Node) -> Node:
    """Return the element most likely to hold the article body.

    Semantic tags win outright when they carry enough text. Otherwise every
    container is scored on text volume, paragraph count, and link density —
    link-heavy blocks are navigation no matter what they are called.
    """
    body = root.find("body") or root

    for tag in ("article", "main"):
        for candidate in body.find_all(tag):
            if _visible_length(candidate) >= 200 and not _is_chrome(candidate):
                return candidate

    best: Optional[Node] = None
    best_score = 0.0
    for candidate in body.elements():
        if candidate.tag not in {"div", "section", "td", "body"}:
            continue
        length = _visible_length(candidate)
        if length < 200:
            continue
        paragraphs = len(candidate.find_all("p"))
        score = length * (1.0 + 0.10 * min(paragraphs, 20))
        score *= (1.0 - _link_density(candidate)) ** 2
        if _is_chrome(candidate):
            score *= 0.25
        # Prefer the tightest container holding the same text.
        depth = 0
        walker: Optional[Node] = candidate
        while walker is not None:
            depth += 1
            walker = walker.parent
        score *= 1.0 + 0.02 * depth
        if score > best_score:
            best_score = score
            best = candidate
    return best if best is not None else body


# ---------------------------------------------------------------------------
# Markdown rendering
# ---------------------------------------------------------------------------

def _clean_inline(text: str) -> str:
    return _WS_RUN.sub(" ", text.replace(" ", " ")).strip()


class _MarkdownRenderer:
    def __init__(self, base_url: str = "", keep_links: bool = True,
                 keep_images: bool = False, drop_chrome: bool = True) -> None:
        self.base_url = base_url
        self.keep_links = keep_links
        self.keep_images = keep_images
        self.drop_chrome = drop_chrome
        self.out: List[str] = []

    def render(self, node: Node) -> str:
        self._block(node)
        text = "".join(self.out)
        lines: List[str] = []
        for line in text.split("\n"):
            # Leading spaces carry list nesting, so normalise the rest only.
            indent = len(line) - len(line.lstrip(" "))
            body = _clean_inline(line)
            lines.append((" " * indent) + body if body else "")
        return _BLANK_RUN.sub("\n\n", "\n".join(lines)).strip()

    # -- helpers --------------------------------------------------------
    def _emit(self, text: str) -> None:
        if text:
            self.out.append(text)

    def _inline(self, node: Node) -> str:
        chunks: List[str] = []
        for child in node.children:
            if child.is_text:
                chunks.append(child.text)
                continue
            if child.tag in DROP_TAGS:
                continue
            if child.tag == "br":
                chunks.append("\n")
            elif child.tag in {"strong", "b"}:
                inner = self._inline(child).strip()
                chunks.append("**{}**".format(inner) if inner else "")
            elif child.tag in {"em", "i"}:
                inner = self._inline(child).strip()
                chunks.append("*{}*".format(inner) if inner else "")
            elif child.tag == "code":
                inner = self._inline(child).strip()
                chunks.append("`{}`".format(inner) if inner else "")
            elif child.tag == "a" and self.keep_links:
                inner = self._inline(child).strip()
                href = child.get("href", "").strip()
                if href and not href.startswith(("#", "javascript:")):
                    if self.base_url:
                        href = urljoin(self.base_url, href)
                    chunks.append("[{}]({})".format(inner, href) if inner else "")
                else:
                    chunks.append(inner)
            elif child.tag == "img":
                if self.keep_images:
                    src = child.get("src", "")
                    if src and self.base_url:
                        src = urljoin(self.base_url, src)
                    alt = child.get("alt", "").strip()
                    if src:
                        chunks.append("![{}]({})".format(alt, src))
                elif child.get("alt", "").strip():
                    chunks.append(child.get("alt").strip())
            else:
                chunks.append(self._inline(child))
        return "".join(chunks)

    def _table(self, node: Node) -> None:
        rows: List[List[str]] = []
        for tr in node.find_all("tr"):
            cells = [c for c in tr.children if not c.is_text and c.tag in {"td", "th"}]
            if cells:
                rows.append([_clean_inline(self._inline(c)) for c in cells])
        if not rows:
            return
        width = max(len(r) for r in rows)
        rows = [r + [""] * (width - len(r)) for r in rows]
        self._emit("\n\n| " + " | ".join(rows[0]) + " |\n")
        self._emit("|" + "|".join([" --- "] * width) + "|\n")
        for row in rows[1:]:
            self._emit("| " + " | ".join(row) + " |\n")
        self._emit("\n")

    def _list(self, node: Node, ordered: bool, depth: int) -> None:
        # A blank line separates a top-level list from surrounding prose; a
        # nested list must stay glued to its parent item or Markdown splits it
        # into a second list.
        self._emit("\n\n" if depth == 0 else "")
        index = 1
        for child in node.children:
            if child.is_text or child.tag != "li":
                continue
            marker = "{}. ".format(index) if ordered else "- "
            index += 1
            indent = "  " * depth
            # Split nested lists out so they render as sub-items.
            nested = [c for c in child.children
                      if not c.is_text and c.tag in {"ul", "ol"}]
            inline_children = Node(child.tag, dict(child.attrs))
            inline_children.children = [c for c in child.children
                                        if c.is_text or c.tag not in {"ul", "ol"}]
            body = _clean_inline(self._inline(inline_children))
            if body:
                self._emit("{}{}{}\n".format(indent, marker, body))
            for sub in nested:
                self._list(sub, sub.tag == "ol", depth + 1)
        self._emit("\n\n" if depth == 0 else "")

    def _block(self, node: Node, depth: int = 0) -> None:
        for child in node.children:
            if child.is_text:
                text = child.text
                if text.strip():
                    self._emit(text)
                continue
            tag = child.tag
            if tag in DROP_TAGS:
                continue
            if self.drop_chrome and tag in {"div", "section"} and _is_chrome(child) \
                    and _visible_length(child) < 400:
                continue
            if tag in _HEADINGS:
                title = _clean_inline(self._inline(child))
                if title:
                    self._emit("\n\n{} {}\n\n".format("#" * _HEADINGS[tag], title))
            elif tag == "p":
                body = _clean_inline(self._inline(child))
                if body:
                    self._emit("\n\n{}\n\n".format(body))
            elif tag in {"ul", "ol"}:
                self._list(child, tag == "ol", 0)
            elif tag == "table":
                self._table(child)
            elif tag == "blockquote":
                inner = _clean_inline(self._inline(child))
                if inner:
                    self._emit("\n\n> {}\n\n".format(inner))
            elif tag == "pre":
                code = child.text_content().strip("\n")
                if code.strip():
                    self._emit("\n\n```\n{}\n```\n\n".format(code))
            elif tag == "hr":
                self._emit("\n\n---\n\n")
            elif tag == "br":
                self._emit("\n")
            elif tag in BLOCK_TAGS:
                self._emit("\n")
                self._block(child, depth + 1)
                self._emit("\n")
            else:
                inline = self._inline(child)
                if inline.strip():
                    self._emit(inline)


def to_markdown(node: Node, base_url: str = "", keep_links: bool = True,
                keep_images: bool = False) -> str:
    """Render an element subtree as Markdown."""
    return _MarkdownRenderer(base_url, keep_links, keep_images).render(node)


def html_to_markdown(html: str, url: str = "", main_only: bool = True,
                     keep_links: bool = True, keep_images: bool = False) -> str:
    """Convenience wrapper: raw HTML in, article Markdown out."""
    root = htmldom.parse(html)
    target = find_main(root) if main_only else (root.find("body") or root)
    return to_markdown(target, base_url=url, keep_links=keep_links,
                       keep_images=keep_images)


def extract_links(html: str, base_url: str = "", same_host_only: bool = False,
                  root: Optional[Node] = None) -> List[str]:
    """Return absolute, de-duplicated ``href`` targets in document order."""
    root = root if root is not None else htmldom.parse(html)
    host = urlparse(base_url).netloc
    seen: set = set()
    out: List[str] = []
    for anchor in root.find_all("a"):
        href = anchor.get("href", "").strip()
        if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
            continue
        absolute = urljoin(base_url, href) if base_url else href
        absolute, _, _ = absolute.partition("#")
        parsed = urlparse(absolute)
        if parsed.scheme not in {"http", "https"}:
            continue
        if same_host_only and host and parsed.netloc != host:
            continue
        if absolute not in seen:
            seen.add(absolute)
            out.append(absolute)
    return out
