# Release candidate — Chunk 12

The website has reached the planned final engineering milestone. The code is **release-ready for controlled testing** after passing GitHub Actions; it is **not** proof that a Vercel deployment exists or that a public launch has been approved.

## Available workflows

- Import ChatGPT ZIP/JSON data exports, role-marked HTML, Markdown or TXT or paste labeled conversation content.
- Parse semantic conversation order, headings, lists, code highlighting, KaTeX/MathML, available diagrams and sanitized images.
- Customize print preferences and use Chrome's native Save as PDF dialog.
- Test actual PDFs in automated Chromium across A4/Letter and long conversations.
- Protect imported content with size limits, structured sanitization, restricted ZIP loading, and defense-in-depth response headers.
- Default-deny third-party image requests, with explicit user consent to load remote assets when needed.

## Deliberate limits

- Shared ChatGPT URLs are **format-validated only**, not fetched. Private `/c/` conversations cannot be read from a separate website.
- File exports may omit image bytes, audio, computed styles or some branches. A PDF cannot reconstruct missing content.
- PDF output is via browser printing, not a hosted binary PDF API. Firefox, Safari, and pixel-perfect fidelity are not verified.
- `noindex` remains on; it does not make a public URL access-controlled.
- Review and commit an npm lockfile before broader production distribution for reproducible installations.

## Pending user action

Approve a private Vercel preview setup and perform a small real-device acceptance test. Public distribution should only happen after a separate explicit approval.
