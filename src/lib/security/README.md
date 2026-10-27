# Security boundaries

Implemented in Chunk 2:

- `shared-link.ts`: exact host `chatgpt.com`, HTTPS and `/share/<uuid>` requirement, rejects embedded credentials, private `/c/` pages, lookalike hostnames, unsafe URL syntax, and extra path segments; removes tracking query and fragments.
- `/api/shared-link/inspect`: bounded request body, JSON-only input, no-store responses, no server-side fetch, no persistence and no collection of user cookies.
- `shared-page-probe.ts`: inert parse5 tree, no evaluation/remote asset loading, text-only output; 2 MB client-side limit.

Future links must be treated as untrusted and never used as an arbitrary fetch target. Before adding any network extraction, reassess OpenAI access conditions, Vercel's anti-scraping policy, SSRF, redirects, timeouts and quotas.

No conversion content is transmitted or stored by the current implementation.
