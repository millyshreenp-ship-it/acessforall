# AccessForAll backend

Detect (axe-core + keyboard audit) → fix (rules / VLM+OCR / LLM) → **validate in headless Chromium** → serve patches to the extension.

## Run
```bash
cp .env.example .env        # add GEMINI_API_KEY (free from aistudio.google.com/apikey) for alt text + label inference
docker compose up --build
```
- Site: http://localhost:8000  (landing page) and http://localhost:8000/app/ (demo + **Live scan** section)
- API docs: http://localhost:8000/docs  (send header `X-API-Key: dev-key`)
- CLI demo: `python scripts/demo.py demo/inaccessible.html`

## Frontend ↔ backend
The static frontend lives in `web/` and is served by the API itself (`app/main.py` mounts it last), so the browser and API share an origin and no CORS setup is needed. `web/app/live.js` drives the **Live scan** section: `POST /scans` → poll `GET /scans/{id}` → `POST /scans/{id}/fixes` → `GET /patches` → `POST /patches/{id}/feedback`, with WebSocket progress as a bonus. Pasted HTML is also previewed in a sandboxed iframe using `/static/apply_patch.js`, the same file the validator runs.

Serving `web/` from another origin (`npx serve web`, port 3000) also works: set the API address under *Server settings* on the page. CORS already allows `localhost` / `127.0.0.1` on any port.
The API key sits in browser JS (`web/app/config.js`). Fine for dev; for production put the API behind your own proxy that adds the key.

## API
| Method | Path | Purpose |
|---|---|---|
| POST | `/scans` | `{url}` or `{html}` (DOM snapshot) → queued scan |
| GET | `/scans/{id}` | status, issues, keyboard audit |
| POST | `/scans/{id}/fixes?mode=fast\|thorough` | generate + validate patches (fast = rules only) |
| GET | `/scans/{id}/patches?only_validated=true` | patches for the extension to apply |
| GET | `/scans/{id}/report?format=json\|html` | WCAG-mapped report |
| POST | `/patches/{id}/feedback` | `accept` / `reject` / `edit` (+ `edited_value`) |
| WS | `/scans/{id}/stream?api_key=…` | live progress events |

## Design notes
- **Patches, not HTML:** models only return values; `schemas.PatchAction` whitelists attributes/styles and blocks scripts/handlers.
- **`app/static/apply_patch.js`** is shared by the validator and should be reused in the extension content script, so what is validated is exactly what ships.
- **Cache:** image hash / element-HTML hash → model result in Redis.
- **Safety:** SSRF guard on URLs and every sub-request, API keys + rate limit, form values and scripts stripped from snapshots. Strip them in the extension too, before upload.
- **Local demo against localhost:** set `ALLOW_PRIVATE_HOSTS=true` (disables SSRF guard; dev only).

## Known limits / next steps
Iframes and shadow DOM are skipped; positive-`tabindex` and trap *fixes* are minimal; patches validate one at a time (batch them to speed up); `create_all` should become Alembic migrations; tests: `pytest tests/`.
