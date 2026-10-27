# Normalized conversation model (Chunk 3 implemented)

This folder owns the **provider-independent semantic content model** used between any importer and the planned PDF renderer. It is adapted from the original `Akash1xe/newGptTopdf` extension and intentionally remains structurally compatible with it.

- `content.ts`: inline and block discriminated unions, including math, code tokens, table spans, image/SVG/canvas metadata, layout and control snapshots.
- `conversation.ts`: message roles/order/identity, extraction completeness, conversation metadata and statistics.
- `preferences.ts`: print/export types and original extension defaults.
- `stats.ts`: recursively rebuilds metrics from content, not untrusted counters.
- `urls.ts`: safe URL and CSS color checks; **not** an HTML/SVG sanitizer.
- `validation.ts`: typed, bounded validation for untrusted JSON-shaped import payloads. Use `parseConversationData(input)` before rendering.
- `export-settings.ts`: safe appearance settings and user/assistant filtering.
- `index.ts`: public exports for future chunks.

A versioned `{ schemaVersion: 1, conversation }` envelope is supported through `parseConversationDocument`. It is **not** required for extension compatibility.

**Trust boundary:** Validation does not mean media, MathML or markup can be inserted raw into HTML. Future renderers must still sanitize or safely reconstruct markup, and resolve remote media appropriately.

See `docs/CONVERSATION_MODEL.md`.
