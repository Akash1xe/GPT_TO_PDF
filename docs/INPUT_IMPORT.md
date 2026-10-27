# Chunk 10 — Additional conversation input methods

## Available sources

| Source | Supported inputs | Fidelity |
| --- | --- | --- |
| OpenAI / ChatGPT export | ZIP containing `conversations.json` or numbered `conversations-1.json`, or those JSON files separately | Active user/assistant branch, Markdown rich text; references to non-text assets become notices |
| Saved ChatGPT HTML | `.html`, `.htm` with recognizable ChatGPT message role markers | Existing semantic HTML parser (code, math, images, SVGs, cards when present) |
| Markdown | `.md` file or paste; role markers `User:` and `Assistant:` | Headings, bold/italic, fenced code, links, lists, tables, inline HTML treated as literal text |
| Plain text | `.txt` file or paste; optional role labels | Paragraphs and preserved line breaks, no invented rich content |

## How to use

1. Go to **Import a conversation** on the website.
2. Choose a ZIP / conversations JSON export, HTML, MD or TXT file; or paste supported content.
3. For an export with many conversations, select a specific title from the dropdown.
4. Review messages and any partial/missing-media warnings.
5. Use the PDF settings and **Open print preview / Save as PDF** to print through your browser.

Official instructions for requesting an export: https://help.openai.com/en/articles/7260999-exporting-your-chatgpt-history-and-data

## Active branch and partial status

ChatGPT export messages are stored in a `mapping` with parent links. Edits and regenerated answers may create siblings. We traverse **backward from `current_node`**, reverse the chain, skip tool/system nodes, and export only readable user/assistant messages. Missing `current_node` is only recoverable when there is a unique, non-ambiguous leaf. Otherwise import is refused with a clear explanation. The website does not claim to reconstruct full private context, message history, hidden steps, or assets referenced externally.

## Privacy and limits

- Inputs stay in browser memory. No file upload endpoint, tracking payload, remote retrieval, cookies or persistent storage is added.
- ZIP extraction filters filenames, ignoring `user.json`, `chat.html`, unrelated account metadata and exported assets.
- File upload cap 35 MB; uncompressed conversation JSON cap 50 MB; at most 30 eligible entries per ZIP. Rich single-message parsing is bounded at 1 MB; HTML at 2 MB.
- PDFs use the browser's native print flow; image URLs embedded in supplied content may refer to unavailable or restricted assets. Non-text JSON parts get **unavailable attachment** placeholders rather than invented pictures.
- Current ChatGPT export layouts may change over time. Unknown content types, alternate branches, and excluded tool/system messages do not become invented assistant messages.

## Testing

Run `npm run check` (all existing and new importer tests, TypeScript, lint, Next production build). Run `npm run test:browser` for Chromium printing. Regression tests include active and alternate branches, rich Markdown, placeholders, malformed sources, ZIP filtering, role-labeled and unlabeled paste, and HTML reuse.

The original extension repository stays untouched.

## Chunk 11 hardening

- Reject ZIPs missing a standard local-file header, eligible archive members with excessive declared expansion sizes, high compression ratios above 500:1, more than 30 recognized files, or more than 50 MB combined declared decompressed JSON.
- Reject excessive conversation trees (over 100,000 nodes) and imported messages that cross 1 MB in combined textual parts or 12 MB for the active path as a whole.
- Require own-properties when resolving `current_node` parent-chain IDs (never traverse `__proto__` or inherited Object prototype keys).
- Do not split role-labeled Markdown messages on `User:` / `Assistant:` lines inside fenced code blocks.
- Header-level no-referrer, framing prevention and limited CSP policies are applied to the website; print views also include a no-store directive.

These are bounded local import safety checks, not a guarantee that malformed or adversarial files can never exhaust device resources. Large files should still be treated cautiously and opened on a capable device.

## Release candidate handling

The file picker rejects .html/.htm/.md/.txt files over 2 MB before reading their contents, reducing unnecessary browser-memory use. ZIP/JSON imports retain their existing 35 MB upload ceiling and 50 MB declared-uncompressed limit. Conversion to PDF keeps third-party image loading off by default, independently of the imported media source.
