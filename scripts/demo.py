"""End-to-end demo: python scripts/demo.py demo/inaccessible.html"""
import sys
import time

import httpx

BASE, H = "http://localhost:8000", {"X-API-Key": "dev-key"}
html = open(sys.argv[1]).read()
c = httpx.Client(base_url=BASE, headers=H, timeout=60)


def wait(scan_id, states):
    while (s := c.get(f"/scans/{scan_id}").json())["status"] not in states:
        if s["status"] == "failed":
            sys.exit(s["error"])
        time.sleep(1)
    return s


sid = c.post("/scans", json={"html": html}).json()["id"]
s = wait(sid, {"scanned"})
print(f"{len(s['issues'])} issues found")
c.post(f"/scans/{sid}/fixes", params={"mode": "thorough"})
time.sleep(1)
wait(sid, {"done"})
for p in c.get(f"/scans/{sid}/patches").json():
    print(("OK  " if p["validated"] else "REJ ") + p["source"], p["action"], p["validation"]["reason"])
print(f"Report: {BASE}/scans/{sid}/report?format=html  (add header X-API-Key: dev-key)")
