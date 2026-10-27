/**
 * Parses only public ChatGPT *conversation* share links. It does not fetch
 * links, authenticate to ChatGPT, or infer that a share is accessible.
 */
export type SharedLinkErrorCode =
  | "MISSING_URL"
  | "INVALID_URL"
  | "UNSAFE_URL"
  | "UNSUPPORTED_HOST"
  | "PRIVATE_CONVERSATION"
  | "UNSUPPORTED_PATH"
  | "INVALID_SHARE_ID";

export type SharedLinkResult =
  | { ok: true; shareId: string; canonicalUrl: string; access: "not-verified" }
  | { ok: false; code: SharedLinkErrorCode; message: string };

const SHARE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function failure(code: SharedLinkErrorCode, message: string): SharedLinkResult {
  return { ok: false, code, message };
}

export function validateChatGPTShareLink(value: unknown): SharedLinkResult {
  if (typeof value !== "string" || !value.trim()) {
    return failure("MISSING_URL", "Paste a ChatGPT shared conversation link.");
  }
  const input = value.trim();
  if (input.length > 2048 || /[\x00-\x1f\x7f\\]/.test(input)) {
    return failure("INVALID_URL", "Enter one valid HTTPS link (maximum 2,048 characters).");
  }
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return failure("INVALID_URL", "That is not a valid URL. Paste the complete https://chatgpt.com/share/... link.");
  }

  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    return failure("UNSAFE_URL", "Only standard HTTPS links without credentials or custom ports are allowed.");
  }
  // Exactly one supported host: no sibling domains, subdomains, IPs or lookalikes.
  if (url.hostname !== "chatgpt.com") {
    return failure("UNSUPPORTED_HOST", "The link must come from chatgpt.com.");
  }
  if (/^\/c(?:\/|$)/.test(url.pathname)) {
    return failure("PRIVATE_CONVERSATION", "Private /c/ conversation URLs cannot be accessed by this website. Create a shared link in ChatGPT.");
  }
  if (!url.pathname.startsWith("/share/")) {
    return failure("UNSUPPORTED_PATH", "Use a conversation link beginning with https://chatgpt.com/share/.");
  }

  const match = /^\/share\/([^/]+)\/?$/.exec(url.pathname);
  const id = match?.[1];
  if (!id || !SHARE_ID.test(id)) {
    return failure("INVALID_SHARE_ID", "The shared conversation ID must be a standard UUID.");
  }
  // Discard tracking parameters and fragments; never forward them to a server.
  return {
    ok: true,
    shareId: id.toLowerCase(),
    canonicalUrl: `https://chatgpt.com/share/${id.toLowerCase()}`,
    access: "not-verified",
  };
}
