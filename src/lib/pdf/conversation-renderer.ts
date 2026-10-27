import type { ConversationData } from "@/lib/conversation/conversation";
import type { ExportPreferences } from "@/lib/conversation/preferences";
import { renderBlocks } from "./block-renderer";
import { el } from "./dom";

function formatExportDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

function isAssistantOnlyExport(conversation: ConversationData, preferences: ExportPreferences): boolean {
  if (preferences.excludeUserMessages || preferences.messageFilter === "assistant") return true;
  return conversation.messages.length > 0 && conversation.messages.every((message) => message.role === "assistant");
}

export function renderConversation(document: Document, conversation: ConversationData, preferences: ExportPreferences): HTMLElement {
  const assistantOnly = isAssistantOnlyExport(conversation, preferences);
  const article = el(document, "article", `export-document theme-${preferences.pdfTheme}${assistantOnly ? " assistant-only-document" : ""}`);

  if (preferences.includeTitle || preferences.includeExportDate || preferences.includeSourceUrl) {
    const header = el(document, "header", "document-header");
    if (preferences.includeTitle) {
      const title = el(document, "h1", "document-title");
      title.textContent = conversation.title;
      header.appendChild(title);
    }
    const metadata = el(document, "div", "document-meta");
    if (preferences.includeExportDate) {
      const date = el(document, "span");
      date.textContent = `Exported ${formatExportDate(conversation.capturedAt)}`;
      metadata.appendChild(date);
    }
    if (preferences.includeSourceUrl) {
      const link = el(document, "a");
      link.href = conversation.capturedUrl;
      link.rel = "noreferrer noopener";
      link.textContent = "Source conversation";
      metadata.appendChild(link);
    }
    if (metadata.childNodes.length) header.appendChild(metadata);
    article.appendChild(header);
  }

  conversation.messages.forEach((message) => {
    // Attachment-only user turns still count for history verification, but
    // intentionally have no printable content (including no empty role label).
    if (!message.plainText && message.blocks.length === 0) return;
    const section = el(document, "section", `message message-${message.role}`);
    if (!assistantOnly) {
      const role = el(document, "div", "message-role");
      role.textContent = message.role === "user" ? "User" : "Assistant";
      section.appendChild(role);
    }
    const body = el(document, "div", "message-body");
    body.appendChild(renderBlocks(document, message.blocks, preferences));
    section.appendChild(body);
    article.appendChild(section);
  });
  return article;
}

export function safePdfTitle(title: string): string {
  const clean = title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 96);
  return clean || "ChatGPT Conversation";
}
