# Chunk 11 — Reliability and security

## Threats and controls

| Risk | Mitigation |
| --- | --- |
| Export ZIP bomb | Restrict recognized JSON filenames, check ZIP signature, maximum original/decompressed sizes, archive entry count and declared compression ratio |
| Forged branch metadata | Follow own mapping-node keys only; reject missing, cyclic, ambiguous or excessively deep active branches |
| Oversized nested import | 35 MB upload, 50 MB unpacked JSON, 1 MB rich message, 12 MB active-branch text, maximum of 10,000 mapped messages and bounded model validation |
| Markdown role confusion | User/Assistant headings inside fenced code are not treated as real conversation boundaries |
| Raw HTML scripting | Parse inert HTML via parse5; Markdown raw HTML is escaped; DOM output uses semantic text and sanitized media |
| PDF preview injection | Verify same origin and opener window for local print handoff; revalidate normalized conversation before rendering |
| Frame/clickjacking | X-Frame-Options DENY and CSP frame-ancestors none |
| Private referrer propagation | Referrer-Policy no-referrer; printable HTML route uses Cache-Control no-store |
| Media URL safety | Deny javascript/data arbitrary URLs, sanitize SVG; remote images are suppressed in print by default; users may explicitly enable them and trigger browser connections to third-party hosts |

## Regression fixtures

- `tests/fixtures/realistic-conversation.html`: role-marked multi-turn sample with rich text, code, math, table, SVG diagram, card and hostile script/URL.
- `tests/fixtures/export-branches.json`: edited/regenerated assistant reply branch and inaccessible image-asset pointer.
- `tests/reliability-security.test.mjs`: ZIP filter/size/expansion tests, prototype-key traversal, message role/code fence parsing and 1,200-message import.
- `tests/browser/security.spec.mjs`: browser response headers, disabled direct print visit, script isolation in uploaded HTML, and mobile-width print preview.
- Previous `tests/browser/print.spec.mjs`: A4 and Letter PDF output, 120-message pagination and rich content under real Chrome.

## Known limitations

The emitted CSP intentionally sets safe framing/object/base restrictions but **does not set a strict script-src policy** because Next.js currently requires inline bootstrapping. This is defense in depth, not a comprehensive XSS boundary. The static HTML importer still cannot restore remote images, computed CSS or canvas data not present in input. A privacy-sensitive user should note that Remote images now become labeled placeholders unless the user enables the external-image setting; an explicit opt-in may contact third-party sites.

ZIP metadata is checked before eligible files are decompressed, but decompression/parsing still consumes memory on the user's device. Aggressive resource ceilings reduce exposure but do not eliminate all memory-exhaustion conditions. The performance regression uses a generous CI wall-clock limit and is not a capacity guarantee for all client devices.

The automated cross-viewport tests use headless Google Chrome (desktop and narrow viewport), **not** Firefox/WebKit. Chrome PDF evidence does not establish parity in Firefox/Safari printing; that remains a manual or future automated check.

## Running checks

```bash
npm run check
npm run test:browser
```

In GitHub Actions, the browser suite uses the GitHub-hosted runner's installed Chrome and uploads PDF/test evidence as temporary artifacts.

Only `Akash1xe/Website_chatGpt_to_PDF` is modified.
