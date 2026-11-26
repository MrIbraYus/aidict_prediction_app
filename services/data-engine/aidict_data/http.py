"""HTTP access shared by all adapters: rate limiting, daily budgets, retries, conditional caching."""
from __future__ import annotations

import hashlib
import json
import os
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

import httpx

USER_AGENT = "AIDICT-data-engine/0.1 (personal research use)"
CACHE_DIR = Path(os.environ.get("AIDICT_CACHE_DIR", Path(__file__).resolve().parents[2] / ".cache"))


class BudgetExceeded(Exception):
    """Raised before a request that would exceed a provider's free quota."""


@dataclass
class RateLimiter:
    """Sliding-window limiter: at most `per_minute` calls in any 60-second window."""

    per_minute: int
    _calls: list[float] = field(default_factory=list)
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def wait(self, now=time.monotonic, sleep=time.sleep) -> None:
        with self._lock:
            t = now()
            self._calls = [c for c in self._calls if t - c < 60]
            if len(self._calls) >= self.per_minute:
                delay = 60 - (t - self._calls[0]) + 0.05
                sleep(max(0.0, delay))
                t = now()
                self._calls = [c for c in self._calls if t - c < 60]
            self._calls.append(t)


@dataclass
class DailyBudget:
    """Hard daily cap (e.g. API-Football free plan). Persisted so separate job runs share the count."""

    provider: str
    limit: int
    state_file: Path | None = None

    def _path(self) -> Path:
        return self.state_file or CACHE_DIR / f"budget-{self.provider}.json"

    def _load(self) -> dict:
        try:
            return json.loads(self._path().read_text())
        except (FileNotFoundError, json.JSONDecodeError):
            return {}

    def used_today(self) -> int:
        s = self._load()
        return s.get("count", 0) if s.get("day") == time.strftime("%Y-%m-%d", time.gmtime()) else 0

    def spend(self, n: int = 1) -> None:
        used = self.used_today()
        if used + n > self.limit:
            raise BudgetExceeded(f"{self.provider}: daily budget {self.limit} reached ({used} used)")
        p = self._path()
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps({"day": time.strftime("%Y-%m-%d", time.gmtime()), "count": used + n}))


class HttpClient:
    """GET with retries (429/5xx, exponential backoff), optional limiter/budget and on-disk ETag cache."""

    def __init__(self, base_url: str = "", headers: dict | None = None, limiter: RateLimiter | None = None,
                 budget: DailyBudget | None = None, timeout: float = 20.0, retries: int = 3,
                 transport: httpx.BaseTransport | None = None, cache: bool = False):
        self.client = httpx.Client(base_url=base_url, headers={"User-Agent": USER_AGENT, **(headers or {})},
                                   timeout=timeout, transport=transport, follow_redirects=True)
        self.limiter, self.budget, self.retries, self.cache = limiter, budget, retries, cache
        self.last_response: httpx.Response | None = None

    def _cache_paths(self, url: str) -> tuple[Path, Path]:
        key = hashlib.sha256(url.encode()).hexdigest()[:24]
        return CACHE_DIR / "http" / f"{key}.body", CACHE_DIR / "http" / f"{key}.meta.json"

    def get(self, url: str, params: dict | None = None) -> httpx.Response:
        full = str(self.client.build_request("GET", url, params=params).url)
        body_p, meta_p = self._cache_paths(full)
        headers = {}
        if self.cache and meta_p.exists():
            meta = json.loads(meta_p.read_text())
            if meta.get("etag"):
                headers["If-None-Match"] = meta["etag"]
            if meta.get("last_modified"):
                headers["If-Modified-Since"] = meta["last_modified"]
        attempt = 0
        while True:
            if self.limiter:
                self.limiter.wait()
            if self.budget:
                self.budget.spend()
            try:
                r = self.client.get(url, params=params, headers=headers)
            except httpx.TransportError:
                if attempt >= self.retries:
                    raise
                attempt += 1
                time.sleep(min(30, 2 ** attempt))
                continue
            if r.status_code in (429, 500, 502, 503, 504) and attempt < self.retries:
                attempt += 1
                retry_after = r.headers.get("Retry-After")
                time.sleep(float(retry_after) if retry_after and retry_after.isdigit() else min(30, 2 ** attempt))
                continue
            break
        if self.cache and r.status_code == 304 and body_p.exists():
            r = httpx.Response(200, content=body_p.read_bytes(), headers={"x-aidict-cache": "hit"}, request=r.request)
        elif self.cache and r.status_code == 200:
            body_p.parent.mkdir(parents=True, exist_ok=True)
            body_p.write_bytes(r.content)
            meta_p.write_text(json.dumps({"etag": r.headers.get("ETag"), "last_modified": r.headers.get("Last-Modified"), "url": full}))
        self.last_response = r
        return r
