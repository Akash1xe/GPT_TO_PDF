import type { ConversationData } from "@/lib/conversation/conversation";
import { type ExportPreferences } from "@/lib/conversation/preferences";
import { filterConversationForExport, normalizeExportPreferences } from "@/lib/conversation/export-settings";
import { parseConversationData } from "@/lib/conversation/validation";
import { controlExternalImages } from "./external-media";

export const PRINT_READY = "chatpdf:print-ready" as const;
export const PRINT_DOCUMENT = "chatpdf:print-document" as const;

export type PrintPayload = {
  type: typeof PRINT_DOCUMENT;
  conversation: ConversationData;
  preferences: ExportPreferences;
  allowExternalImages: boolean;
};

/**
 * Never ship arbitrary unvalidated conversation markup to a print view.
 * The opener and print view BOTH call this normalization boundary.
 */
export function preparePrintPayload(conversation: unknown, preferences: unknown, allowExternalImages = false): PrintPayload {
  const checked = parseConversationData(conversation);
  if (!checked.ok) throw new Error(`Invalid conversation: ${checked.issues[0]?.message || "unknown error"}`);
  const normalized = normalizeExportPreferences(preferences).data;
  const filtered = filterConversationForExport(checked.data, normalized);
  if (!filtered.messages.some((message) => message.blocks.length || message.plainText)) {
    throw new Error("No printable messages match the chosen filter.");
  }
  return { type: PRINT_DOCUMENT, conversation: controlExternalImages(filtered, allowExternalImages === true), preferences: normalized, allowExternalImages: allowExternalImages === true };
}

/**
 * Open synchronously in a user click (so popup blockers permit it), with a
 * one-time same-origin postMessage handshake, not localStorage/cookies/network.
 */
export function openPrintPreview(conversation: ConversationData, preferences: ExportPreferences, allowExternalImages = false): void {
  if (typeof window === "undefined") throw new Error("Browser print preview is unavailable on the server.");
  const payload = preparePrintPayload(conversation, preferences, allowExternalImages);
  let popup: Window | null = null;
  const onMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || event.source !== popup) return;
    if (!event.data || event.data.type !== PRINT_READY) return;
    window.removeEventListener("message", onMessage);
    popup?.postMessage(payload, window.location.origin);
  };
  window.addEventListener("message", onMessage);
  // Link opens in a same-origin, dedicated Next.js page; no query parameters
  // contain conversation content. Separate tab = browser native PDF print.
  popup = window.open("/print", "_blank");
  if (!popup) {
    window.removeEventListener("message", onMessage);
    throw new Error("The browser blocked the print preview. Allow popups for this website and retry.");
  }
  window.setTimeout(() => window.removeEventListener("message", onMessage), 60_000);
}
