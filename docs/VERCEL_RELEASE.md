# Vercel release checklist — Chunk 12

## Current status

**Source code is a validated release candidate, not a deployed or publicly approved production service.** The project is intentionally marked `robots: { index: false, follow: false }` until the owner explicitly approves publishing and indexing.

## Import the correct repository

1. Sign into [Vercel](https://vercel.com/) with your GitHub account and select **Add New → Project**.
2. Choose `Akash1xe/Website_chatGpt_to_PDF` (not `newGptTopdf`). Verify the correct repository and branch before proceeding.
3. Framework Preset: **Next.js** (auto-detected, reinforced by `vercel.json`).
4. Root directory: **repository root** (`./`).
5. Build Command: use the framework default (project `npm run build` → `next build`).
6. Output directory: leave at the **Next.js framework default**; don't force static output or add `output: "export"`, since the app uses API routes.
7. Install command: Vercel's default `npm install`, as a lockfile has **not** yet been committed. Pinning dependencies with a reviewed lockfile is a recommended follow-up before a production launch.
8. Node runtime: choose compatible **Node.js 22** in the project settings where available. The package requires Node 22.12 or newer.
9. No API keys or environment variables are required for core local file importing and browser printing. **Never** add ChatGPT session cookies or user conversation text to Vercel environment variables.

## Privacy and release gate

- The current production HTML import and PDF generation are local to the user's browser. The optional shared-link format validator sends the **link URL** to a small Vercel function and never fetches a ChatGPT transcript.
- The print preview uses a same-origin window message; no conversation contents go into query parameters, cookies or persistent storage. Remote images are **blocked by default** and only loaded on explicit opt-in.
- Keep the project restricted to your approved testers until you intentionally choose to make it public. A public Vercel production URL can still be accessed directly even with `noindex`. Search-engine opt-out is *not* authentication.
- Do not publish the URL or enable search indexing without owner approval. **No deployment is performed by this repository change.**

## Verify each preview/production deployment

1. Confirm `GET /api/health` returns `status: "ok"`.
2. Confirm `GET /print` sends `Cache-Control: no-store`, anti-framing and no-referrer headers, and that an uninitialized print tab cannot print a conversation.
3. Import `conversations.json` and a small `.md` file, choose a conversation, and open PDF preview. Confirm A4/Letter, equations and code are readable.
4. Test both external image options: by default only a labeled placeholder shows; with consent, the browser may fetch an external image.
5. Verify mobile-width controls and an actual Save as PDF print in Chrome. Firefox/Safari print fidelity remains unverified.
6. Inspect Vercel build logs and deployed assets for unexpected errors; compare release commit to passing GitHub Actions.
7. Approve public distribution and indexing separately from deployment.

## Validation commands

```bash
npm install
npm run check
npm run test:browser
```

The GitHub Actions quality gate exercises tests, TypeScript, ESLint, Next.js production build and Chromium/PDF regressions. It does not create a Vercel deployment, provision a project, or verify an actual Vercel hostname.

## Configuration

`vercel.json` is deliberately minimal:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs"
}
```

Vercel detects the framework defaults. The existing security headers and print no-store rules are configured in `next.config.ts` and exercised by the browser tests.
