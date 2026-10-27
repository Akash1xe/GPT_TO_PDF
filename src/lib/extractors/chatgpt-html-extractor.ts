import type {
  ConversationData, ConversationMessage, MessageIdentityQuality,
} from "@/lib/conversation/conversation";
import { buildConversationStats } from "@/lib/conversation/stats";
import { parseConversationData } from "@/lib/conversation/validation";
import { safeSourceUrl } from "@/lib/conversation/urls";
import {
  attr, children, descendants, hasAttr, ignored,
  normalizedText, parseHtmlTree, parentOf, tag, textOf, type HtmlDocument, type HtmlNode,
} from "./html-tree";
import {
  parseSemanticBlocks, semanticBlocksToPlainText, ROLE_LABEL,
  type ParserWarnings,
} from "./semantic-html-parser";

export interface HtmlExtractionOptions {
  /** The caller supplies the provenance. This is never fetched or followed. */
  sourceUrl?: string;
  capturedAt?: string;
}

export interface HtmlExtractionResult {
  conversation: ConversationData | null;
  warnings: string[];
  diagnostics: {
    roleMarkers: number;
    parsedMessages: number;
    pageHasHydrationStream: boolean;
    pageHasImageOrDiagramNodes: boolean;
    skippedDuplicateIds: number;
  };
}

type Role = "user" | "assistant";
type Candidate = {
  marker: HtmlNode;
  role: Role;
  order: number;
};

function messageRole(node: HtmlNode): Role | null {
  if (ignored(node)) return null;
  for (const key of [
    "data-message-author-role", "data-conversation-role",
    "data-role", "data-message-author", "data-turn",
  ]) {
    const value = attr(node, key);
    if (value === "user" || value === "assistant") return value;
  }
  if (hasAttr(node, "data-user-message-bubble")) return "user";
  return null;
}

function discoverCandidates(root: HtmlNode): Candidate[] {
  const result: Candidate[] = [];
  function scan(node: HtmlNode, withinRole: boolean): void {
    if (ignored(node)) return;
    const role = messageRole(node);
    if (role && !withinRole) result.push({ marker: node, role, order: result.length });
    for (const child of children(node)) scan(child, withinRole || Boolean(role));
  }
  scan(root, false);
  return result;
}

function nearestGroup(node: HtmlNode): HtmlNode | null {
  let ancestor: HtmlNode | null = parentOf(node);
  let fallback: HtmlNode | null = null;
  while (ancestor) {
    const name = tag(ancestor);
    if (["body", "html"].includes(name)) break;
    if (hasAttr(ancestor, "data-turn-key") || hasAttr(ancestor, "data-turn-id")
      || (attr(ancestor, "data-testid") ?? "").startsWith("conversation-turn")
      || (name === "article" && (hasAttr(ancestor, "id") || hasAttr(ancestor, "data-turn")))) {
      return ancestor;
    }
    if (name === "article") fallback = ancestor;
    ancestor = parentOf(ancestor);
  }
  return fallback;
}

function directChildOf(group: HtmlNode, node: HtmlNode): HtmlNode | null {
  let cursor: HtmlNode = node;
  while (parentOf(cursor) && parentOf(cursor) !== group) {
    cursor = parentOf(cursor)!;
  }
  return parentOf(cursor) === group ? cursor : null;
}

function contentNodes(candidate: Candidate): HtmlNode[] {
  const marker = candidate.marker;
  if (candidate.role === "user" && !hasAttr(marker, "data-user-message-bubble")) {
    const contents = descendants(marker, (node) =>
      hasAttr(node, "data-user-message-bubble") || hasAttr(node, "data-message-content")
      || attr(node, "data-testid") === "collapsible-user-message-content");
    if (contents.length) {
      const selected = contents.find((item) => hasAttr(item, "data-user-message-bubble"))
        ?? contents[0];
      return [selected];
    }
  }

  const labelOnly = ROLE_LABEL.test(normalizedText(textOf(marker)));
  if (candidate.role === "assistant" && labelOnly) {
    const group = nearestGroup(marker);
    const direct = group && directChildOf(group, marker);
    if (group && direct) {
      const siblings = children(group);
      const start = siblings.indexOf(direct) + 1;
      const result: HtmlNode[] = [];
      for (const sibling of siblings.slice(start)) {
        if (messageRole(sibling)) break;
        if (!ignored(sibling)) result.push(sibling);
      }
      if (result.length) return result;
    }
    return [];
  }
  return [marker];
}

function messageId(candidate: Candidate): { id: string; quality: MessageIdentityQuality; ordinal?: number } {
  const node = candidate.marker;
  const group = nearestGroup(node);
  // A role label can sit inside its own message-id shell within a shared
  // data-turn-key group. Prefer that per-message identity over the group key.
  let cursor: HtmlNode | null = node;
  let directId: string | undefined;
  while (cursor) {
    directId = attr(cursor, "data-message-id") ?? attr(cursor, "data-message-uuid");
    if (directId || cursor === group) break;
    cursor = parentOf(cursor);
  }
  const testId = attr(node, "data-testid") ?? (group ? attr(group, "data-testid") : undefined);
  const ordinalMatch = testId?.match(/conversation-turn[-_:]?(\d+)/i);
  const ordinal = ordinalMatch ? Number(ordinalMatch[1]) : undefined;
  const sourceOrder = ordinal !== undefined && Number.isSafeInteger(ordinal) && ordinal >= 0
    ? ordinal : undefined;

  if (directId) return { id: directId, quality: "strong", ...(sourceOrder === undefined ? {} : { ordinal: sourceOrder }) };
  const key = attr(node, "data-turn-key") ?? (group ? attr(group, "data-turn-key") : undefined);
  if (key) return { id: `group:${candidate.role}:${key}`, quality: "strong", ...(sourceOrder === undefined ? {} : { ordinal: sourceOrder }) };
  const turnId = attr(node, "data-turn-id") ?? (group ? attr(group, "data-turn-id") : undefined)
    ?? testId ?? attr(node, "id");
  if (turnId) return { id: `${candidate.role}:${turnId}`, quality: "strong", ...(sourceOrder === undefined ? {} : { ordinal: sourceOrder }) };
  // Identical messages must stay separate without stable IDs. Unlike text-hash
  // deduplication, this index-based fallback preserves their document order.
  return { id: `html:${candidate.role}:${candidate.order}`, quality: "contextual" };
}

function documentTitle(root: HtmlDocument): string {
  const title = descendants(root, (node) => tag(node) === "title")[0];
  const value = title ? normalizedText(textOf(title))
    .replace(/\s*[|–—-]\s*ChatGPT\s*$/i, "").trim() : "";
  return value && value.toLowerCase() !== "chatgpt"
    ? value.slice(0, 4096) : "ChatGPT Conversation";
}

function fallbackSignals(html: string, root: HtmlDocument, warnings: string[]) {
  const hydration = html.includes("self.__next_f.push") || html.includes('id="__NEXT_DATA__"');
  const title = documentTitle(root);
  if (!descendants(root, (node) => messageRole(node) !== null).length) {
    const rawTitle = title.toLowerCase();
    if (/just a moment|access denied|log in|sign in|verify you are human/i.test(rawTitle)) {
      warnings.push("The HTML looks like an authentication or access-check page, not a transcript.");
    } else if (hydration) {
      warnings.push("This HTML contains hydration data without recognizable message elements. The static shell is not proof of an empty chat.");
    } else {
      warnings.push("No semantic ChatGPT role markers were found in this HTML snapshot.");
    }
  }
  return hydration;
}

/**
 * Website-local adaptation of newGptTopdf's semantic ChatGPT extraction.
 * Only user-provided HTML is inspected; the function has zero network and
 * browser DOM dependencies. No active ChatGPT /c/ or share URL is fetched.
 */
export function extractChatGPTConversationFromHtml(
  html: string, options: HtmlExtractionOptions = {},
): HtmlExtractionResult {
  const root = parseHtmlTree(html);
  const warnings = [
    "Static HTML snapshot only: the entire conversation and rich media cannot be verified. Live DOM collection is not available to this website.",
  ];
  const hydration = fallbackSignals(html, root, warnings);
  const candidates = discoverCandidates(root);
  const warned: ParserWarnings = { messages: [] };
  const seenIds = new Set<string>();
  let skippedDuplicateIds = 0;
  const messages: ConversationMessage[] = [];

  for (const candidate of candidates) {
    if (messages.length >= 10_000) {
      warnings.push("More than 10,000 messages found. Extraction was limited.");
      break;
    }
    const identity = messageId(candidate);
    if (seenIds.has(identity.id)) {
      skippedDuplicateIds++;
      continue;
    }
    const nodes = contentNodes(candidate);
    const parsedBlocks = nodes.flatMap((node) => parseSemanticBlocks([node], warned));
    const plainText = semanticBlocksToPlainText(parsedBlocks);
    if (!plainText.trim() && parsedBlocks.length === 0) continue;
    seenIds.add(identity.id);
    messages.push({
      id: identity.id,
      role: candidate.role,
      order: messages.length,
      ...(identity.ordinal === undefined ? {} : { sourceOrder: identity.ordinal }),
      identityQuality: identity.quality,
      plainText,
      blocks: parsedBlocks,
    });
  }

  if (!messages.length) {
    return {
      conversation: null,
      warnings: [...new Set([...warnings, ...warned.messages])],
      diagnostics: {
        roleMarkers: candidates.length, parsedMessages: 0,
        pageHasHydrationStream: hydration,
        pageHasImageOrDiagramNodes: descendants(root, (node) => ["img", "svg", "canvas"].includes(tag(node))).length > 0,
        skippedDuplicateIds,
      },
    };
  }

  const source = safeSourceUrl(options.sourceUrl ?? "") ?? "https://chatgpt.com/";
  if (!options.sourceUrl) warnings.push("No source URL supplied. The generic ChatGPT home URL is used as placeholder metadata.");
  else if (!safeSourceUrl(options.sourceUrl)) warnings.push("Unsupported source URL was replaced with ChatGPT home metadata.");

  const date = options.capturedAt && Number.isFinite(Date.parse(options.capturedAt))
    ? options.capturedAt : new Date().toISOString();

  const sourceId = source.match(/https:\/\/chatgpt\.com\/c\/([^/?#]+)/i)?.[1];
  const imported: ConversationData = {
    provider: "chatgpt", title: documentTitle(root),
    url: source, capturedUrl: source, capturedAt: date,
    ...(sourceId ? { conversationId: sourceId } : {}),
    messageCount: messages.length,
    possiblyPartial: true,
    completeness: {
      state: "possibly-partial",
      reason: "unknown",
      collectedMessages: messages.length,
      verifiedBeginning: false, verifiedEnd: false, continuityVerified: false,
    },
    messages,
    stats: buildConversationStats(messages),
  };
  const checked = parseConversationData(imported);
  if (!checked.ok) throw new Error(`Extracted HTML failed conversation validation: ${checked.issues[0]?.message}`);
  warnings.push(...checked.warnings, ...warned.messages);
  if (skippedDuplicateIds) warnings.push(`${skippedDuplicateIds} repeated stable message ID(s) skipped.`);
  if (hydration) warnings.push("React hydration payloads were not decoded; only static marked content was considered.");
  const media = descendants(root, (node) => ["img", "svg", "canvas"].includes(tag(node))).length > 0;
  if (media && checked.data.stats.images === 0) warnings.push("Media elements were present but no supported images were recovered; small icons may have been skipped.");
  return {
    conversation: checked.data,
    warnings: [...new Set(warnings)],
    diagnostics: {
      roleMarkers: candidates.length, parsedMessages: messages.length,
      pageHasHydrationStream: hydration,
      pageHasImageOrDiagramNodes: media,
      skippedDuplicateIds,
    },
  };
}
