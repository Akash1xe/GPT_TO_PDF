import { validateChatGPTShareLink } from "@/lib/security/shared-link";
import { importExportedConversation } from "@/lib/import/export-conversation";
import { extractChatGPTConversationFromHtml } from "./chatgpt-html-extractor";
import { attr, children, descendants, parseHtmlTree, tag, textOf } from "./html-tree";

const MAX_BYTES = 2_000_000;
export class SharedImportError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

/** Decode the indexed JSON graph used by React Router's turbo-stream.
 * Only data is interpreted; scripts and serialized constructors are never run.
 */
function decodeGraph(values: unknown[]): unknown {
  if (values.length > 100_000) throw new Error("Shared data has too many entries.");
  const cache = new Map<number, unknown>();
  let budget = 500_000;
  function read(index: unknown, depth = 0): unknown {
    if (--budget < 0 || depth > 200) throw new Error("Shared data is too complex.");
    if (typeof index !== "number" || !Number.isInteger(index)) throw new Error("Invalid shared data reference.");
    if (index < 0) return index === -5 ? null : undefined;
    if (index >= values.length) throw new Error("Missing shared data reference.");
    if (cache.has(index)) return cache.get(index);
    const value = values[index];
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) {
      const result: unknown[] = [];
      cache.set(index, result);
      // Tagged values (Dates, promises, errors, etc.) are not message data.
      if (typeof value[0] === "string") return result;
      for (const ref of value) result.push(read(ref, depth + 1));
      return result;
    }
    const result: Record<string, unknown> = Object.create(null);
    cache.set(index, result);
    for (const [key, ref] of Object.entries(value)) {
      if (!/^_\d+$/.test(key)) continue;
      const name = read(Number(key.slice(1)), depth + 1);
      if (typeof name === "string") result[name] = read(ref, depth + 1);
    }
    return result;
  }
  return read(0);
}

function findConversation(root: unknown): Record<string, unknown> | null {
  const queue = [root], seen = new Set<object>();
  for (let i = 0; i < queue.length && i < 100_000; i++) {
    const value = queue[i];
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    const obj = value as Record<string, unknown>;
    if (obj.mapping && typeof obj.mapping === "object" && !Array.isArray(obj.mapping)) return obj;
    queue.push(...Object.values(obj));
  }
  return null;
}

export function extractSharedConversation(html: string, sourceUrl: string) {
  const doc = parseHtmlTree(html);
  for (const script of descendants(doc, node => tag(node) === "script")) {
    const source = children(script).map(textOf).join("");
    const candidates: unknown[] = [];
    if (attr(script, "id") === "__NEXT_DATA__" || attr(script, "type") === "application/json") {
      try { candidates.push(JSON.parse(source)); } catch { /* Not conversation JSON. */ }
    }
    for (const match of source.matchAll(/streamController\.enqueue\(\s*("(?:[^"\\]|\\.)*")\s*\)/g)) {
      try {
        const stream = JSON.parse(match[1]) as string;
        const graph: unknown = JSON.parse(stream);
        if (Array.isArray(graph)) candidates.push(decodeGraph(graph));
      } catch { /* Unsupported stream frames fall back to readable HTML. */ }
    }
    for (const candidate of candidates) {
      const data = findConversation(candidate);
      if (!data) continue;
      const result = importExportedConversation(data);
      result.conversation.url = sourceUrl;
      result.conversation.capturedUrl = sourceUrl;
      result.conversation.capturedAt = new Date().toISOString();
      return result;
    }
  }
  const result = extractChatGPTConversationFromHtml(html, { sourceUrl });
  if (result.conversation) return { conversation: result.conversation, warnings: result.warnings };
  throw new SharedImportError("NO_CONVERSATION", "ChatGPT did not return readable conversation data. The share may be expired, restricted, or use an unsupported format. Open it on ChatGPT or use the capture/import options below.");
}

/** Fetch only a canonical public share. Never forward credentials or follow redirects. */
export async function retrieveSharedConversation(input: unknown, fetcher: typeof fetch = fetch) {
  const checked = validateChatGPTShareLink(input);
  if (!checked.ok) throw new SharedImportError(checked.code, checked.message);
  try {
    const response = await fetcher(checked.canonicalUrl, {
      redirect: "manual", cache: "no-store", credentials: "omit",
      signal: AbortSignal.timeout(15_000), headers: { Accept: "text/html" },
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new SharedImportError("SHARE_UNAVAILABLE", response.status === 404 || response.status === 410
        ? "This shared conversation was not found. It may have been deleted or unshared."
        : "ChatGPT could not serve this share to the website. Open the share and use browser capture or import a file below.");
    }
    if (!response.headers.get("content-type")?.includes("text/html")) {
      await response.body?.cancel();
      throw new SharedImportError("UNEXPECTED_RESPONSE", "ChatGPT did not return a conversation page.");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty response");
    let size = 0, html = "";
    const decoder = new TextDecoder();
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new SharedImportError("SHARE_TOO_LARGE", "This share exceeds the 2 MB retrieval limit. Import a ChatGPT JSON export instead.");
      }
      html += decoder.decode(part.value, { stream: true });
    }
    html += decoder.decode();
    return { ...extractSharedConversation(html, checked.canonicalUrl), canonicalUrl: checked.canonicalUrl };
  } catch (error) {
    if (error instanceof SharedImportError) throw error;
    throw new SharedImportError("IMPORT_FAILED", "The shared conversation could not be imported. Try again, or use browser capture / file import below.");
  }
}
