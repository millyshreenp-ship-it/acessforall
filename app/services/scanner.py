"""Deterministic detection: axe-core + a keyboard-traversal audit, run in headless Chromium."""
import os
from pathlib import Path

from playwright.async_api import async_playwright

from ..config import settings
from ..security import url_is_public

_AXE = None


def axe_src() -> str:
    global _AXE
    if _AXE is None:
        _AXE = Path(settings.axe_path).read_text(encoding="utf-8")
    return _AXE


PATH_JS = """window.__afaPath = (el) => {
  if (!el || el === document.body) return 'body';
  if (el.id && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) return '#' + CSS.escape(el.id);
  const parts = [];
  while (el && el.nodeType === 1 && el !== document.documentElement) {
    let i = 1, s = el;
    while ((s = s.previousElementSibling)) if (s.tagName === el.tagName) i++;
    parts.unshift(el.tagName.toLowerCase() + ':nth-of-type(' + i + ')');
    el = el.parentElement;
  }
  return 'html > ' + parts.join(' > ');
}"""

FOCUSABLE_JS = """() => {
  const sel = 'a[href],button,input:not([type=hidden]):not([type=radio]),select,textarea,[tabindex],[role=button],[role=link],[onclick]';
  return [...document.querySelectorAll(sel)].filter(e => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && !e.disabled
      && e.getAttribute('tabindex') !== '-1';
  }).map(e => window.__afaPath(e));
}"""

LABEL_IMG_RULES = {"image-alt", "role-img-alt", "svg-img-alt"}


async def _guard(route):
    u = route.request.url
    if u.split(":", 1)[0] in ("data", "blob", "about") or url_is_public(u):
        await route.continue_()
    else:
        await route.abort()


async def new_context(browser):
    ctx = await browser.new_context(bypass_csp=True, viewport={"width": 1280, "height": 800})
    await ctx.route("**/*", _guard)  # SSRF guard also covers redirects/subresources
    return ctx


async def load(page, url, html):
    if url:
        await page.goto(url, wait_until="load", timeout=45000)
        try:
            await page.wait_for_load_state("networkidle", timeout=8000)
        except Exception:
            pass
    else:
        await page.set_content(html or "", wait_until="load")


async def run_axe(page) -> dict:
    await page.add_script_tag(content=axe_src())
    return await page.evaluate("async () => await axe.run(document, {resultTypes: ['violations']})")


def flatten(axe_result: dict) -> list[dict]:
    out = []
    for v in axe_result["violations"]:
        for n in v["nodes"]:
            tgt = n["target"]
            if len(tgt) != 1 or not isinstance(tgt[0], str):
                continue  # iframes / shadow DOM: out of MVP scope
            data = {}
            for grp in ("any", "all", "none"):
                for c in n.get(grp, []):
                    if isinstance(c.get("data"), dict):
                        data.update(c["data"])
            out.append(dict(
                rule_id=v["id"], impact=v.get("impact"), selector=tgt[0], html=n["html"][:2000],
                wcag=v["tags"], message=(n.get("failureSummary") or "")[:500], data=data,
            ))
    return out


async def keyboard_audit(page) -> dict:
    """Press Tab repeatedly; report unreachable interactive elements and focus traps."""
    await page.evaluate(PATH_JS)
    focusable = await page.evaluate(FOCUSABLE_JS)
    await page.evaluate("() => { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); }")
    limit = min(settings.max_tabs, len(focusable) * 2 + 6)
    seen = []
    for _ in range(limit):
        await page.keyboard.press("Tab")
        seen.append(await page.evaluate("() => window.__afaPath(document.activeElement)"))
    reached = set(seen)
    tail = seen[-8:]
    traps = [tail[-1]] if (len(focusable) > 3 and len(seen) >= 8 and len(set(tail)) <= 2 and "body" not in tail) else []
    return {
        "focusable": len(focusable), "tab_stops": len(reached), "traps": traps,
        "unreachable": [s for s in focusable if s not in reached][:50],
    }


def kb_issues(kb: dict) -> list[dict]:
    out = []
    for sel in kb["unreachable"]:
        out.append(dict(rule_id="kbd-unreachable", impact="serious", selector=sel, html="", wcag=["wcag211"],
                        message="Interactive element cannot be reached with the Tab key.", data={}))
    for sel in kb["traps"]:
        out.append(dict(rule_id="kbd-trap", impact="critical", selector=sel, html="", wcag=["wcag212"],
                        message="Keyboard focus appears trapped here.", data={}))
    return out


async def enrich(page, issues: list[dict], scan_id: str, limit: int = 200):
    """Attach parent context for the LLM and element screenshots for the VLM/OCR."""
    d = Path(settings.media_dir) / scan_id
    d.mkdir(parents=True, exist_ok=True)
    for n, i in enumerate(issues[:limit]):
        try:
            loc = page.locator(i["selector"]).first
            i["context"] = await loc.evaluate("e => (e.parentElement || e).outerHTML.slice(0, 1500)")
            if not i.get("html"):
                i["html"] = await loc.evaluate("e => e.outerHTML.slice(0, 500)")
            if i["rule_id"] in LABEL_IMG_RULES:
                png = await loc.screenshot(timeout=3000)
                p = d / f"{n}.png"
                p.write_bytes(png)
                i["image_path"] = str(p)
        except Exception:
            pass


async def scan(url, html, scan_id: str) -> dict:
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox"])
        try:
            page = await (await new_context(browser)).new_page()
            await load(page, url, html)
            issues = flatten(await run_axe(page))
            kb = await keyboard_audit(page)
            issues += kb_issues(kb)
            await enrich(page, issues, scan_id)
        finally:
            await browser.close()
    return {"issues": issues, "keyboard": kb}
