# Chunk 7: Static Rich Visual Formatting

This website adapts the original browser extension's `layoutInfo`, `visualControl`, `controlText` and inline source color concepts. Unlike the live extension, the website sees only HTML the user provides; it **cannot** calculate CSS layout, fetch stylesheets or access live control state.

## Included

- Explicit grid and flex layouts, supporting 2–4 columns from safe `grid-template-columns` fractions, basic `repeat(n, 1fr)`, unprefixed `grid-cols-2/3/4` classes and row flex containers.
- Nested extension-compatible `layout` blocks for cards and columns; supports `card`, `sourceBackground`, `sourceBorder`, `sourceAlign`, and conservative `columnWidths` for simple fr or pixel widths.
- Inline text color and closest available ancestor background into `TextNode.sourceColor` and `sourceSurface`. Rich text marks, links, code, images and math remain intact inside layouts.
- Static, unclickable `control` blocks for checkbox, radio, switch, slider, progress, CSS-only explicit progress tracks and a small allowlist of action-like labels.
- Input fields containing passwords, hidden values or ordinary private free-text are not parsed into control state.

## Design and security

- All styling comes from bounded, specific CSS declarations or explicit known class markers. Unsupported CSS functions, `url(...)`, arbitrary class colors, unknown responsive breakpoints, CSS gradients and calculated layout are not serialized.
- Supported color values are checked with the same `safeCssColor` validation as the shared conversation model. Generated `layout` and `control` data is revalidated before being offered to the renderer.
- This milestone does not inject source styles into a document. Later print rendering must apply only verified model fields.
- A card's `sourceBorder` and `sourceBackground` preserve safe **colors**, not border styles, shadows, computed spacing, complex filters or visual effects.
- For nested interactive content, only static semantics are retained. Buttons do nothing; no input is changed.
- The present HTML extractor continues to warn that conversation completeness cannot be verified from a static snapshot.

## Remaining

The browser extension may be able to capture additional computed colors, dimensions, canvas pixels and layout even when HTML alone cannot. Responsive CSS, complex layout computations, cross-document references and PDF page fidelity are therefore outside this chunk.

Chunk 8 integrates semantic blocks with the original extension's PDF renderer, print styles, layout and pagination, with tests for pages and fallbacks.
