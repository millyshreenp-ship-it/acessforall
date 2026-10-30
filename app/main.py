import json
from contextlib import asynccontextmanager
from pathlib import Path

import redis.asyncio as aioredis
from fastapi import Depends, FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .db import Base, engine
from .routers import patches, scans
from .security import require_key, valid_key


@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(engine)  # swap for Alembic once the schema stabilises
    yield


app = FastAPI(title="AccessForAll API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origin_regex=r"(chrome|moz)-extension://.*|http://(localhost|127\.0\.0\.1):\d+",
    allow_methods=["*"], allow_headers=["*"])
app.include_router(scans.router, dependencies=[Depends(require_key)])
app.include_router(patches.router, dependencies=[Depends(require_key)])


@app.get("/health")
def health():
    return {"ok": True}


@app.websocket("/scans/{scan_id}/stream")
async def stream(ws: WebSocket, scan_id: str, api_key: str = ""):
    """Live progress for the demo: scanning -> scanned -> proposing -> validating -> done."""
    if not valid_key(api_key):
        await ws.close(code=4401)
        return
    await ws.accept()
    r = aioredis.from_url(settings.redis_url, decode_responses=True)
    ps = r.pubsub()
    await ps.subscribe(f"scan:{scan_id}")
    try:
        async for msg in ps.listen():
            if msg["type"] == "message":
                await ws.send_text(msg["data"])
                if json.loads(msg["data"]).get("stage") in ("done", "failed"):
                    break
    finally:
        await ps.unsubscribe()
        await r.aclose()
        await ws.close()


# --- frontend -------------------------------------------------------------------------------
# /static/apply_patch.js is the same file the validator runs, so the preview applies exactly
# what was verified. The site itself is mounted last so it never shadows an API route.
_static = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=_static), name="static")
if Path(settings.web_dir).is_dir():
    app.mount("/", StaticFiles(directory=settings.web_dir, html=True), name="web")
