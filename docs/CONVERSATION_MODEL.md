# Conversation model contract — Chunk 3

This model intentionally preserves the JSON-serializable extension shapes in:

- `src/lib/conversation/content.ts` — identical semantic block and inline union shapes.
- `src/lib/conversation/conversation.ts` — message and extraction metadata.
- `src/lib/conversation/preferences.ts` — export settings and defaults.

No Chrome extension APIs, browser DOM, network requests or backend database dependencies are present in the model.

## Representation

```text
ConversationData
  provider: chatgpt
  title, url, capturedUrl, capturedAt, conversationId?
  completeness: complete | possibly-partial | known-partial
  messageCount, stats
  messages[]: { id, role, order, plainText, blocks[] }
    blocks: paragraph, heading, ordered-list, unordered-list,
      blockquote, table, horizontal-rule, code, math, image,
      layout, control
    inline: text (weight/color), link, inline-code, line-break, math
```

The data model supports math source/MathML, syntax-tokenized code lines, merged table cells, image/svg/canvas source metadata, colors, grid/card layouts, and static versions of controls. These are model capabilities, **not** proof that shared links supply every element or that the website can render them yet.

## Runtime entry points

```ts
import {
  parseConversationData,
  createConversationDocument,
  parseConversationDocument,
  normalizeExportPreferences,
  filterConversationForExport,
} from "@/lib/conversation";

const checked = parseConversationData(importedUnknown);
if (!checked.ok) {
  console.error(checked.issues); // structured {path, message}
} else {
  console.log(checked.data.stats, checked.warnings);
  const envelope = createConversationDocument(checked.data);
  // Store or exchange only if explicitly requested and appropriate.
  const verifiedAgain = parseConversationDocument(envelope);
}
```

Input validation enforces message/block count, nesting depth, length and total-character limits. It rejects unknown variants, duplicate IDs, unsafe link and media schemes, and CSS injection strings. Message order, stats and completeness flags are reconciled with supplied data. Imported text may include code but is **never evaluated**.

## Versioning

An optional envelope has `schemaVersion: 1`. Bare `ConversationData` payloads from the extension are accepted for compatibility. A future schema change should introduce a new version with explicit migration rather than silently breaking existing imports.

## Security & fidelity boundaries

1. `parseConversationData` returns a **structurally verified** typed object, not trusted HTML. Never use `innerHTML` with user-supplied text, HTML, MathML or SVG.
2. Accepted SVG data URLs remain untrusted and are marked with a warning. The future renderer must sanitize SVG/XML attributes/nodes before use; math also needs KaTeX or safe MathML handling.
3. Remote images may fail to load or be blocked by their origin; blob URLs often cannot survive export/import across browser sessions.
4. User-controlled colors and column widths use a constrained CSS-value allowlist.
5. No completeness guarantees are inferred from model shape. The original extractor's evidence must be considered before calling a history complete.
6. Export preferences use a known-safe preset allowlist and numeric clamping; all optional values are normalized.

## Testing

`npm run test` includes a rich-message fixture plus regression tests for math/code/media/table/layout/control preservation, recursive stats, versioned JSON roundtrips, malformed/unsafe input, overly deep nesting, preference clamping, and message filtering. GitHub Actions also runs `npm run typecheck`, `npm run lint`, and `npm run build`.

## Next chunk

Chunk 4: adapt extracted HTML into this normalized model. Keep URL retrieval disabled until a compliant, dependable source path is available.
