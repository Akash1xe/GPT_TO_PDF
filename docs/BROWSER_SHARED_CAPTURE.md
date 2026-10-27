# Browser-side capture of a ChatGPT shared page

This is an opt-in workaround for **user-opened** shared conversations. It does **not** silently fetch shared URLs. Vercel receives neither the shared conversation nor its copied HTML.

## Use

1. Paste a `https://chatgpt.com/share/<uuid>` URL into the website and validate it.
2. Drag **Capture ChatGPT** to your bookmarks bar. If drag-and-drop is unavailable, use **Copy bookmarklet code** and paste it as the URL of a new browser bookmark. Do not paste the code into a website input or browser console.
3. Open the shared page in ChatGPT. Wait until the messages you need are visible; scroll through longer conversations as appropriate.
4. Click the bookmark. It checks the host/path, removes scripts and interactive controls from a copy of the page's main DOM and copies an inert HTML snapshot.
5. Go back to the website and press **Import captured conversation**. The clipboard source marker must match the validated link. The existing local HTML parser, preview, and **Save as PDF** print flow then run.

If clipboard read is blocked, the captured HTML can be pasted manually in the **Advanced** inspector. Advanced manual HTML input intentionally does not require a provenance marker and must be considered untrusted.

## What this does and does not guarantee

- Captures currently mounted user/assistant message DOM where recognizable markers exist. It may miss virtualized/offscreen content, special media, canvas pixels, and isolated share pages with changed markup.
- Reuses the website's extension-derived semantic parser and PDF renderer, but is **not** the original extension's full long-conversation collector.
- Cannot access a share that the viewer cannot open. It does not read private `/c/` conversations or request ChatGPT credentials.
- Has a 2 MB HTML cap. Large histories should use the extension's full collector or an official account export.
- Uses neither a remote fetch nor a developer-controlled server upload. Copied HTML lives in the user's clipboard and browser memory until cleared.
- Untrusted markup is parsed in an inert tree, not executed. Printed content passes model validation and sanitizer boundaries.

## Remaining feature gap

**Paste a link and automatically download the full conversation with one click** is **not implemented**. A website on Vercel cannot inspect another origin's live DOM; a server-side scraper or proxy would conflict with Vercel's current policy. ChatGPT's public share UI is not a documented export API. If a supported official import API becomes available, it should be implemented as a separate, tested adapter.

## Tests

Run `npm run test` for clipboard bookmarklet DOM snapshot and parser regression cases and `npm run test:browser` for the existing PDF renderer/browser suite.

Acceptance test: load a real accessible share link in Chrome, capture via bookmark, import on website, review messages/warnings, open print preview, and Save as PDF. This real-site test is **not yet verified** in CI.
