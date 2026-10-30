import asyncio
import json
from concurrent.futures import ThreadPoolExecutor

import redis
from sqlalchemy import delete, select

from ..config import settings
from ..db import SessionLocal
from ..models import Issue, Patch, Scan
from . import orchestrator, scanner, validator

_r = redis.Redis.from_url(settings.redis_url, decode_responses=True)


def progress(scan_id: str, stage: str, **kw):
    _r.publish(f"scan:{scan_id}", json.dumps({"stage": stage, **kw}))


def run_scan_job(scan_id: str):
    with SessionLocal() as db:
        scan = db.get(Scan, scan_id)
        scan.status = "scanning"
        db.commit()
        progress(scan_id, "scanning")
        try:
            res = asyncio.run(scanner.scan(scan.url, scan.snapshot, scan_id))
        except Exception as e:
            scan.status, scan.error = "failed", str(e)[:500]
            db.commit()
            progress(scan_id, "failed", error=scan.error)
            return
        scan.keyboard = res["keyboard"]
        for it in res["issues"]:
            db.add(Issue(scan_id=scan_id, **{k: it.get(k) for k in (
                "rule_id", "impact", "selector", "html", "context", "wcag", "message", "data", "image_path")}))
        scan.status = "scanned"
        db.commit()
        progress(scan_id, "scanned", issues=len(res["issues"]))


def run_fix_job(scan_id: str, mode: str):
    with SessionLocal() as db:
        scan = db.get(Scan, scan_id)
        issues = db.scalars(select(Issue).where(Issue.scan_id == scan_id)).all()
        db.execute(delete(Patch).where(Patch.scan_id == scan_id))
        scan.status = "fixing"
        db.commit()

        cands = []
        with ThreadPoolExecutor(4) as ex:
            for n, c in enumerate(ex.map(lambda i: orchestrator.propose(i, mode), issues)):
                if c:
                    cands.append(c)
                progress(scan_id, "proposing", done=n + 1, total=len(issues))

        progress(scan_id, "validating", candidates=len(cands))
        try:
            results = asyncio.run(validator.validate_many(
                scan.url, scan.snapshot, [{"rule_id": c["rule_id"], "action": c["action"]} for c in cands]))
        except Exception as e:
            scan.status, scan.error = "failed", str(e)[:500]
            db.commit()
            progress(scan_id, "failed", error=scan.error)
            return

        for c, r in zip(cands, results):
            db.add(Patch(scan_id=scan_id, issue_id=c["issue_id"], action=c["action"], source=c["source"],
                         confidence=c["confidence"], validated=r["ok"], validation=r,
                         status="proposed" if r["ok"] else "failed_validation"))
        scan.status = "done"
        db.commit()
        ok = sum(r["ok"] for r in results)
        progress(scan_id, "done", validated=ok, rejected=len(results) - ok)
