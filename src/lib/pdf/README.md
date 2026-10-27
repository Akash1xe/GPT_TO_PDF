# Chunk 8 — browser-local print renderer

Adapted from the owner's extension at `Akash1xe/newGptTopdf`. The semantic DOM renderer remains Chrome-extension independent.

- `conversation-renderer.ts` and `block-renderer.ts` — conversation semantics, user/assistant turns, layouts, lists and controls.
- `inline-renderer.ts`, `code-renderer.ts`, `table-renderer.ts`, `math-renderer.ts`, `image-renderer.ts` — safe document DOM construction.
- `appearance.ts` and `print-styles.ts` — same typography, spacing, margins, light/dark themes, syntax-token styles and pagination rules as the extension.
- `print-job.ts` — unknown data validation, preference normalization, filtering, zero-storage, same-origin postMessage handoff to dedicated `/print` route.
- `src/components/pdf-export-controls.tsx` — user-facing settings and print action.
- `src/app/print` — browser native Print / Save as PDF with asset/font readiness wait.

**Input:** user-supplied normalized `ConversationData` (currently via local HTML extraction, not remote shared URLs).
**Output:** a printable, selectable-text browser page that can be saved as PDF using the browser's print dialog.
**Storage:** no server-side or persistent chat storage; the new window receives data through a short-lived one-time origin-checked channel.

See `docs/PDF_RENDERER.md`.
