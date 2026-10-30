"""LLM fixer: infer accessible names from surrounding context. Output is a value only; the
orchestrator turns it into a whitelisted patch, so the model can never emit arbitrary HTML."""
import json
import re

from . import gemini

SYSTEM = (
    "You are a web accessibility expert. Given a failing element and its surrounding HTML, "
    "propose the accessible text for it. Use only information present in the context; never invent facts. "
    'Reply with ONLY JSON: {"value": "<short text, max 80 chars>", "confidence": <0-1>}. '
    "Use confidence below 0.4 if the context does not make the purpose clear."
)

def parse_json(text: str):
    m = re.search(r"\{.*\}", text, re.S)
    return json.loads(m.group(0)) if m else None


def propose(issue) -> dict | None:
    if not gemini.enabled():
        return None
    prompt = (
        f"Rule: {issue.rule_id}\nProblem: {issue.message}\n\n"
        f"Element:\n{(issue.html or '')[:800]}\n\nSurrounding HTML:\n{(issue.context or '')[:1500]}"
    )
    try:
        text = gemini.generate(SYSTEM, [{"text": prompt}], max_tokens=200)
        out = parse_json(text) if text else None
    except Exception:
        return None
    if not out or not str(out.get("value", "")).strip():
        return None
    return {"value": str(out["value"]).strip()[:120], "confidence": float(out.get("confidence", 0.5))}
