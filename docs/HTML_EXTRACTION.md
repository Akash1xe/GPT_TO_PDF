# Chunk 4 — ChatGPT Semantic HTML Extraction

## Purpose

The original `Akash1xe/newGptTopdf` extension has access to live ChatGPT DOM, computed styles and virtualized scrolling. This website does not. The new extraction layer adapts its **semantic data model and parsing principles** to user-provided, static HTML using the inert `parse5` HTML tree instead of browser DOM methods.

## Implemented files

| File | Responsibility |
| --- | --- |
| `src/lib/extractors/html-tree.ts` | HTML parsing, safety bounds, semantic attrs, exclusions and text normalization |
| `src/lib/extractors/semantic-html-parser.ts` | Structured paragraphs, nested lists, blockquotes, links, headings, merged tables and preliminary plain code |
| `src/lib/extractors/chatgpt-html-extractor.ts` | Message discovery, role/order/ID tracking, grouped-turn handling, partial completeness and validated normalized output |
| `tests/chatgpt-html-extractor.test.mjs` | Rich markup and security regression suite |
| `src/components/shared-link-lab.tsx` | Local extraction preview, no upload |

## Supported HTML message markers

The parser checks:

- `data-message-author-role="user|assistant"`
- `data-conversation-role`, `data-role`, `data-message-author`, and `data-turn`
- `data-user-message-bubble`
- `data-message-id`, `data-message-uuid`, `data-turn-id`, `data-turn-key` and `data-testid^=conversation-turn` as identity/ordering clues.

It handles the newer grouped-turn pattern where the assistant role marker is a short label, while the actual response is in later sibling containers. It ignores scripts, hidden elements, nav bars, controls and assistant reaction buttons.

## Data contract

`extractChatGPTConversationFromHtml(html, options)` returns:

```ts
{
  conversation: ConversationData | null;
  warnings: string[];
  diagnostics: {
    roleMarkers: number;
    parsedMessages: number;
    pageHasHydrationStream: boolean;
    pageHasImageOrDiagramNodes: boolean;
    skippedDuplicateIds: number;
  }
}
```

The `conversation`, when present, is accepted by the Chunk 3 `parseConversationData` validation function and marked `possiblyPartial: true`. **No static HTML capture is asserted to include a complete conversation.**

## Example

```ts
import { extractChatGPTConversationFromHtml } from "@/lib/extractors/chatgpt-html-extractor";

const result = extractChatGPTConversationFromHtml(htmlFromUser, {
  sourceUrl: "https://chatgpt.com/share/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
});
if (result.conversation) {
  console.log(result.conversation.messages.map((m) => ({
    role: m.role, blocks: m.blocks, text: m.plainText,
  })));
}
console.log(result.warnings);
```

No network access or storage occurs in this function.

## Limitations

- **No remote ChatGPT fetching**: Vercel backend never downloads chatgpt.com shared pages. Validation of pasted share links is not retrieval.
- **Not full DOM parity**: cannot capture HTML elements that weren't supplied, lazy/virtualized turns, live canvas pixels, resolved remote images or computed CSS.
- **Math/code**: preliminary TeX source and plain `pre/code` content are represented. Full KaTeX/MathML and highlighted code tokens come in Chunk 5.
- **Images/SVG/canvas**: implemented for media present in user-supplied HTML in Chunk 6; external assets are referenced but not downloaded, and canvas pixels require an explicit PNG snapshot. Media in table cells is currently represented with descriptive text.
- **React flight payloads**: detected, not decoded. Hydration-only pages with no semantic roles return null, not an invented empty conversation.
- **Input bounds**: 2 MB HTML string and 75,000 tree nodes. More accurate sanitization and complex visual rendering are planned in later chunks.
- **No PDF yet**: Browser printing and rich PDF appearance arrive in Chunk 8. Chunk 7 added available safe layout/text color and static control capture.

## Safety

The HTML stays within the user browser; `parse5` does not execute scripts, mount elements into a live DOM, or load remote images. Links use protocol allowlisting, malformed content is bounded, and parsed message data is validated again against Chunk 3 schema.

The original extension is **read-only** throughout this work.
