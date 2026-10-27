# Website architecture

## Source and target

- **Read-only reference:** [Akash1xe/newGptTopdf](https://github.com/Akash1xe/newGptTopdf)
- **Development target:** [Akash1xe/Website_chatGpt_to_PDF](https://github.com/Akash1xe/Website_chatGpt_to_PDF)

No files or history are shared by Git submodule. The website is an independent project.

## Planned data flow

```text
User-provided permitted shared link / supported exported file / pasted content
    |
    +-- Next.js Route Handler (only when fetching a permitted remote resource)
    |      strict URL and response validation; never fetch arbitrary URLs
    |
    v
Input adapter (source format -> normalized typed ConversationData)
    |
    +-- extraction warnings / completeness / unsupported media
    v
Client-side review and preferences
    |
    v
Portable structured renderer (semantic DOM)
    +-- prose / links / lists / tables / code / math / images / SVG / static visuals
    +-- local KaTeX and scoped print styles
    v
Isolated browser print surface -> native Save as PDF
```

Browser-side rendering is preferred to reduce server load and privacy exposure. Shared-link extraction is **not yet proven**; it must be technically and policy-validated in Chunk 2 before using Vercel backend fetches.

## How the extension maps to the website

| Extension module | Website plan |
| --- | --- |
| `src/types/content.ts`, `conversation.ts` and `preferences.ts` | Normalize shared types in `src/lib/conversation/` |
| `src/parser/` | Reuse semantic parsing once input markup is available |
| `src/providers/chatgpt/chatgptMath.ts` | Recover TeX/MathML, adapt DOM only when present |
| `chatgptMedia.ts` | Adapt image/SVG/canvas handling with explicit accessibility and origin limitations |
| `chatgptCode.ts` | Code token and line preservation |
| `src/renderer/` | Reuse the portable document renderer |
| `pdfAppearanceService.ts` and `printStyles.ts` | Reuse appearance preferences and print CSS |
| `chatgptCollector.ts` | Reference for reliability only; cannot scroll another browser tab |
| `src/content/`, `src/print/` and Chrome extension APIs | Replace with website actions and a print-friendly web route |

## Directory boundaries

```text
src/
  app/                    Next.js routes + frontend pages
    api/health/           safe, public smoke test
  components/             UI only; presentation does not own extraction logic
  lib/
    conversation/         normalized model (future)
    extractors/           source-specific adapters (future)
    pdf/                  renderer and export settings (future)
    security/             strict URL and input validation (future)
    site-config.ts        non-secret site metadata
docs/                     architecture and milestone documentation
tests/                    foundation checks; richer tests later
```

## Chunk 8 implementation

- `src/lib/pdf/` ports the extension's DOM-based semantic renderer for conversation header, rich blocks, highlighted code, KaTeX/MathML, tables, media, safe text colors, layout, controls and appearance preferences.
- `print-styles.ts` and `appearance.ts` adapt the extension's full print CSS including @page A4/Letter margins, typography, break-inside/page-break behaviors, selectable text, light/dark theme and code colors.
- `math-renderer.ts` uses the already sanitized `prepareMathPreview` output; it never inserts raw ChatGPT HTML. `image-renderer.ts` sanitizes SVG data again on print even when the parsed schema validated it, and shows useful media fallbacks on missing/failed images.
- `src/app/print` is a same-origin client-only printable route. The HTML inspector opens it directly on user click, and shares validated content once via origin/source-checked postMessage. No content goes into URLs, persistent storage, cookies, database or API endpoints.
- `src/components/pdf-export-controls.tsx` provides PDF preferences on the existing extracted HTML preview. The browser native print dialog produces the PDF through the user's Save as PDF destination; this is **not** a server-generated binary file.
- Output-oriented regression tests inspect generated DOM and print CSS with an inert browser-like DOM. These checks do not prove Chromium/PDF pixel parity, which requires an additional browser integration test.
- Details in `docs/PDF_RENDERER.md`.

## Chunk 7 implementation

- `visual-style.ts` ports the intent of the extension's `layoutInfo` and inline source-color collection to inert HTML using only safe CSS values available in inline styles, plus explicit grid/flex classes.
- `visual-control.ts` ports static snapshots of radio/checkbox/switch/slider/progress states and a bounded allowlist of action labels; it does not read secret input values, click controls or mutate anything.
- `semantic-html-parser.ts` emits extension-compatible `layout` and `control` blocks and text `sourceColor/sourceSurface` while maintaining nested rich content. Cards and 2–4-column grid/flex groups preserve their relative flow.
- Strict CSS color and column width constraints align with the existing Chunk 3 validator. No arbitrary CSS/HTML is rendered, and unavailable computed styles are never guessed. See `docs/VISUAL_FORMATTING.md`.
- PDF visual rendering remains scheduled for Chunk 8; this chunk produces structured semantic models only.

## Chunk 6 implementation

- `chatgpt-media.ts` adapts the extension's image/SVG/canvas extraction for inert, user-provided HTML. It preserves `ImageBlock` shape with source type, dimensions, captions and accessible alt descriptions.
- SVG elements are rebuilt using a whitelist of safe shapes, paths, labels, gradients, coordinates and inline styling. No active scripts, foreignObject, event attributes, external CSS/links or remote images survive SVG serialization. Encoded SVG is represented as a self-contained data image for future PDF rendering.
- Canvas cannot be rasterized from inert HTML. Unless a supplied PNG snapshot exists in a documented `data-canvas-png` attribute, the model records a descriptive placeholder and a warning rather than fabricating pixels.
- `semantic-html-parser.ts` now splits prose around image/diagram blocks, preserves `<figure>` captions and reports inline-only table cell media via alt-text placeholders; no remote fetches or binary uploads occur.
- Media validation remains layered: model-level URL checks from Chunk 3 plus parser-level SVG rebuilding. Print output is deferred to Chunk 8. Details in `docs/MEDIA_EXTRACTION.md`.

## Chunk 5 implementation

- `chatgpt-code.ts` ports semantic highlighted code extraction and language detection into the inert HTML tree. Plain code gets the original extension's local fallback highlighter, preserving lines and source text.
- `chatgpt-math.ts` ports TeX attribute/annotation recovery, KaTeX duplicate prevention, block/inline math and strict namespace-qualified MathML serialization.
- `math-preview.ts` safely prepares locally rendered KaTeX HTML (`trust:false`), re-sanitized MathML, or plain text. No raw imported HTML is mounted or executed.
- The semantic block parser integrates these modules; media, computed CSS, remote retrieval and PDF export remain upcoming chunks. See `docs/CODE_MATH.md`.

## Chunk 4 implementation

- The browser-only advanced inspector parses **user-supplied HTML** through `parse5`, then converts role-marked ChatGPT messages into a validated `ConversationData` shape. The parser does not execute JS or fetch remote media.
- Separate tree, inline/block/table, and ChatGPT role/identity modules adapt the original extension's semantic parser architecture. Shared role markers use stable IDs where possible; contextual IDs retain identical repeated messages.
- Message roles, order, headings, emphasis, safe links, nested lists, quotes, tables (including row/column spans), div-wrapped prose, plain code and optional TeX source markers are represented as semantic blocks. No full MathML, images, SVG, canvas, computed CSS or virtualized history extraction is claimed yet.
- All imported HTML is treated as possibly partial; React hydration stream detection is reported without making unsupported completeness claims.
- This is a client-side extraction from already accessible HTML, **not** a server-side shared-link importer. See `docs/HTML_EXTRACTION.md`.

## Chunk 3 implementation

- `src/lib/conversation/{content,conversation,preferences}.ts` are copied/adapted from the original extension. All exported shapes remain structurally compatible with its provider-neutral, JSON-serializable model.
- `validation.ts` checks **unknown** imported data at runtime with size/depth ceilings, safe protocols, CSS color allowlisting and known semantic node types. It creates fresh normalized objects without passing arbitrary fields through; computed stats, message positions and completeness flags are reconciled.
- `export-settings.ts` provides safe, clamped print preferences and message filtering, without Chrome APIs.
- Accepted SVG data and MathML strings are **not** guaranteed safe to render. They must be passed through renderer-specific sanitization in later chunks before insertion in a browser DOM. No code or remote resource is executed in Chunk 3.
- Documentation: `docs/CONVERSATION_MODEL.md`.

## Chunk 2 implementation

- The website's `/#inspector` UI makes a POST to `/api/shared-link/inspect` for **URL format only**.
- URL validator strictly accepts HTTPS chatgpt.com share UUIDs and never fetches a page. Input bodies are limited to 4 KiB; no content persistence. Production rate limiting can be added before public launch.
- A user may paste a saved page HTML snapshot into the advanced inspector. The browser parses it with inert `parse5`, and displays a plain-text diagnostic preview, no outgoing network requests for embedded assets.
- The prototype reports static role-marked messages only and flags hydration-only and blocked/login shells. It does not claim complete extraction.
- The Vercel deployment remains a normal hybrid Next.js app; scraping is not implemented because Vercel prohibits scrapers. See `docs/SHARED_LINK_FEASIBILITY.md`.

## Chunk 1 scope

Included: responsive landing page, strict TypeScript, ESLint, Tailwind CSS, a harmless health endpoint, Node zero-dependency foundation tests, GitHub Actions CI and Vercel-ready Next.js project config.

Excluded: real shared-link fetching, conversation upload, extraction, PDF generation, persistence, user authentication and deployment. The website explicitly labels planned functionality so an incomplete prototype does not mislead users.

## Privacy guardrails

- No auth credentials or session-cookie collection.
- No backend storage of conversation history by default.
- Never assume a shared link includes all private-chat content, images or UI details.
- Preserve the original extension's semantic sanitization approach when porting.
- Browser-side printing where practical; degrade gracefully with explicit content warnings.

## Validation

`npm run test` uses built-in Node assertions and needs no dependencies. Once dependencies are installed, run `npm run check` to perform tests, strict TypeScript checking, linting and a production Next.js build. CI repeats the full sequence on push.
