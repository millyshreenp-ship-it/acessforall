"""The differentiator: every patch is applied in a fresh headless page and re-tested.
A patch is accepted only if it fixes its target issue and introduces no regressions."""
from collections import Counter
from pathlib import Path

from playwright.async_api import async_playwright

from .scanner import PATH_JS, keyboard_audit, load, new_context, run_axe

APPLY_SRC = (Path(__file__).resolve().parents[1] / "static" / "apply_patch.js").read_text()


async def _counts(page) -> Counter:
    c = Counter()
    for v in (await run_axe(page))["violations"]:
        c[v["id"]] += len(v["nodes"])
    return c


async def validate_many(url, html, items: list[dict]) -> list[dict]:
    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox"])
        try:
            ctx = await new_context(browser)
            page = await ctx.new_page()
            await load(page, url, html)
            base = await _counts(page)
            base_kb = await keyboard_audit(page)
            await page.close()

            for it in items:
                page = await ctx.new_page()
                try:
                    await load(page, url, html)
                    await page.add_script_tag(content=APPLY_SRC)
                    if not await page.evaluate("p => window.__afaApply(p)", it["action"]):
                        results.append({"ok": False, "reason": "selector not found"})
                        continue
                    after = await _counts(page)
                    kb = await keyboard_audit(page)
                    rule = it["rule_id"]
                    if rule in base:
                        target_ok = after.get(rule, 0) < base[rule]
                    elif rule == "kbd-unreachable":
                        target_ok = len(kb["unreachable"]) < len(base_kb["unreachable"])
                    else:
                        target_ok = True
                    regress = [r for r in after if after[r] > base.get(r, 0)]
                    new_trap = len(kb["traps"]) > len(base_kb["traps"])
                    ok = target_ok and not regress and not new_trap
                    reason = "ok" if ok else (
                        "did not fix target issue" if not target_ok
                        else f"regressions: {regress}" if regress else "introduced focus trap")
                    results.append({"ok": ok, "reason": reason, "regressions": regress})
                except Exception as e:
                    results.append({"ok": False, "reason": f"error: {str(e)[:120]}"})
                finally:
                    await page.close()
        finally:
            await browser.close()
    return results
