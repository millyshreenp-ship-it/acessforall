# AccessForAll frontend

Static frontend for AccessForAll, an accessibility automation engine. No build step.

## Run

Open `index.html` in a browser, or serve the folder:

    npx serve .

- `index.html` is the landing page.
- `app/index.html` is the interactive demo (scan, auto-repair, and tools for visual, hearing and motor needs).

## Structure

    index.html, landing.css, landing.js   Landing page
    app/index.html, app.css, app.js       Demo app

## Notes

- Fonts load from Google Fonts. axe-core 4.10.0 loads from cdnjs for the cross-check line in the report. If either is blocked, the page still works with fallback fonts and the built-in rules.
- The 13 audit rules, auto-repair, screen reader view and tab order overlay run on the demo shop's real markup, in `app/app.js` (the `CHECKS` array).
- Alt text for the three demo images comes from recorded OCR results. The planned extension would use Tesseract.js.
- The caption player runs on a timeline with no audio.
- Display settings (colour mode, text size, line spacing, target size, reduced motion) are saved to localStorage.

## Not built yet

Browser extension packaging, live OCR, a Playwright command-line run for CI, and a React version of the popup.

## Porting to React

`CHECKS` in `app/app.js` is self-contained (detect and fix functions over a DOM root), so it can move into a shared module and be called from a React popup or a content script.
