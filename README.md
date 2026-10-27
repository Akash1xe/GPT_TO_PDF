# ChatGPT to PDF — Web

## Current shared-link conversion fix (October 27, 2026)

**System-design lesson fidelity:** conditional quiz state, mapped checkboxes, progress bars, native/Markdown LaTeX, image attribution links, grid cards and client-defined Mermaid widgets are preserved. A new image-inclusive preview action makes online illustrations explicit; printing waits for assets, and trailing spacing no longer creates a blank final page. The supplied lesson was regenerated and visually checked as an eight-page PDF. See [system-design comparison notes](docs/SYSTEM_DESIGN_PDF_FIX.md).

**PDF fidelity update:** shared conversations now reconstruct supported static ChatGPT cards, links, controls, lists and image metadata instead of printing UI source code. Numbered-list/bullet printing and the PDF filename are repaired. The comparison conversation now contains 34 visible messages; generated images available only through internal file references are labeled explicitly. See [PDF comparison and remaining image limitation](docs/PDF_COMPARISON_FIX.md).

**Mermaid diagrams:** fenced `mermaid` blocks now render as vector diagrams in the print preview and PDF, in the selected light/dark theme. Printing waits for diagram preparation. Invalid or oversized diagrams retain their original source with a warning. Rendering is browser-local; imported configuration, HTML labels, callbacks and external diagram assets are disabled. Normal programming code remains a code block.

**Public shared-link import is now implemented.** The older chunk notes below document earlier milestones; their statements that retrieval is disabled predate this fix.

Run `npm ci` and `npm run dev`, then open http://localhost:3000. Paste a public `https://chatgpt.com/share/<uuid>` link and click **Convert shared link to PDF**. Review the imported messages, choose settings, and click **Open print preview / Save as PDF**. Select **Save as PDF** in the browser dialog.

The server retrieves the public page, decodes modern React Router conversation data (with legacy JSON/static HTML fallbacks), selects its active branch, and connects it to the existing PDF renderer. Hidden messages, tool calls and reasoning metadata are excluded. Public link content is processed transiently in server memory without application persistence; local file imports remain browser-local. No ChatGPT cookies or credentials are required.

ChatGPT may block hosting-provider access; restricted/deleted shares and unsupported pages show an error with browser capture/file import alternatives. Retrieval has a 15-second timeout and a 2 MB byte limit and follows no redirects. Test access from the actual deployment host before launch. Printing still uses the browser dialog, rather than a direct binary PDF download.

The supplied share was tested live: **Project Name Suggestions**, 36 visible messages, 6 code blocks. See [diagnosis, API behavior and verification](docs/SHARED_LINK_FIX.md). `POST /api/shared-link/inspect` now accepts `retrieve:true`; requests without it still validate only. Check `conversionReady` to determine whether retrieval succeeded (`ok` describes URL validation).

Run `npm run check` for unit tests, TypeScript, lint and build. For browser/PDF checks, run `npx playwright install chromium` once, then `npm run test:browser`. A lockfile is now included for reproducible `npm ci` installs. No deployment is performed by this local fix.

---

## Previous milestone notes

A standalone Next.js website for converting supported ChatGPT conversations into carefully formatted, selectable-text PDFs.

> **Current status: Chunk 12 — release candidate with browser-local import and PDF print workflows.** The website validates shared ChatGPT URLs, and now includes an **opt-in browser-side capture bookmarklet** that copies the visible shared-page conversation into the local HTML importer. Direct automatic URL retrieval remains unavailable. Supported ZIP/JSON/HTML/Markdown/text imports and printable PDFs are implemented. See [browser-side capture instructions](docs/BROWSER_SHARED_CAPTURE.md).

## Relationship to the browser extension

This is a separate repository from [newGptTopdf](https://github.com/Akash1xe/newGptTopdf). The original extension remains read-only and is the reference implementation for structured extraction, rich content, print styling, and mathematical rendering. We will adapt compatible components here rather than making this a browser extension.

## Technology

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4 and CSS design tokens
- Next.js Route Handlers for website backend operations
- Node test runner + tsx for URL/API/static HTML feasibility checks; later richer PDF/browser regression coverage
- Vercel-ready; no database or login required for the foundation

## Getting started

Prerequisites: Node.js 22.12+ and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

```bash
npm run test             # Foundation + shared-link + static HTML parser tests (requires npm install)
npm run typecheck        # TypeScript checking (requires npm install)
npm run lint             # ESLint (requires npm install)
npm run build            # Production build (requires npm install)
npm run check            # Full quality gate
```

**Dependency note:** A lockfile should be generated with `npm install` and committed for repeatable builds; CI currently runs `npm install` on each push.

## Conversation model (Chunk 3)

The website now has the extension-compatible, DOM-independent semantic types in `src/lib/conversation/`:

- `content.ts`: paragraphs, lists, nested layouts, links, code with tokens, tables, inline/block math, media (including SVG/canvas metadata), and static controls.
- `conversation.ts`: ordered messages, completeness diagnostics, and conversation statistics.
- `preferences.ts`: all PDF export settings and the extension's defaults.
- `validation.ts`: bounded, runtime validation and canonicalization of user/importer supplied JSON. Counts are rebuilt and unsafe URL/style fields are rejected.
- `export-settings.ts`: safe preference defaults/clamps and portable assistant/user message filters.

Use `parseConversationData(input)` and check `result.ok` before passing imported content to a future renderer. A versioned envelope, `{ schemaVersion: 1, conversation }`, is also supported. HTML/media strings remain untrusted after validation and **must still be sanitized before rendering**. Chunk 4 now implements `extractChatGPTConversationFromHtml(html, options)` for user-supplied static HTML. It creates validated `ConversationData` preserving message roles/order, headings, lists, links, tables, quotes, plain code and available LaTeX source markers, with partial-history warnings. The advanced link lab shows the extracted messages. Automatic remote link retrieval remains disabled, and PDF conversion is not implemented. [Model contract](docs/CONVERSATION_MODEL.md).

## Local HTML extraction (Chunk 4)

The advanced inspector can convert already-available ChatGPT HTML into a **structured conversation model** locally in the browser. It does not make HTTP requests to chatgpt.com, run embedded scripts, or load a user's private chat. See [Extraction design and limitations](docs/HTML_EXTRACTION.md). Highlighted code and math extraction now support tokens, TeX, MathML and local KaTeX rendering preparation. Images and diagrams follow in later chunks.

## Code and math (Chunk 5)

The website now adapts the extension's code extractor, code fallback highlighter, and KaTeX/MathML extraction. It preserves semantic code tokens, lines, indentation and languages. Math nodes retain TeX when available or whitelisted MathML and text fallbacks; the local `prepareMathPreview()` helper uses KaTeX with `trust:false`. Chunk 8 adds a printable, selectable-text PDF preview through the browser's Save as PDF dialog; it is not a direct binary PDF download. See [Chunk 5 technical notes](docs/CODE_MATH.md).

## Images and diagrams (Chunk 6)

Static, user-supplied HTML is now parsed for image elements, `<picture>` sources, and SVG diagrams. The model retains image dimensions, accessible labels, figure captions, and safe source URLs. SVG content is rebuilt from a strict element/attribute/style allowlist and encoded into a data URI; it never reuses arbitrary embedded SVG markup. Canvas pixels are only available if the user-provided HTML includes an explicit PNG snapshot; otherwise a labeled placeholder and warning are kept. The website does **not** download or fetch remote media. See [media extraction notes](docs/MEDIA_EXTRACTION.md).

## Cards, layouts, colors and controls (Chunk 7)

The static HTML parser now reconstructs selected visual properties available from user-supplied markup: explicit grid/flex columns, safe fr-based width ratios, card borders and background colors, centered/right-aligned text, inline text colors and source surfaces. Checked radio/checkbox states, switches, sliders, progress bars and specific action-looking elements become **non-interactive** semantic `control` blocks; secret fields and ordinary inputs are excluded. Computed CSS and responsive screen styles cannot be recovered from a detached HTML snapshot. See [Visual formatting notes](docs/VISUAL_FORMATTING.md).

## Print and Save as PDF (Chunk 8)

Paste ChatGPT HTML you are permitted to access, click **Extract HTML locally**, adjust PDF preferences (A4/Letter, fonts, code wrapping, light/dark, filters, margins), and select **Open print preview / Save as PDF**. A new same-origin print tab receives only a transient message from the opener, validates it again, renders the rich conversation and prints with the native browser dialog. Select *Save as PDF* as the printer destination. No content is uploaded or stored in our service. Popup blockers may require enabling popups for this site.

The renderer includes accessible text, links, tables, line-tokenized code, generated KaTeX/safe MathML, supported images and sanitized SVG, card/column layouts, and static controls. Remote images may be unavailable and placeholders appear; unsupplied canvas pixels remain unavailable. Printer behavior and PDF appearance can vary by browser. See [Chunk 8 implementation notes](docs/PDF_RENDERER.md).

**Limitations:** Shared-link validation **does not** import ChatGPT content; a raw saved HTML snapshot is needed until compliant import sources are implemented. The website cannot access private ChatGPT tabs directly. Browser print preview is not a hosted PDF rendering API.

## PDF quality assurance (Chunk 9)

The project now includes automated Playwright Chromium integration tests that open the actual `/print` route through its same-origin browser message handshake. The tests produce **real A4/Letter PDFs**, parse them using PDF.js to check paper dimensions, page count and selectable text, and validate math, code highlighting, table headers, SVG/raster media, dark themes and 120-turn pagination. GitHub Actions archives screenshots, generated PDFs, traces on failures and the Playwright report for visual inspection (7-day retention).

Run `npm run check`, then `npx playwright install chromium` (first time only) and `npm run test:browser` to run the browser suite locally. These tests run in CI after the normal unit/typecheck/lint/build gate; they are not included in the faster `npm run check` command. More details in [browser/PDF regression notes](docs/PDF_QUALITY.md).

## Additional input methods (Chunk 10)

On the home page, the **Import a conversation** panel accepts ChatGPT ZIP exports, `conversations.json` and numbered conversation JSON files, user-provided role-marked `.html` snapshots, `.md` Markdown and `.txt` text files, plus pasted Markdown/text/HTML. All file parsing happens locally in the browser. ZIP extraction is restricted to recognized conversation JSON filenames; account records and unrelated files are ignored. The JSON importer lists included conversations so you choose one, follows the active `current_node` parent chain, and never mixes alternate regenerated branches. Importers produce validated `ConversationData` and connect directly to the existing printable PDF settings. See [import guide](docs/INPUT_IMPORT.md).

Non-text attachments in JSON typically contain pointers rather than usable image bytes; they are represented as labeled missing-asset notes. Export history and file imports are **not claimed to be complete**. The website still cannot read a private ChatGPT browser tab or fetch a shared link automatically.

## Reliability and security (Chunk 11)

Local ZIP/JSON/HTML imports now apply additional archive, object-key and cumulative size checks before rendering. The importer follows only explicitly owned active branch nodes; a forged `__proto__` or inherited key cannot masquerade as a conversation node. ZIP files are checked for expected signatures, per-entry sizes, suspicious expansion ratios, total unpacked bytes and member counts. Markdown code fences no longer cause spurious message splitting when they contain `User:` or `Assistant:`. No user-supplied script is mounted or executed.

Next.js now sends anti-embedding, no-sniff, no-referrer and limited Content Security Policy headers. Print pages are marked no-store and still work with same-origin ephemeral window messaging. Regression fixtures exercise a rich HTML snapshot and edited JSON branch; a 1,200-message test monitors large import behavior. Chrome browser tests check desktop/mobile-width flows, missing print data, unsafe HTML and response headers. See [security and reliability notes](docs/SECURITY_RELIABILITY.md).

These guards reduce attack surface but do not provide an independent security audit or Firefox/Safari PDF parity. The existing browser tests use Google Chrome; other print engines still require manual verification.

## Release candidate and Vercel readiness (Chunk 12)

The website's core import-to-print workflow is implemented and tested, including **remote-image loading disabled by default** (optional opt-in with a third-party privacy warning). HTML/Markdown/TXT imports are capped at 2 MB before reading, ZIP/JSON files at 35 MB. The website provides a [privacy page](/privacy) describing the boundaries.

`vercel.json` configures the Next.js framework preset; `next build`, the App Router/API routes and Node 22 are covered by CI. Follow the [Vercel release checklist](docs/VERCEL_RELEASE.md) for GitHub import and controlled preview verification.

**No Vercel deployment or public launch is performed by this commit.** Search indexing remains disabled, but `noindex` is not access control. Approval to publish must be given separately. See [release notes](docs/RELEASE_NOTES.md) for remaining gaps (lockfile, Firefox/Safari print parity and missing ChatGPT resources).

## Routes

- `/` — honest project landing page
- `/api/health` — static health response with no conversation data
- `/api/shared-link/inspect` — GET capabilities and POST strict URL validation **without remote retrieval**
- `/#inspector` — share-link validator, browser-side capture bookmarklet, clipboard import, and local HTML inspector

## Planned modules

- `src/lib/conversation/` — normalized structured conversation data, based on the extension's provider-neutral model
- `src/lib/extractors/` — shared-link/file/pasted-content import adapters
- `src/lib/pdf/` — portable semantic renderer, print stylesheet and PDF settings
- `src/lib/security/` — input validation and sanitization
- `src/components/` — UI components

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/ROADMAP.md](docs/ROADMAP.md) for implementation boundaries and milestones.

## Chunk 2 feasibility result

Shared conversation links use `https://chatgpt.com/share/<uuid>`. This is a link format, **not a guaranteed server API**. A bare browser/app server cannot read `/c/` private chats; personal public shares can be accessible to recipients while managed-workspace shares may require authorization. Modern ChatGPT pages may ship data in React hydration streams rather than static readable HTML. The website currently has no server-side ChatGPT fetching and should not be described as a working PDF converter.

Paste a public shared URL in the website inspector to validate its format. Advanced users can paste **HTML source they already have** to run an inert, browser-local test: role-marked static messages are identified, and hydration-only/blocked shells are classified without pretending to have extracted the complete conversation. See [Feasibility report](docs/SHARED_LINK_FEASIBILITY.md).

## Privacy and safety direction

The website should keep PDF rendering in the user's browser where possible, not store imported conversations by default, and never ask for ChatGPT session cookies or passwords. Any shared-link backend retrieval will be evaluated for technical reliability and hosting-policy compliance before implementation. A shared URL is not the same as a private `/c/` conversation URL.

## Deployment

Import this GitHub repository into Vercel and choose the Next.js framework preset. No environment variables are required in Chunk 2. **Server-side ChatGPT page retrieval is deliberately not implemented on Vercel** because of provider accessibility and hosting-policy questions. Production deployment and conversion will be tackled in their planned chunks.

## Disclaimer

Independent project. Not affiliated with or endorsed by OpenAI. No license has been granted for this repository at this time.
