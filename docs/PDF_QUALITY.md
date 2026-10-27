# Chunk 9 — Browser PDF quality and pagination regressions

This suite complements the unit-tested semantic print renderer with a real **headless Chromium** browser.

## Coverage

- Opens the actual `/print` route from a same-origin opener using the project's readiness handshake and validated conversation payloads.
- Verifies real rendered DOM, CSS layout geometry, KaTeX HTML, syntax-highlighted code tokens, table column spans, cards, checkboxes and two supported image types (sanitized SVG + PNG).
- Uses Chromium `page.pdf({ printBackground: true, preferCSSPageSize: true })` to export actual PDF bytes, then **PDF.js** to read PDF page count, dimensions, and text content.
- Confirms A4 dimensions (~595×842 pt), Letter dimensions (612×792 pt) and continued selectable text in the PDF—not flattened screenshots.
- Generates a 120-turn conversation to check multi-page flow, table-header print CSS, heading break protection, no fully blank printed pages, and first/last marker ordering.
- Tests dark-themed printing, explicit missing-media fallbacks and horizontal overflow.
- Writes per-case PNG/PDF artifacts, Playwright traces on failure, and an HTML report. GitHub Actions uploads them even when browser assertions fail (7-day retention).

## Running

From the website repository on Node 22:

```bash
npm install
npm run check
npx playwright install --with-deps chromium
npm run test:browser
```

GitHub Actions uses the Google Chrome browser preinstalled on ubuntu-latest runners (without installing its own Playwright Chromium). Local developers can use the Playwright Chromium download shown above. Browser tests require a **built** Next.js application and are configured to launch `npm run start -- -p 3100` using Playwright's `webServer` fixture.

## Interpreting results

A passing test is evidence that Chromium generated actual readable, selectable-text PDFs for the included fixtures and sizes. It does not mean that every ChatGPT layout or diagram will reproduce perfectly; computed styles, canvas pixels, blocked remote images, page differences across browsers/printers and rare LaTeX/MathML combinations still require manual review and expanded fixtures.

Screenshots/PDF artifacts are retained for human review instead of fragile per-pixel golden snapshots, which vary across headless browsers and font installations. Geometry and semantic output checks enforce stable quality constraints.

## Print fixes

- Printable media maximum height is bounded by the selected page height minus top/bottom margins and caption allowance, avoiding oversized media creating an almost-empty extra page.
- Existing code/table/page-break safeguards remain in the renderer; browser tests now guard them from accidental regressions.

## Chunk 11 browser stability

Additional headless Chrome checks validate direct `/print` visits have no printable data, secure response headers, that scripts in imported HTML remain inert, and mobile-width (390px) print window layout. Existing A4/Letter tests still validate 120-turn pagination. Firefox and Safari print engines are *not* installed or tested by this Chrome-based CI suite; do not claim cross-browser PDF parity.
