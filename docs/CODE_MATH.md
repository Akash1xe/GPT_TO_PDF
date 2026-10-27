# Chunk 5 — Code and mathematical expressions

The standalone website adapts the original extension's extraction and fallback logic to **user-provided static HTML only**, parsed inertly by parse5.

## Code
- Detect pre/code blocks and preserve language identifiers and display names (e.g., C++ -> cpp).
- Flatten highlight.js and Prism syntax spans into semantic token types, including nested spans; ignore copy buttons and controls.
- Reconstruct exact source, indentation, empty lines, line numbers and line-length diagnostics.
- Preserve literal trailing source newlines, trimming only structural newlines synthesized by line wrappers.
- Reuse the original extension's fallback code highlighter for unhighlighted code (JS/TS, C/C++, Python, SQL and others).
- Renderers must style only known token categories, never blindly apply imported CSS classes.

## Mathematics
- Detect one formula per KaTeX root, avoiding duplicate counts for the visual and MathML branches.
- Prefer TeX found in data-latex/data-tex/data-math-source/data-formula or annotation encodings application/x-tex, application/x-latex and text/latex.
- Preserve block vs inline math and serialize whitelisted MathML with its namespace, including fractions, radicals, scripts, integrals and matrices.
- Whitelisted MathML strips arbitrary tags, annotation HTML, JavaScript event handlers, external URLs and untrusted CSS.
- Prepare math for the PDF renderer via bundled KaTeX with trust disabled, fallback to re-sanitized MathML, then readable text if unsupported.

## Security
No user-supplied HTML/JS is executed or mounted. TeX and code remain plain strings until handled by local trusted renderers; MathML markup is rebuilt from allowlisted elements and attributes. Future UI/PDF components must not pass arbitrary HTML to innerHTML.

## Limitations
Not a shared-link scraper. It cannot reconstruct unsupplied, virtualized conversation turns, full interactive charts or computed styles. Image/SVG/canvas export follows in Chunk 6, visual layout in Chunk 7, actual PDF output in Chunk 8.

Run `npm run check` for regression tests, TypeScript checking, ESLint and the production build.
