# ChatGPT HTML import adapters

## Chunk 4 — semantic extraction

- `html-tree.ts` — inert `parse5` tree helpers, bounded input and node count. No browser document, script execution or image loading.
- `semantic-html-parser.ts` — adapted from the extension's block, inline and table parsing concepts: paragraphs, headings, emphasis, safe links, lists, blockquotes, merged table cells, simple code and TeX attribute markers.
- `chatgpt-html-extractor.ts` — discovers user/assistant roles in legacy and 2026 grouped markup, preserves document order, identifies repeated turns by stable ID where available, normalizes into the validated conversation model, always marks incomplete HTML snapshots as possibly partial.
- `shared-page-probe.ts` — existing lightweight feasibility signals and plain-text probe, retained for diagnostics.

Use `extractChatGPTConversationFromHtml(html, { sourceUrl?, capturedAt? })` with **HTML the user has voluntarily provided**. Never fetch chatgpt.com, request cookies, or claim full-chat completeness from a static HTML snapshot.

The parser does **not** decode Next.js React server component payloads, restore virtualized turns, read live browser canvas/computed styles, or extract images/diagrams. Chunk 5 implements highlighted code and complex math extraction; media and visual styles for Chunks 6–7. PDF export comes in Chunk 8. This foundation is deliberately not a web scraper.

See `docs/HTML_EXTRACTION.md`.

## Chunk 5 code and math

- `chatgpt-code.ts`: highlighted code tokens and language detection.
- `fallback-code-highlighter.ts`: source-compatible port of extension's fallback tokenizer.
- `chatgpt-math.ts`: TeX/KaTeX/MathML extraction and MathML allowlist serializer.
- `math-preview.ts`: local KaTeX (trust disabled) -> re-sanitized MathML -> readable text fallback.

See `docs/CODE_MATH.md` and `tests/code-math.test.mjs`.

## Chunk 6 — Images and diagrams

- `chatgpt-media.ts`: source classification, safe URLs, image dimensions, `<picture>` source selection, `<figure>` captions, SVG allowlist serialization and canvas snapshot handling.
- SVGs are rebuilt as data URLs using safe shape/text/paint fields only; computed stylesheet colors and CSS-only shape details cannot be recreated from static HTML.
- Canvas elements without explicit PNG data have `ImageBlock` placeholders and completeness warnings. Remote image references remain unverified and must have error placeholders in Chunk 8 PDF rendering.
- Media in paragraph flow becomes separate image blocks; table cells cannot hold block media in the extension-compatible schema and keep a descriptive text placeholder.

See `docs/MEDIA_EXTRACTION.md` and `tests/media-extraction.test.mjs`.

## Chunk 7 — Rich visuals

- `visual-style.ts`: explicit CSS properties, safe card/border/background/text colors, grid/flex columns and conservative column ratios; no computed CSS.
- `visual-control.ts`: safe static checkbox/radio/switch/progress/slider/action snapshots, without secret form inputs or actual actions.
- `semantic-html-parser.ts`: structure-preserving nested layout/control blocks, source-color and source-surface text nodes.

See `docs/VISUAL_FORMATTING.md` and `tests/visual-formatting.test.mjs`.
