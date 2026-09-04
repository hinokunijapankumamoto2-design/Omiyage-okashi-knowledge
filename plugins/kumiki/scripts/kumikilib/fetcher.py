"""A polite HTTP fetcher: robots.txt, per-host rate limits, retries, caching.

Design rules, in priority order:

1. **Ask permission.** ``robots.txt`` is consulted before the first request to
   a host and cached for the run. ``respect_robots=False`` exists for pages you
   own, and the caller has to say so explicitly.
2. **One request at a time per host, with a gap.** Concurrency against a single
   origin is how a research script becomes an incident.
3. **Back off when told to.** 429 and 5xx retry with exponential backoff and
   honour ``Retry-After``. 4xx other than 429 never retries.
4. **Never trust the wire.** Responses are size-capped, content-type filtered,
   and decoded with a charset resolved from headers, then meta, then UTF-8.
"""

from __future__ import annotations

import gzip
import io
import re
import socket
import time
import urllib.error
import urllib.request
import urllib.robotparser
import zlib
from typing import Dict, Optional, Tuple
from urllib.parse import urlparse, urlunparse

from .cache import Cache

DEFAULT_USER_AGENT = (
    "KumikiResearchBot/0.1 (+https://github.com/hinokunijapankumamoto2-design/"
    "Omiyage-okashi-knowledge; polite research fetcher)"
)
DEFAULT_MAX_BYTES = 5 * 1024 * 1024
DEFAULT_TIMEOUT = 20.0
DEFAULT_DELAY = 1.5

_META_CHARSET = re.compile(
    rb"""<meta[^>]+charset\s*=\s*["']?\s*([A-Za-z0-9_\-]+)""", re.I)
_TEXTUAL = ("text/", "application/xhtml", "application/xml", "application/json",
            "application/rss", "application/atom", "+xml", "+json")


class FetchError(Exception):
    """Raised when a URL cannot be retrieved and retrying will not help."""


class FetchResult:
    __slots__ = ("url", "final_url", "status", "headers", "body", "fetched_at",
                 "from_cache", "elapsed_ms")

    def __init__(self, url: str, final_url: str, status: int,
                 headers: Dict[str, str], body: str, fetched_at: str,
                 from_cache: bool = False, elapsed_ms: int = 0) -> None:
        self.url = url
        self.final_url = final_url
        self.status = status
        self.headers = headers
        self.body = body
        self.fetched_at = fetched_at
        self.from_cache = from_cache
        self.elapsed_ms = elapsed_ms

    def as_dict(self) -> Dict[str, object]:
        return {
            "url": self.url,
            "final_url": self.final_url,
            "status": self.status,
            "headers": self.headers,
            "body": self.body,
            "fetched_at": self.fetched_at,
            "from_cache": self.from_cache,
            "elapsed_ms": self.elapsed_ms,
        }


def normalise_url(url: str) -> str:
    """Strip fragments and default ports so the cache key is stable."""
    parsed = urlparse(url.strip())
    netloc = parsed.netloc
    if parsed.scheme == "http" and netloc.endswith(":80"):
        netloc = netloc[:-3]
    if parsed.scheme == "https" and netloc.endswith(":443"):
        netloc = netloc[:-4]
    return urlunparse((parsed.scheme, netloc, parsed.path or "/",
                       parsed.params, parsed.query, ""))


def _decode(raw: bytes, content_type: str) -> str:
    charset = ""
    match = re.search(r"charset\s*=\s*([A-Za-z0-9_\-]+)", content_type or "", re.I)
    if match:
        charset = match.group(1)
    if not charset:
        meta = _META_CHARSET.search(raw[:4096])
        if meta:
            charset = meta.group(1).decode("ascii", "ignore")
    for candidate in (charset, "utf-8", "cp932", "euc-jp", "latin-1"):
        if not candidate:
            continue
        try:
            return raw.decode(candidate)
        except (LookupError, UnicodeDecodeError):
            continue
    return raw.decode("utf-8", "replace")


def _decompress(raw: bytes, encoding: str) -> bytes:
    encoding = (encoding or "").lower()
    try:
        if "gzip" in encoding:
            return gzip.decompress(raw)
        if "deflate" in encoding:
            try:
                return zlib.decompress(raw)
            except zlib.error:
                return zlib.decompress(raw, -zlib.MAX_WBITS)
    except (OSError, zlib.error):
        return raw
    return raw


class Fetcher:
    def __init__(self, user_agent: str = DEFAULT_USER_AGENT,
                 delay: float = DEFAULT_DELAY,
                 timeout: float = DEFAULT_TIMEOUT,
                 max_bytes: int = DEFAULT_MAX_BYTES,
                 respect_robots: bool = True,
                 max_retries: int = 3,
                 cache: Optional[Cache] = None,
                 verbose: bool = False) -> None:
        self.user_agent = user_agent
        self.delay = max(0.0, delay)
        self.timeout = timeout
        self.max_bytes = max_bytes
        self.respect_robots = respect_robots
        self.max_retries = max_retries
        self.cache = cache
        self.verbose = verbose
        self._last_request: Dict[str, float] = {}
        self._robots: Dict[str, Optional[urllib.robotparser.RobotFileParser]] = {}
        self.requests_made = 0

    # -- politeness -----------------------------------------------------
    def _wait_turn(self, host: str) -> None:
        previous = self._last_request.get(host)
        if previous is not None:
            gap = self.delay - (time.monotonic() - previous)
            if gap > 0:
                time.sleep(gap)
        self._last_request[host] = time.monotonic()

    def _robots_for(self, url: str) -> Optional[urllib.robotparser.RobotFileParser]:
        parsed = urlparse(url)
        origin = "{}://{}".format(parsed.scheme, parsed.netloc)
        if origin in self._robots:
            return self._robots[origin]
        parser = urllib.robotparser.RobotFileParser()
        parser.set_url(origin + "/robots.txt")
        try:
            request = urllib.request.Request(
                origin + "/robots.txt", headers={"User-Agent": self.user_agent})
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                raw = response.read(512 * 1024)
            parser.parse(_decode(raw, "text/plain").splitlines())
        except (urllib.error.URLError, socket.timeout, ValueError, OSError):
            # No robots.txt, or unreachable: treat as "no stated restriction".
            parser = None
        self._robots[origin] = parser
        return parser

    def allowed(self, url: str) -> bool:
        if not self.respect_robots:
            return True
        parser = self._robots_for(url)
        if parser is None:
            return True
        try:
            return parser.can_fetch(self.user_agent, url)
        except Exception:
            return True

    def crawl_delay(self, url: str) -> float:
        parser = self._robots_for(url) if self.respect_robots else None
        if parser is None:
            return self.delay
        try:
            stated = parser.crawl_delay(self.user_agent)
        except Exception:
            stated = None
        return max(self.delay, float(stated)) if stated else self.delay

    # -- fetching -------------------------------------------------------
    def _open(self, url: str) -> Tuple[int, Dict[str, str], bytes, str]:
        request = urllib.request.Request(url, headers={
            "User-Agent": self.user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ja,en;q=0.8",
            "Accept-Encoding": "gzip, deflate",
        })
        with urllib.request.urlopen(request, timeout=self.timeout) as response:
            headers = {k.lower(): v for k, v in response.headers.items()}
            raw = response.read(self.max_bytes + 1)
            if len(raw) > self.max_bytes:
                raw = raw[:self.max_bytes]
                headers["x-kumiki-truncated"] = "1"
            return response.status, headers, raw, response.geturl()

    def fetch(self, url: str) -> FetchResult:
        """Retrieve ``url``, honouring cache, robots.txt, and rate limits."""
        url = normalise_url(url)
        if self.cache is not None:
            cached = self.cache.get(url)
            if cached:
                return FetchResult(
                    url=cached.get("url", url),
                    final_url=cached.get("final_url", url),
                    status=int(cached.get("status", 200)),
                    headers=cached.get("headers", {}),
                    body=cached.get("body", ""),
                    fetched_at=cached.get("fetched_at", ""),
                    from_cache=True,
                )

        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            raise FetchError("unsupported scheme: {}".format(url))
        if not self.allowed(url):
            raise FetchError("blocked by robots.txt: {}".format(url))

        delay = self.crawl_delay(url)
        attempt = 0
        last_error = ""
        while attempt <= self.max_retries:
            previous = self._last_request.get(parsed.netloc)
            if previous is not None:
                gap = delay - (time.monotonic() - previous)
                if gap > 0:
                    time.sleep(gap)
            self._last_request[parsed.netloc] = time.monotonic()
            started = time.monotonic()
            try:
                self.requests_made += 1
                status, headers, raw, final_url = self._open(url)
            except urllib.error.HTTPError as error:
                status = error.code
                headers = {k.lower(): v for k, v in (error.headers or {}).items()}
                if status == 429 or 500 <= status < 600:
                    last_error = "HTTP {}".format(status)
                    wait = self._retry_after(headers, attempt)
                    if attempt >= self.max_retries:
                        break
                    if self.verbose:
                        print("  retry {} after {} ({:.1f}s)".format(
                            attempt + 1, last_error, wait))
                    time.sleep(wait)
                    attempt += 1
                    continue
                raise FetchError("HTTP {} for {}".format(status, url))
            except (urllib.error.URLError, socket.timeout, OSError) as error:
                last_error = str(getattr(error, "reason", error))
                if attempt >= self.max_retries:
                    break
                wait = min(30.0, (2 ** attempt) * 1.5)
                if self.verbose:
                    print("  retry {} after {} ({:.1f}s)".format(
                        attempt + 1, last_error, wait))
                time.sleep(wait)
                attempt += 1
                continue

            content_type = headers.get("content-type", "")
            if content_type and not any(t in content_type.lower() for t in _TEXTUAL):
                raise FetchError("non-textual content-type {} for {}".format(
                    content_type, url))
            raw = _decompress(raw, headers.get("content-encoding", ""))
            body = _decode(raw, content_type)
            result = FetchResult(
                url=url,
                final_url=final_url or url,
                status=status,
                headers=headers,
                body=body,
                fetched_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                from_cache=False,
                elapsed_ms=int((time.monotonic() - started) * 1000),
            )
            if self.cache is not None:
                self.cache.put(url, result.as_dict())
            return result

        raise FetchError("giving up on {} after {} attempts: {}".format(
            url, self.max_retries + 1, last_error or "unknown error"))

    @staticmethod
    def _retry_after(headers: Dict[str, str], attempt: int) -> float:
        stated = headers.get("retry-after", "")
        if stated:
            try:
                return min(60.0, float(stated))
            except ValueError:
                pass
        return min(30.0, (2 ** attempt) * 2.0)
