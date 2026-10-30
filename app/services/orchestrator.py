"""Routes each issue to the cheapest fixer that can handle it, then shapes a safe patch."""
import hashlib
from html import escape

from pydantic import ValidationError

from ..schemas import PatchAction
from . import cache
from .fixers import llm, rules, vision

VISION_RULES = {"image-alt", "role-img-alt", "svg-img-alt"}
LLM_RULES = {
    "label", "button-name", "link-name", "select-name", "input-button-name", "aria-input-field-name",
    "aria-command-name", "aria-toggle-field-name", "frame-title", "document-title",
}


def _cached(kind: str, parts: list[str], fn):
    k = cache.key(kind, *parts)
    hit = cache.get(k)
    if hit is not None:
        return hit
    out = fn()
    if out:
        cache.put(k, out)
    return out


def _shape(issue, cand: dict, source: str) -> dict | None:
    rid, sel = issue.rule_id, issue.selector
    if source == "rule":
        return {"selector": sel, **{k: cand[k] for k in ("action", "name", "value") if k in cand}}
    if source == "vision":
        is_img = (issue.html or "").lstrip().lower().startswith("<img")
        if is_img:
            return {"selector": sel, "action": "set_attr", "name": "alt", "value": "" if cand["decorative"] else cand["alt"]}
        if cand["decorative"]:
            return {"selector": sel, "action": "set_attr", "name": "aria-hidden", "value": "true"}
        return {"selector": sel, "action": "set_attr", "name": "aria-label", "value": cand["alt"]}
    # llm
    if rid == "document-title":
        return {"selector": "head", "action": "insert_html", "position": "beforeend",
                "value": f"<title>{escape(cand['value'])}</title>"}
    if rid == "frame-title":
        return {"selector": sel, "action": "set_attr", "name": "title", "value": cand["value"]}
    return {"selector": sel, "action": "set_attr", "name": "aria-label", "value": cand["value"]}


def propose(issue, mode: str = "thorough") -> dict | None:
    rid, cand, source = issue.rule_id, None, None
    if rid in rules.RULES:
        cand, source = rules.RULES[rid](issue), "rule"
    elif mode == "thorough" and rid in VISION_RULES and issue.image_path:
        cand = _cached("vision", [cache.file_hash(issue.image_path)], lambda: vision.alt_text(issue))
        source = "vision"
    elif mode == "thorough" and rid in LLM_RULES:
        h = hashlib.sha256((issue.html or "").encode()).hexdigest()
        cand = _cached("llm", [rid, h], lambda: llm.propose(issue))
        source = "llm"
    if not cand:
        return None
    action = _shape(issue, cand, source)
    if not action:
        return None
    try:
        PatchAction(**action)
    except ValidationError:
        return None
    return {"issue_id": issue.id, "rule_id": rid, "action": action, "source": source,
            "confidence": float(cand.get("confidence", 0.5))}
