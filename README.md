# AccessForAll

**Make any website work for everyone.** AccessForAll is an open-source accessibility automation engine. It scans a web page for the barriers that block blind, deaf and motor-impaired people, fixes what it can safely, **proves each fix works**, and flags anything that needs a human.

> Built around WCAG 2.2. Free, self-hostable, and powered by the free Google Gemini API.

---

## The problem

Most of the web fails basic accessibility standards. Images have no alt text, buttons and form fields have no labels, text is too faint to read, and many controls can't be reached with a keyboard. Screen reader users hear "button" with no hint of what it does. Manual audits are slow and expensive, so most site owners never fix these problems.

## What it does

| Step | Tool | What happens |
|---|---|---|
| **1. Crawl** | Playwright | Loads the page in headless Chromium, walks the real tab order and captures screenshots. |
| **2. Audit** | axe-core + custom checks | Runs the standard WCAG rules plus a keyboard-traversal audit that finds unreachable controls and focus traps. |
| **3. Perceive** | Tesseract OCR + Gemini vision | Reads text inside images, then writes meaningful alt text (or marks the image decorative). |
| **4. Repair** | Rules + Gemini | Fixes contrast, language, viewport and tabindex with deterministic rules, and infers missing labels for buttons, links, form fields, frames and page titles from context. |
| **5. Verify** | Headless re-test | Applies each patch in a fresh browser page and re-audits. A fix is kept **only if it fixes its target issue and introduces no regressions**. |
| **6. Report** | WCAG-mapped report | Gives the issues found, the fixes applied and what still needs human review, as HTML or JSON. |

### Why you can trust the fixes

- **Patches, not HTML.** The AI model only ever returns a short text value. The server wraps it in a whitelisted patch (`app/schemas.py`) that allows only safe attributes (`alt`, `lang`, `title`, `aria-*`...) and styles. Scripts, event handlers and `javascript:` URLs are rejected, so the model can never inject code.
- **Verified before shipped.** The same `apply_patch.js` runs in the validator and in the live preview, so what was tested is exactly what you get.
- **Cheapest fixer first.** Deterministic rules run for free. The AI is used only for things that need judgement, and results are cached by image/element hash so nothing is paid for twice.
- **Human in the loop.** Every patch can be accepted, rejected or edited via the feedback endpoint.

---

## The website

The frontend is a static site in `web/`, served by the API itself, so there is no build step and no CORS setup.

| Page | URL | What it is |
|---|---|---|
| **Landing page** | `http://localhost:8000/` | What AccessForAll is, how it works, who it helps, and the roadmap. |
| **Interactive demo** | `http://localhost:8000/app/` | A fictional broken online shop you can scan and repair in the browser, plus a **Scan a real page** section that talks to the backend. |
| **API docs** | `http://localhost:8000/docs` | Interactive Swagger UI for every endpoint. |

**In the demo app you can:**
- Scan the demo shop (13 audit rules across visual, hearing and motor needs) and click **Generate accessible version** to see the score jump and a list of every change made.
- Switch to **Screen reader view** to see what a blind user hears, with a read-aloud button, and toggle the **tab order overlay** to see keyboard navigation.
- Use the visual tools: a colour-contrast checker with suggested fixes, scalable text, and page outline.
- Open **Display settings** (colour mode, text size up to 300%, line spacing, target size, reduced motion), which are saved in your browser.
- Use **Scan a real page**: paste a URL or raw HTML, choose **Fast** (rules only, no key needed) or **Thorough** (adds Gemini), and get issues, verified fixes, a live preview with fixes applied, and downloadable HTML/JSON reports.

The site is built to be accessible itself: skip link, keyboard navigation, ARIA live regions and the Atkinson Hyperlegible font.

---

## Quick start

**You need:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) and a free Gemini API key from <https://aistudio.google.com/apikey>.

```bash
# 1. Create your config file
cp .env.example .env            # Windows PowerShell: Copy-Item .env.example .env

# 2. Open .env and paste your key after GEMINI_API_KEY=

# 3. Start everything (API, worker, Postgres, Redis)
docker compose up --build
```

Then open **http://localhost:8000**. The first build takes a few minutes because it downloads Chromium.

**Try it from the command line:**
```bash
python scripts/demo.py demo/inaccessible.html
```
This scans a deliberately broken page, generates fixes and prints which were verified.

> **Never commit your `.env` file.** It holds your API key and is listed in `.gitignore`. Only `.env.example` (with a blank key) belongs in the repo.

### Configuration (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | *(empty)* | Enables AI alt text and label inference. Without it, only rule-based fixes run. |
| `MODEL` | `gemini-2.5-flash` | Gemini model to use. |
| `GEMINI_RPM` | `9` | Requests per minute. Free tier allows about 10, so scans slow down instead of failing. Raise it on a paid key. |
| `API_KEYS` | `dev-key` | Comma-separated keys clients send in the `X-API-Key` header. |
| `RATE_LIMIT_PER_MIN` | `60` | Per-key API rate limit. |
| `ALLOW_PRIVATE_HOSTS` | `false` | Set `true` only to scan `localhost` sites in local demos. It disables the SSRF protection. |

---

## API

Send the header `X-API-Key: dev-key` with every request.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/scans` | Body `{"url": "..."}` or `{"html": "..."}`. Queues a scan. |
| `GET` | `/scans/{id}` | Status, issues and keyboard audit. |
| `POST` | `/scans/{id}/fixes?mode=fast\|thorough` | Generates and verifies patches. `fast` = rules only. |
| `GET` | `/scans/{id}/patches?only_validated=true` | Patches ready to apply. |
| `GET` | `/scans/{id}/report?format=json\|html` | WCAG-mapped report. |
| `POST` | `/patches/{id}/feedback` | `accept`, `reject` or `edit` (with `edited_value`). |
| `WS` | `/scans/{id}/stream?api_key=...` | Live progress: scanning, proposing, validating, done. |
| `GET` | `/health` | Health check. |

**Example:**
```bash
curl -X POST http://localhost:8000/scans \
  -H "X-API-Key: dev-key" -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

---

## Architecture

```
Browser (web/)  ──►  FastAPI (app/main.py)  ──►  Celery worker  ──►  Playwright + axe-core
                          │                           │
                      PostgreSQL                  Gemini API
                  (scans, issues, patches)     (alt text, labels)
                          └──── Redis: job queue, result cache, live progress ────┘
```

```
app/
  main.py                 API, WebSocket progress, serves the website
  routers/                /scans and /patches endpoints
  services/
    scanner.py            axe-core + keyboard audit in headless Chromium
    orchestrator.py       routes each issue to the cheapest fixer, shapes the safe patch
    fixers/rules.py       deterministic fixes (contrast, lang, viewport, tabindex)
    fixers/llm.py         Gemini: infer accessible names from context
    fixers/vision.py      OCR + Gemini vision: image alt text
    fixers/gemini.py      Gemini REST client with rate limiting and retry
    validator.py          applies each patch in a fresh page and re-tests
    report.py             WCAG-mapped HTML/JSON report
  static/apply_patch.js   the one patch applier shared by validator and preview
web/                      landing page + interactive demo (static, no build)
scripts/demo.py           end-to-end CLI demo
tests/                    pytest suite
```

**Security:** SSRF guard on URLs and every sub-request, API key auth with rate limiting, and form values and scripts stripped from page snapshots.

---

## Who it helps

- **Blind and low-vision users:** alt text, labels, contrast, scalable text and screen-reader structure.
- **Deaf and hard-of-hearing users:** flags video without captions and phone-only support.
- **Motor-impaired users:** keyboard reachability, focus visibility, touch-target size and time limits.
- **Site owners:** NGOs, schools, small businesses and public sites that can't afford manual audits.

## Roadmap

- [x] Audit and repair engine with verification
- [x] Landing page and interactive demo
- [x] Live scan of real pages via the backend
- [ ] **Browser extension** (Chromium first) so people can fix sites they don't own
- [ ] Live Tesseract.js OCR in the extension
- [ ] CLI mode for CI that fails a build when the score drops
- [ ] Iframe and shadow-DOM scanning, plus batch patch validation

## Known limitations

Iframes and shadow DOM are skipped. Fixes for positive-`tabindex` and keyboard traps are minimal. Patches validate one at a time. The demo database uses `create_all` and should move to Alembic migrations.

## Development

```bash
pip install -r requirements.txt
pytest tests/
```

## Contributing

Issues and pull requests are welcome. Please run `pytest tests/` before opening a PR, and keep every new fixer inside the patch whitelist.

## License

Add a `LICENSE` file before publishing (MIT or Apache-2.0 are common for open-source projects).