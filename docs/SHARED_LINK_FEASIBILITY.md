# Shared-link feasibility report — Chunk 2

Date: 2026-10-26

## What is verified

1. Official ChatGPT help documents personal-account shared conversation links at `https://chatgpt.com/share/<conversation-id>` and notes that some workspace shares are restricted to authorized recipients. A share may represent a snapshot, only one response, or supported subset rather than every live-chat object.
2. The official public example `https://chatgpt.com/share/696ac45b-70d8-8003-9ca4-320151e0816e` was discoverable through a published open-source import project's documentation. Opening it with the text-oriented browsing tool showed a generic ChatGPT page shell, **not** a machine-readable transcript. This is insufficient evidence to claim link-to-conversation extraction.
3. Other independent open-source projects report that ChatGPT shared pages embed conversation data in React Server Components/Next.js hydration streams. These are implementation details, not a documented stable API. We must not depend on a fixed schema without real-site verification and maintenance.
4. A direct outbound probe to chatgpt.com from the available execution environment failed on DNS resolution. Therefore **no authenticated or unauthenticated end-to-end ChatGPT remote fetch was verified in this chunk**.
5. Vercel's published fair-use guidelines explicitly classify **scrapers** as never fair use, and the Vercel Acceptable Use Policy prohibits scraping or proxying. Therefore automated HTML harvesting is **disabled**, not silently routed through Vercel.
6. Private chat URLs (`/c/...`) cannot be retrieved by this service without authorization to the owner's ChatGPT account; no passwords, cookies or auth tokens will ever be requested.

## Implemented and testable now

- `validateChatGPTShareLink`: strict URL checking, canonicalization and actionable failures.
- `POST /api/shared-link/inspect`: validates URL format only, rate/size bounded via a strict 4 KiB body, never sends remote requests.
- `GET /api/shared-link/inspect`: capabilities plus limitations for integration checks.
- `inspectUserProvidedSharedHtml(html)`: limited proof-of-concept extraction of plaintext from **static role-marked HTML**. Implemented with parse5 in the user's browser (no script/CSS execution or external image requests). Detects hydration-only shells and blocked/login pages. The result is always considered incomplete and **cannot generate a PDF**.
- A working UI lets a user paste and validate a link and optionally inspect already-available HTML locally.

## Risk / decision

**Go on Next.js + Vercel** for user-controlled imports and browser-local PDF rendering.

**No-go at this stage** for automatic backend download and parsing of arbitrary chatgpt.com/share URLs via Vercel functions. It is not an established API, could encounter login/bot checks, and introduces hosting-policy risk.

## Next recommended work

Continue Chunk 3 with the shared normalized conversation model. Chunk 4 can build a browser-local adapter for user-supplied HTML and eventually richer export formats, adapting the original extension's parsing. Revisit direct URL import only with a permitted, stable access mechanism and a compliant hosting architecture.

## References

- OpenAI shared link help: https://help.openai.com/en/articles/7925741-chatgpt-shared-links-faq
- OpenAI current sharing help: https://help-lb.openai.com/en/articles/7925741-sharing-conversations-and-scheduled-tasks-in-chatgpt
- Vercel fair use: https://vercel.com/docs/limits/fair-use-guidelines
- Vercel acceptable use: https://vercel.com/legal/acceptable-use-policy
- Independent React payload investigation: https://github.com/pencil311/chat-share-reader
- Published public-link import example: https://github.com/raymindai/memory-wiki/blob/main/docs/v6-progress/W1-chatgpt-share-import.md

This is a technical feasibility result, **not** legal approval for scraping or assurance that shared-link conversion works.
