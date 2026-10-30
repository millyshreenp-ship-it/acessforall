import ipaddress
import socket
from functools import lru_cache
from urllib.parse import urlparse

import redis
from bs4 import BeautifulSoup
from fastapi import Header, HTTPException

from .config import settings

_r = redis.Redis.from_url(settings.redis_url, decode_responses=True)


def valid_key(key: str) -> bool:
    return key in {k.strip() for k in settings.api_keys.split(",") if k.strip()}


def require_key(x_api_key: str = Header(default="")):
    """API-key auth + fixed-window rate limit (per key, per minute)."""
    if not valid_key(x_api_key):
        raise HTTPException(401, "invalid API key")
    bucket = f"rl:{x_api_key}:{__import__('time').time() // 60:.0f}"
    n = _r.incr(bucket)
    if n == 1:
        _r.expire(bucket, 70)
    if n > settings.rate_limit_per_min:
        raise HTTPException(429, "rate limit exceeded")
    return x_api_key


@lru_cache(maxsize=4096)
def _host_is_public(host: str) -> bool:
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return False
    return all(ipaddress.ip_address(i[4][0]).is_global for i in infos)


def url_is_public(url: str) -> bool:
    """SSRF guard: only public http(s) hosts may be scanned."""
    p = urlparse(url)
    if p.scheme not in ("http", "https") or not p.hostname:
        return False
    return True if settings.allow_private_hosts else _host_is_public(p.hostname)


def sanitize_html(html: str) -> str:
    """Privacy: drop scripts and every form value (tokens, passwords, PII) before storing."""
    soup = BeautifulSoup(html, "html.parser")
    for t in soup(["script", "noscript"]):
        t.decompose()
    for el in soup.find_all(["input", "textarea"]):
        el.attrs.pop("value", None)
        if el.name == "textarea":
            el.string = ""
    return str(soup)
