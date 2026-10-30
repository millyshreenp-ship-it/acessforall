from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Issue, Patch, Scan
from ..schemas import ScanCreate
from ..security import sanitize_html, url_is_public
from ..services.report import build_report, render_html
from ..worker import fix_task, scan_task

router = APIRouter(tags=["scans"])


def _scan_or_404(db, scan_id) -> Scan:
    s = db.get(Scan, scan_id)
    if not s:
        raise HTTPException(404, "scan not found")
    return s


def _issue(i: Issue) -> dict:
    return {"id": i.id, "rule": i.rule_id, "impact": i.impact, "selector": i.selector,
            "html": i.html, "wcag": i.wcag, "message": i.message}


def _patch(p: Patch) -> dict:
    return {"id": p.id, "issue_id": p.issue_id, "action": p.action, "source": p.source,
            "confidence": p.confidence, "validated": p.validated, "validation": p.validation, "status": p.status}


@router.post("/scans", status_code=202)
def create_scan(body: ScanCreate, db: Session = Depends(get_db)):
    if body.url and not url_is_public(str(body.url)):
        raise HTTPException(400, "URL must be a public http(s) address")
    scan = Scan(url=str(body.url) if body.url else None,
                snapshot=sanitize_html(body.html) if body.html else None)
    db.add(scan)
    db.commit()
    scan_task.delay(scan.id)
    return {"id": scan.id, "status": scan.status}


@router.get("/scans/{scan_id}")
def get_scan(scan_id: str, db: Session = Depends(get_db)):
    s = _scan_or_404(db, scan_id)
    issues = db.scalars(select(Issue).where(Issue.scan_id == scan_id)).all()
    return {"id": s.id, "url": s.url, "status": s.status, "error": s.error, "keyboard": s.keyboard,
            "issues": [_issue(i) for i in issues]}


@router.post("/scans/{scan_id}/fixes", status_code=202)
def generate_fixes(scan_id: str, mode: Literal["fast", "thorough"] = "thorough", db: Session = Depends(get_db)):
    s = _scan_or_404(db, scan_id)
    if s.status not in ("scanned", "done"):
        raise HTTPException(409, f"scan is {s.status}; wait until it is 'scanned'")
    # flip the status now, not in the worker: a client polling for 'done' must never see the
    # previous run's 'done' in the gap before the worker picks the job up
    s.status = "fixing"
    db.commit()
    fix_task.delay(scan_id, mode)
    return {"id": scan_id, "mode": mode, "status": "queued"}


@router.get("/scans/{scan_id}/patches")
def list_patches(scan_id: str, only_validated: bool = False, db: Session = Depends(get_db)):
    _scan_or_404(db, scan_id)
    q = select(Patch).where(Patch.scan_id == scan_id)
    if only_validated:
        q = q.where(Patch.validated.is_(True))
    return [_patch(p) for p in db.scalars(q).all()]


@router.get("/scans/{scan_id}/report")
def report(scan_id: str, format: Literal["json", "html"] = "json", db: Session = Depends(get_db)):
    s = _scan_or_404(db, scan_id)
    issues = db.scalars(select(Issue).where(Issue.scan_id == scan_id)).all()
    patches = db.scalars(select(Patch).where(Patch.scan_id == scan_id)).all()
    rep = build_report(s, issues, patches)
    return HTMLResponse(render_html(rep)) if format == "html" else rep
