import re
from collections import Counter
from html import escape

ORDER = ["critical", "serious", "moderate", "minor"]


def wcag_refs(tags: list[str]) -> list[str]:
    """axe tag 'wcag143' -> '1.4.3'"""
    return sorted({f"{m[1]}.{m[2]}.{m[3]}" for t in tags or [] if (m := re.fullmatch(r"wcag(\d)(\d)(\d+)", t))})


def build_report(scan, issues, patches) -> dict:
    by_issue = {}
    for p in patches:
        by_issue.setdefault(p.issue_id, []).append(p)
    rows = []
    for i in issues:
        ps = by_issue.get(i.id, [])
        rows.append({
            "rule": i.rule_id, "impact": i.impact, "selector": i.selector, "wcag": wcag_refs(i.wcag),
            "message": i.message,
            "fix": next(({"action": p.action, "source": p.source, "confidence": p.confidence,
                          "validated": p.validated, "status": p.status} for p in ps), None),
        })
    return {
        "scan_id": scan.id, "url": scan.url, "status": scan.status, "keyboard": scan.keyboard,
        "summary": {
            "issues": len(issues),
            "by_impact": dict(Counter(i.impact or "unknown" for i in issues)),
            "by_wcag": dict(Counter(c for r in rows for c in r["wcag"])),
            "patches_proposed": len(patches),
            "patches_validated": sum(p.validated for p in patches),
            "patches_accepted": sum(p.status == "accepted" for p in patches),
        },
        "issues": rows,
    }


def render_html(rep: dict) -> str:
    s = rep["summary"]
    rows = "".join(
        f"<tr><td>{escape(r['impact'] or '')}</td><td>{escape(r['rule'])}</td><td>{escape(', '.join(r['wcag']))}</td>"
        f"<td><code>{escape(r['selector'])}</code></td>"
        f"<td>{escape(str(r['fix']['action'].get('value'))) + ' (' + r['fix']['source'] + ', ' + ('verified' if r['fix']['validated'] else 'unverified') + ')' if r['fix'] else '-'}</td></tr>"
        for r in sorted(rep["issues"], key=lambda r: ORDER.index(r["impact"]) if r["impact"] in ORDER else 9))
    return f"""<!doctype html><html lang="en"><meta charset="utf-8"><title>Accessibility report</title>
<style>body{{font:16px system-ui;margin:2rem;color:#111}}table{{border-collapse:collapse;width:100%}}
td,th{{border:1px solid #ccc;padding:6px;text-align:left}}</style>
<h1>Accessibility report</h1><p>{escape(rep.get('url') or 'DOM snapshot')}</p>
<p>{s['issues']} issues &middot; {s['patches_validated']}/{s['patches_proposed']} fixes verified &middot; {s['patches_accepted']} accepted</p>
<table><tr><th>Impact</th><th>Rule</th><th>WCAG</th><th>Element</th><th>Fix</th></tr>{rows}</table></html>"""
