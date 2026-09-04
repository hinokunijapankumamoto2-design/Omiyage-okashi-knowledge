"""Collection: URLs in, citable Markdown notes plus a manifest out.

Every note carries YAML front matter with the URL, fetch timestamp, and a
content hash. That front matter is what makes the note usable as evidence
later: :mod:`knowledge` refuses to audit a note that has no source.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import time
import unicodedata
import xml.etree.ElementTree as ET
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence
from urllib.parse import urlparse

from . import extract, htmldom, tokens
from .fetcher import FetchError, Fetcher, normalise_url

_SLUG_STRIP = re.compile(r"[^\w\-一-龥ぁ-んァ-ヶー]+", re.UNICODE)


def slugify(text: str, max_length: int = 60) -> str:
    """Filesystem-safe slug that keeps Japanese readable instead of empty."""
    text = unicodedata.normalize("NFKC", text).strip().lower()
    text = re.sub(r"\s+", "-", text)
    text = _SLUG_STRIP.sub("-", text)
    text = re.sub(r"-{2,}", "-", text).strip("-")
    return text[:max_length] or "untitled"


def _front_matter(fields: Dict[str, Any]) -> str:
    lines = ["---"]
    for key, value in fields.items():
        if value in ("", None, [], {}):
            continue
        if isinstance(value, list):
            lines.append("{}:".format(key))
            lines.extend("  - {}".format(_yaml_scalar(v)) for v in value)
        else:
            lines.append("{}: {}".format(key, _yaml_scalar(value)))
    lines.append("---")
    return "\n".join(lines)


def _yaml_scalar(value: Any) -> str:
    text = str(value)
    if text == "":
        return '""'
    if re.search(r'[:#\[\]{}",\n]|^\s|\s$', text):
        return '"{}"'.format(text.replace("\\", "\\\\").replace('"', '\\"'))
    return text


class Document:
    """One gathered page: metadata, body Markdown, and provenance."""

    def __init__(self, url: str, meta: Dict[str, Any], body: str,
                 fetched_at: str, from_cache: bool, status: int) -> None:
        self.url = url
        self.meta = meta
        self.body = body
        self.fetched_at = fetched_at
        self.from_cache = from_cache
        self.status = status
        self.content_hash = hashlib.sha256(body.encode("utf-8")).hexdigest()[:16]

    @property
    def title(self) -> str:
        return self.meta.get("title") or self.url

    @property
    def est_tokens(self) -> int:
        return tokens.estimate(self.body)

    def to_markdown(self) -> str:
        header = _front_matter({
            "title": self.title,
            "source": self.url,
            "canonical": self.meta.get("canonical", ""),
            "site": self.meta.get("site_name", ""),
            "author": self.meta.get("author", ""),
            "published": self.meta.get("published", ""),
            "modified": self.meta.get("modified", ""),
            "lang": self.meta.get("lang", ""),
            "fetched_at": self.fetched_at,
            "content_hash": self.content_hash,
            "est_tokens": self.est_tokens,
            "gathered_by": "kumiki",
        })
        summary = self.meta.get("description", "")
        parts = [header, ""]
        if summary:
            parts += ["> {}".format(summary), ""]
        parts.append(self.body)
        return "\n".join(parts).rstrip() + "\n"

    def as_dict(self) -> Dict[str, Any]:
        return {
            "url": self.url,
            "title": self.title,
            "status": self.status,
            "fetched_at": self.fetched_at,
            "from_cache": self.from_cache,
            "content_hash": self.content_hash,
            "est_tokens": self.est_tokens,
            "published": self.meta.get("published", ""),
            "site": self.meta.get("site_name", ""),
        }


def build_document(url: str, html: str, fetched_at: str, from_cache: bool,
                   status: int, keep_links: bool = True,
                   main_only: bool = True) -> Document:
    root = htmldom.parse(html)
    meta = extract.extract_metadata(html, url, root=root)
    target = extract.find_main(root) if main_only else (root.find("body") or root)
    body = extract.to_markdown(target, base_url=url, keep_links=keep_links)
    return Document(url, meta, body, fetched_at, from_cache, status)


def fetch_documents(urls: Sequence[str], fetcher: Fetcher, keep_links: bool = True,
                    main_only: bool = True,
                    on_event: Optional[Callable[[str], None]] = None
                    ) -> Dict[str, Any]:
    """Fetch every URL, collecting failures rather than aborting the run."""
    log = on_event or (lambda _message: None)
    documents: List[Document] = []
    failures: List[Dict[str, str]] = []
    for url in urls:
        url = normalise_url(url)
        try:
            result = fetcher.fetch(url)
        except FetchError as error:
            failures.append({"url": url, "error": str(error)})
            log("  ✗ {} — {}".format(url, error))
            continue
        document = build_document(result.final_url or url, result.body,
                                  result.fetched_at, result.from_cache,
                                  result.status, keep_links, main_only)
        documents.append(document)
        log("  {} {} ({} tok){}".format(
            "◇" if result.from_cache else "◆",
            document.title[:60], tokens.human(document.est_tokens),
            " [cache]" if result.from_cache else ""))
    return {"documents": documents, "failures": failures}


def crawl(seed: str, fetcher: Fetcher, depth: int = 1, max_pages: int = 25,
          same_host: bool = True, include: Optional[str] = None,
          exclude: Optional[str] = None, keep_links: bool = True,
          main_only: bool = True,
          on_event: Optional[Callable[[str], None]] = None) -> Dict[str, Any]:
    """Breadth-first crawl from ``seed``.

    ``max_pages`` is a hard stop, not a target: a crawl that runs away is worse
    than one that stops early, because you cannot un-send requests.
    """
    log = on_event or (lambda _message: None)
    include_re = re.compile(include) if include else None
    exclude_re = re.compile(exclude) if exclude else None
    seed = normalise_url(seed)
    seen = {seed}
    queue: List[tuple] = [(seed, 0)]
    documents: List[Document] = []
    failures: List[Dict[str, str]] = []

    while queue and len(documents) < max_pages:
        url, level = queue.pop(0)
        try:
            result = fetcher.fetch(url)
        except FetchError as error:
            failures.append({"url": url, "error": str(error)})
            log("  ✗ {} — {}".format(url, error))
            continue
        document = build_document(result.final_url or url, result.body,
                                  result.fetched_at, result.from_cache,
                                  result.status, keep_links, main_only)
        documents.append(document)
        log("  [{}] {} ({} tok)".format(level, document.title[:56],
                                        tokens.human(document.est_tokens)))
        if level >= depth:
            continue
        for link in extract.extract_links(result.body, url, same_host_only=same_host):
            link = normalise_url(link)
            if link in seen:
                continue
            if include_re and not include_re.search(link):
                continue
            if exclude_re and exclude_re.search(link):
                continue
            seen.add(link)
            queue.append((link, level + 1))
    return {"documents": documents, "failures": failures, "discovered": len(seen)}


def read_sitemap(url: str, fetcher: Fetcher, limit: int = 500,
                 on_event: Optional[Callable[[str], None]] = None) -> List[str]:
    """Return the URLs listed in a sitemap, following sitemap indexes one level."""
    log = on_event or (lambda _message: None)
    try:
        result = fetcher.fetch(url)
    except FetchError as error:
        log("  ✗ sitemap {} — {}".format(url, error))
        return []
    try:
        root = ET.fromstring(result.body.encode("utf-8", "replace"))
    except ET.ParseError as error:
        log("  ✗ sitemap parse failed: {}".format(error))
        return []

    def local(tag: str) -> str:
        return tag.rsplit("}", 1)[-1]

    urls: List[str] = []
    nested: List[str] = []
    for element in root.iter():
        if local(element.tag) != "loc" or not (element.text or "").strip():
            continue
        location = element.text.strip()
        parent_tag = local(root.tag)
        if parent_tag == "sitemapindex":
            nested.append(location)
        else:
            urls.append(location)
    for child in nested[:10]:
        log("  ↳ nested sitemap {}".format(child))
        urls.extend(read_sitemap_leaf(child, fetcher, log))
        if len(urls) >= limit:
            break
    return urls[:limit]


def read_sitemap_leaf(url: str, fetcher: Fetcher,
                      log: Callable[[str], None]) -> List[str]:
    try:
        result = fetcher.fetch(url)
        root = ET.fromstring(result.body.encode("utf-8", "replace"))
    except (FetchError, ET.ParseError) as error:
        log("  ✗ sitemap {} — {}".format(url, error))
        return []
    return [
        (element.text or "").strip()
        for element in root.iter()
        if element.tag.rsplit("}", 1)[-1] == "loc" and (element.text or "").strip()
    ]


def select_fields(html: str, url: str, selectors: Dict[str, str]) -> Dict[str, Any]:
    """Run a ``{field: css_selector}`` map against a page.

    A selector matching once yields a string; matching more than once yields a
    list. This keeps simple extractions simple without a schema declaration.
    """
    root = htmldom.parse(html)
    record: Dict[str, Any] = {"_url": url}
    for field, selector in selectors.items():
        matches = root.select(selector)
        values = []
        for node in matches:
            if node.tag == "a" and node.get("href"):
                values.append(node.get("href"))
            elif node.tag in {"img", "source"} and node.get("src"):
                values.append(node.get("src"))
            elif node.tag == "meta" and node.get("content"):
                values.append(node.get("content"))
            else:
                values.append(extract._clean_inline(node.text_content(" ")))
        values = [v for v in values if v]
        if not values:
            record[field] = None
        elif len(values) == 1:
            record[field] = values[0]
        else:
            record[field] = values
    return record


def write_notes(documents: Iterable[Document], out_dir: str,
                extra_manifest: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Write one Markdown note per document plus ``_manifest.json``."""
    out_dir = os.path.abspath(os.path.expanduser(out_dir))
    os.makedirs(out_dir, exist_ok=True)
    written: List[Dict[str, Any]] = []
    used: Dict[str, int] = {}
    for document in documents:
        base = slugify(document.title or urlparse(document.url).path)
        count = used.get(base, 0)
        used[base] = count + 1
        name = base if count == 0 else "{}-{}".format(base, count + 1)
        path = os.path.join(out_dir, name + ".md")
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(document.to_markdown())
        entry = document.as_dict()
        entry["file"] = os.path.relpath(path, out_dir)
        written.append(entry)

    manifest: Dict[str, Any] = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "tool": "kumiki gather",
        "count": len(written),
        "total_est_tokens": sum(e["est_tokens"] for e in written),
        "documents": written,
    }
    if extra_manifest:
        manifest.update(extra_manifest)
    with open(os.path.join(out_dir, "_manifest.json"), "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=2)
    return manifest
