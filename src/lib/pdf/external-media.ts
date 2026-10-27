import type { ContentBlock } from "@/lib/conversation/content";
import type { ConversationData } from "@/lib/conversation/conversation";

/** URL-backed image elements may contact third-party servers from the print tab.
 * Suppress them by default. Self-contained data images and inline SVG remain.
 */
export function controlExternalImages(conversation: ConversationData, allowExternal: boolean): ConversationData {
  if (allowExternal) return conversation;
  const mapBlock = (block: ContentBlock): ContentBlock => {
    if (block.type === "image") {
      const external = block.sourceType === "remote" || block.sourceType === "blob"
        || Boolean(block.src && /^(?:https?:|blob:)/i.test(block.src));
      return external ? {
        ...block, src: undefined, sourceType: "unknown",
        alt: (block.alt || "Remote image").slice(0, 9950) + " (external image not loaded)",
      } : block;
    }
    if (block.type === "layout" || block.type === "blockquote") {
      return { ...block, blocks: block.blocks.map(mapBlock) };
    }
    if (block.type === "ordered-list" || block.type === "unordered-list") {
      return { ...block, items: block.items.map((item) => ({ ...item, blocks: item.blocks.map(mapBlock) })) };
    }
    return block;
  };
  return { ...conversation, messages: conversation.messages.map((message) => ({
    ...message, blocks: message.blocks.map(mapBlock),
  })) };
}
