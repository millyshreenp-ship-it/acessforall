"""Vision fixer: OCR + multimodal model for image alt text."""
import base64
from io import BytesIO

import pytesseract
from PIL import Image

from . import gemini
from .llm import parse_json

SYSTEM = (
    "You write alt text for blind users. Describe what the image conveys in context, max 125 characters, "
    "no 'image of'. If the image contains text, include it. If it is purely decorative, set decorative true. "
    'Reply with ONLY JSON: {"alt": "...", "decorative": false, "confidence": <0-1>}.'
)


def ocr(png: bytes) -> str:
    try:
        return pytesseract.image_to_string(Image.open(BytesIO(png))).strip()[:300]
    except Exception:
        return ""


def alt_text(issue) -> dict | None:
    if not gemini.enabled() or not issue.image_path:
        return None
    png = open(issue.image_path, "rb").read()
    hint = ocr(png)
    text = f"Surrounding HTML:\n{(issue.context or '')[:800]}\n\nOCR text found in image: {hint or '(none)'}"
    try:
        raw = gemini.generate(SYSTEM, [
            {"inline_data": {"mime_type": "image/png", "data": base64.b64encode(png).decode()}},
            {"text": text}], max_tokens=250)
        out = parse_json(raw) if raw else None
    except Exception:
        return None
    if not out:
        return None
    return {"alt": str(out.get("alt", "")).strip()[:150], "decorative": bool(out.get("decorative")),
            "confidence": float(out.get("confidence", 0.5))}
