"""Thin Gemini client (Google AI Studio free tier) using plain REST via httpx.
Handles free-tier rate limits (HTTP 429) with exponential backoff."""
import threading
import time

import httpx

from ...config import settings

_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


_lock = threading.Lock()
_next_slot = 0.0


def _throttle():
    """Space requests out globally so parallel workers stay under the free-tier RPM cap."""
    global _next_slot
    with _lock:
        now = time.monotonic()
        wait = max(0.0, _next_slot - now)
        _next_slot = max(now, _next_slot) + 60.0 / max(1, settings.gemini_rpm)
    if wait:
        time.sleep(wait)


def enabled() -> bool:
    return bool(settings.gemini_api_key)


def generate(system: str, parts: list[dict], max_tokens: int = 250, retries: int = 4) -> str | None:
    """Send one request, return the response text (JSON mode) or None on failure."""
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "temperature": 0.2,
            "responseMimeType": "application/json",
            # 2.5 models spend tokens on "thinking" by default; not needed for short labels
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    headers = {"x-goog-api-key": settings.gemini_api_key, "Content-Type": "application/json"}
    url = _URL.format(model=settings.model)
    delay = 4.0  # free tier is ~10 requests/min, so back off generously
    for attempt in range(retries + 1):
        _throttle()
        try:
            r = httpx.post(url, json=body, headers=headers, timeout=60)
        except httpx.HTTPError:
            r = None
        if r is not None and r.status_code == 200:
            try:
                return r.json()["candidates"][0]["content"]["parts"][0]["text"]
            except (KeyError, IndexError, ValueError):
                return None
        if r is not None and r.status_code not in (429, 500, 503):
            return None  # bad key / bad request: retrying will not help
        if attempt < retries:
            time.sleep(delay)
            delay *= 2
    return None
