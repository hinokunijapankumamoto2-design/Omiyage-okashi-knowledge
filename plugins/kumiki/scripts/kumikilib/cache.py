"""Content-addressed HTTP cache on the local filesystem.

Re-fetching a page you already have is the cheapest mistake to eliminate:
it costs a request, a rate-limit slot, and a courtesy debt to the host.
Entries are keyed by SHA-256 of the URL and expire on a TTL.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from typing import Any, Dict, Optional

DEFAULT_TTL_SECONDS = 24 * 3600


class Cache:
    """A tiny on-disk cache. Absent or corrupt entries are simply misses."""

    def __init__(self, directory: str, ttl: int = DEFAULT_TTL_SECONDS,
                 enabled: bool = True) -> None:
        self.directory = os.path.abspath(os.path.expanduser(directory))
        self.ttl = ttl
        self.enabled = enabled
        self.hits = 0
        self.misses = 0
        if self.enabled:
            os.makedirs(self.directory, exist_ok=True)

    def key(self, url: str) -> str:
        return hashlib.sha256(url.encode("utf-8")).hexdigest()

    def path(self, url: str) -> str:
        digest = self.key(url)
        # Shard by the first two hex chars so directories stay listable.
        return os.path.join(self.directory, digest[:2], digest + ".json")

    def get(self, url: str) -> Optional[Dict[str, Any]]:
        if not self.enabled:
            return None
        path = self.path(url)
        try:
            stat = os.stat(path)
        except OSError:
            self.misses += 1
            return None
        if self.ttl >= 0 and (time.time() - stat.st_mtime) > self.ttl:
            self.misses += 1
            return None
        try:
            with open(path, "r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except (OSError, ValueError):
            self.misses += 1
            return None
        self.hits += 1
        payload["from_cache"] = True
        return payload

    def put(self, url: str, payload: Dict[str, Any]) -> None:
        if not self.enabled:
            return
        path = self.path(url)
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            temporary = path + ".tmp"
            with open(temporary, "w", encoding="utf-8") as handle:
                json.dump(payload, handle, ensure_ascii=False)
            os.replace(temporary, path)
        except OSError:
            # A cache that cannot write is still a working cache.
            pass

    def stats(self) -> Dict[str, int]:
        return {"hits": self.hits, "misses": self.misses}

    def purge(self, older_than: Optional[int] = None) -> int:
        """Delete expired entries; return how many were removed."""
        if not os.path.isdir(self.directory):
            return 0
        cutoff = time.time() - (older_than if older_than is not None else self.ttl)
        removed = 0
        for root, _dirs, files in os.walk(self.directory):
            for name in files:
                if not name.endswith(".json"):
                    continue
                full = os.path.join(root, name)
                try:
                    if os.stat(full).st_mtime < cutoff:
                        os.remove(full)
                        removed += 1
                except OSError:
                    continue
        return removed
