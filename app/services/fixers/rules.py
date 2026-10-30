"""Deterministic fixers. No model calls: fast, free, fully predictable."""


def _hex2rgb(h: str):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _lin(c: float) -> float:
    c /= 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def luminance(rgb) -> float:
    r, g, b = map(_lin, rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b) -> float:
    hi, lo = sorted((luminance(a), luminance(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def fix_contrast_color(fg: str, bg: str, target: float = 4.5) -> str:
    """Nudge fg toward black/white (whichever contrasts with bg) until WCAG ratio is met."""
    f, b = _hex2rgb(fg), _hex2rgb(bg)
    end = (0, 0, 0) if luminance(b) > 0.18 else (255, 255, 255)
    for pct in range(0, 101, 2):
        c = tuple(round(f[i] + (end[i] - f[i]) * pct / 100) for i in range(3))
        if contrast(c, b) >= target:
            return "#%02x%02x%02x" % c
    return "#%02x%02x%02x" % end


def _contrast(issue):
    d = issue.data or {}
    fg, bg = d.get("fgColor"), d.get("bgColor")
    if not fg or not bg:
        return None
    try:
        target = float(str(d.get("expectedContrastRatio") or "4.5").split(":")[0])
        color = fix_contrast_color(fg, bg, target)
    except Exception:
        return None
    return {"action": "set_style", "name": "color", "value": color, "confidence": 0.95}


RULES = {
    "color-contrast": _contrast,
    "html-has-lang": lambda i: {"action": "set_attr", "name": "lang", "value": "en", "confidence": 0.5},
    "html-lang-valid": lambda i: {"action": "set_attr", "name": "lang", "value": "en", "confidence": 0.5},
    "meta-viewport": lambda i: {"action": "set_attr", "name": "content",
                                "value": "width=device-width, initial-scale=1", "confidence": 0.9},
    "kbd-unreachable": lambda i: {"action": "set_attr", "name": "tabindex", "value": "0", "confidence": 0.8},
    "tabindex": lambda i: {"action": "set_attr", "name": "tabindex", "value": "0", "confidence": 0.9},
    "scrollable-region-focusable": lambda i: {"action": "set_attr", "name": "tabindex", "value": "0", "confidence": 0.9},
    "aria-hidden-focus": lambda i: {"action": "set_attr", "name": "tabindex", "value": "-1", "confidence": 0.7},
}
