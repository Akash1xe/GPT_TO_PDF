# Chunk 6 — Images and SVG/canvas diagrams

This module adapts the original extension's media handling into the website's inert `parse5` pipeline. It processes user-provided HTML without fetching third-party pages, images, or credentials.

## Supported

- `<img>` source and (when needed) `srcset` or `<picture><source>` candidates, including safe HTTPS/HTTP and raster data URLs.
- Explicit width/height pixels and simple inline style pixel dimensions. Missing or percentage-based values are not guessed.
- Meaningful alternate text, accessible SVG labels, `<figure><figcaption>` captions, and retained image order among paragraphs/headings.
- SVG diagrams with shapes, lines, paths, text, safe fills/strokes/gradients, viewBox and declared dimensions. SVG elements are reconstructed using an allowlist and returned as an encoded `data:image/svg+xml;charset=utf-8` URL. SVG styles obtained only from computed CSS in the original extension cannot be recovered from saved HTML.
- Canvas dimensions/labels, plus a **PNG source only if** the HTML expressly includes `data-canvas-png="data:image/png;base64,..."` or `data-canvas-data-url` with PNG data. An ordinary saved `<canvas>` does not contain pixel data.

## Missing sources and limits

- Missing/unsafe image URLs yield a text-accessible `ImageBlock` placeholder rather than silently dropping the item.
- Remote images are **not downloaded or verified** at extraction time. The later renderer must show an error placeholder if a remote image cannot load and respect its displayed dimensions.
- `blob:` image URLs may work only in their original browser session.
- Small icons/avatars are omitted when their explicit dimensions suggest decoration.
- Media inside a table cell becomes a descriptive inline placeholder because the reused extension-compatible `TableCell.children` model does not contain image blocks.
- Embedded SVG is regenerated with permitted elements/attributes/styles; scripts, foreignObject, external URLs, event handlers, active animation, and external CSS are excluded. Complex CSS-only diagrams can lose colors or styles, and unavailable SVG content will become a placeholder.
- Sources are bounded by the input HTML and model limits; no source data is executed.

## Trust boundary

These are **model extraction** features, not proof of real PDF fidelity. Generated SVG is sanitized, but all media must still be treated as untrusted at rendering. Future PDF code must use image elements, not arbitrary user HTML. Renderer tests and full print output are Chunk 8 tasks.

## How to validate

Use `npm run test` for media fixtures and the existing parser regressions. Run `npm run check` for TypeScript, ESLint and the Next.js production build. GitHub Actions runs this quality gate on commits.

The original extension remains read-only; this website is independent.
