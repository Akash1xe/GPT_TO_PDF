# Chunk 8 — PDF document rendering

## Flow

1. User supplies permitted static ChatGPT HTML in the advanced inspector, then runs local extraction.
2. The inspector shows parsed conversation blocks. The user sets page theme, A4/Letter, message filter, margins, fonts/code font size, code wrapping and metadata options.
3. A synchronous user-initiated click opens a same-origin `/print` tab. This avoids popup-blocker rejection without placing chat content into the URL.
4. The print tab signals readiness to its opener using `postMessage`. Origin and source-window are checked, and imported `ConversationData` is revalidated/normalized before rendering. No cookies, server APIs, DB or browser persistent storage are used.
5. The DOM renderer builds selectable text and semantic blocks. The user chooses **Print / Save as PDF**, then selects **Save as PDF** in their browser print dialog.
6. The renderer waits a bounded time for images and fonts; unavailable media show accessible placeholders.

## Port from extension

- The extension's print CSS, appearance resolver, code token styling, document and block renderers, table/list semantics and source-color handling are adapted with minimal semantic differences.
- Math uses locally bundled KaTeX, then **strictly whitelisted** MathML, then readable fallback text; user HTML is never trusted as renderable markup.
- SVG media is sanitized again at the print boundary; remote image URLs can fail if the origin blocks loading. Media fallback labels remain visible.
- Static control blocks are noninteractive snapshots in the PDF.
- `@page` selects A4 or Letter and margins; CSS break rules keep headings with following content, repeat table headers and avoid splitting short code/media blocks where feasible.

## Tests

`tests/pdf-renderer.test.mjs` exercises actual generated DOM structures with a lightweight DOM implementation, and asserts print CSS, themes, typography, filters, content escaping, code, math, tables, images, SVG and layout.

These are **DOM and print-style regression tests**, not a verified binary PDF rendered in Chromium. PDF printer engines differ by browser, fonts, assets, pagination, browser scaling and whether “background graphics” is enabled. A true screenshot/print-to-PDF pixel-diff E2E suite is recommended as a later hardening milestone.

## Known limits

- Static HTML cannot supply missing messages, computed CSS, remote assets blocked by origin, or live canvas pixels.
- Shared link inspection is **validation only** and cannot automatically retrieve a chat.
- Native browser Print / Save as PDF is currently the output; direct binary PDF generation and download are not implemented.
- The print tab must retain its opener until initial data arrives. If popups are disabled, allow popups for the website.
- Always treat source content as untrusted. The model validator strips unsupported fields and the DOM builders insert text with `textContent`, not raw `innerHTML` (except vetted KaTeX output and rebuilt MathML).

The original extension repo is never written.

## Chunk 9: real Chromium PDF test suite

`tests/browser/print.spec.mjs` now exercises the real print route in Chromium using Playwright. It generates printable PDFs and extracts their text/page geometry with PDF.js, rather than asserting HTML structure alone. Both A4 and Letter paper formats, 120-turn page flow, rich math/code/tables/SVG/raster, dark theme, long pagination and missing-image fallbacks are covered. On CI, PDFs, screenshots, traces and reports are retained for inspection under the `pdf-quality-regression` artifact. See `docs/PDF_QUALITY.md`.

## Release candidate privacy default

Remote HTTP(S) and browser-session `blob:` images are represented by visible labeled placeholders by default, avoiding third-party requests on print. PDF settings include an explicit opt-in **Load external images**; enabling this allows the user's browser to contact external hosts. Self-contained PNG/JPEG/WebP data and sanitized inline SVGs continue to render without external requests. A second normalization step in the print page enforces that policy. This improves privacy but means some images only appear when consent is granted.
