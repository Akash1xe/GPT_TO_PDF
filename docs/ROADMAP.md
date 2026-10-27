# Incremental implementation roadmap

The owner advances the project **one chunk at a time** by saying "next." Work only in this repository. The original [newGptTopdf](https://github.com/Akash1xe/newGptTopdf) remains read-only.

1. **Foundation** — Next.js 16 + TypeScript + Tailwind 4, website shell, docs, CI, health endpoint. Completed.
2. **Shared-link feasibility** — completed initial evidence review and public-share validation; local static-markup/hydration probe; unattended server-side fetching remains unproven and disabled (see feasibility report).
3. **Conversation model** — complete: port extension-compatible content/conversation/settings shapes, add bounded runtime validation, statistics, preferences, filtering and automated tests.
4. **ChatGPT extraction** — implemented inert user-provided HTML parsing with semantic role/identity discovery, ordered messages, text, headings, lists, blockquotes, links, tables and basic code. Completeness is always marked partial.
5. **Code and math** — implemented: syntax tokens, fallback highlighting, languages, source whitespace, LaTeX annotation recovery, MathML whitelist, KaTeX rendering preparation and fallback text.
6. **Images and diagrams** — implemented static HTML image sources, captions, dimensions, whitelisted SVG serialization, canvas snapshot or placeholder, dangerous URI rejection and regression tests. Remote image download and browser canvas pixel capture remain unavailable.
7. **Rich visuals** — implemented safe static HTML card/grid/flex layouts, available borders/background and inline text colors, column ratios and static control snapshots; computed CSS and true PDF rendering remain future limitations.
8. **PDF rendering** — implemented the extension's semantic document renderer, KaTeX/MathML, images/SVG, highlighted code, tables, layouts, appearance preferences and print CSS. Browser-local print tab with same-origin one-time handoff; no server content storage. Printable DOM/CSS regression tests added. Automated PDF pixel parity still a later hardening task.
9. **PDF quality assurance** — browser-driven Chromium Playwright regression tests for real A4/Letter PDF generation, selectable-text extraction, page count, long conversation pagination, fonts, code, KaTeX, table headers, SVG/raster images, color themes and missing-media fallbacks. CI preserves PDF/screenshot artifacts.
10. **Other input methods** — implemented local ChatGPT `conversations*.json` and ZIP export selection, active-path-only branch parsing, GFM Markdown with code/tables/links, TXT and role-separated paste, static HTML uploads; bounded parsing, missing-asset fallbacks, validation and regression tests.
11. **Reliability and security** — implemented ZIP size/ratio and entry-count guards, owned-key active branch handling, Markdown fence-aware role parsing, cumulative export text budgets, defensive page headers, realistic HTML/JSON fixtures and 1,200-message test, mobile-width Chrome import/print checks and direct-print isolation. Firefox/Safari print parity remains unverified; see security notes.
12. **Production readiness** — release-candidate audit, external-image opt-in privacy safeguard, import size limits, privacy page, verified Vercel framework configuration, release checklist and acceptance tests. GitHub Actions validation required; actual Vercel deployment and public release require explicit owner approval.

## Definition of done for a chunk

- Changes are confined to `Akash1xe/Website_chatGpt_to_PDF`.
- Its promised functions are implemented or explicitly marked blocked.
- Available tests and quality checks are run, with failures disclosed.
- Changes are committed to the new repository.
- Next chunk is not started until requested.

## Fidelity standard

Preserve selectable text, code, links, lists, tables, mathematical structure, images, readable diagrams, style accents and honest completeness warnings **when the supplied input actually contains sufficient information**. A website cannot read the currently authenticated DOM of an unrelated ChatGPT tab.
