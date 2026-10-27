import { validateChatGPTShareLink } from "@/lib/security/shared-link";
import { retrieveSharedConversation, SharedImportError } from "@/lib/extractors/shared-link-import";

const MAX_BODY_BYTES = 4096;

async function readSmallBody(request: Request): Promise<string | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let byteCount = 0;
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) return result + decoder.decode();
    byteCount += value.byteLength;
    if (byteCount > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    result += decoder.decode(value, { stream: true });
  }
}

function respond(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

/** Validation remains available; retrieval is explicitly requested by the UI. */
export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return respond({ ok: false, code: "INVALID_CONTENT_TYPE", message: "Expected application/json." }, 415);
  }

  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > MAX_BODY_BYTES) {
    return respond({ ok: false, code: "BODY_TOO_LARGE", message: "Request body is too large." }, 413);
  }

  let body: unknown;
  try {
    const raw = await readSmallBody(request);
    if (raw === null) {
      return respond({ ok: false, code: "BODY_TOO_LARGE", message: "Request body is too large." }, 413);
    }
    body = JSON.parse(raw);
  } catch {
    return respond({ ok: false, code: "INVALID_JSON", message: "Please send a valid JSON object." }, 400);
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return respond({ ok: false, code: "INVALID_JSON", message: "Expected an object containing a url string." }, 400);
  }
  const result = validateChatGPTShareLink((body as Record<string, unknown>).url);
  if (!result.ok) return respond(result, 400);
  if ((body as Record<string, unknown>).retrieve === true) {
    try {
      const imported = await retrieveSharedConversation(result.canonicalUrl);
      return respond({ ...result, ...imported, retrieval: "complete", conversionReady: true,
        message: "Conversation imported. Review the messages and save your PDF below." });
    } catch (error) {
      return respond({ ...result, retrieval: "failed", conversionReady: false,
        code: error instanceof SharedImportError ? error.code : "IMPORT_FAILED",
        message: error instanceof Error ? error.message : "Could not import this share." }, 422);
    }
  }
  return respond({
    ...result,
    retrieval: "disabled",
    conversionReady: false,
    message: "Valid share-link format. Its content and accessibility have not been verified.",
    nextStep: "Open the share page and use a supported local import method when available.",
  });
}

export function GET(): Response {
  return respond({
    service: "shared-link-inspection",
    stage: "shared-link-import",
    retrieval: "opt-in",
    supports: ["https://chatgpt.com/share/<uuid>"],
    limitations: [
      "Link validation does not mean the conversation can be fetched.",
      "Private /c/ URLs and workspace-restricted shares cannot be imported without appropriate access.",
      "POST retrieve:true to retrieve a public share without credentials; blocked shares require local import.",
    ],
  });
}
