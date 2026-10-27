import type { ContentBlock, InlineNode } from "./content";
import type { ConversationMessage, ConversationStats } from "./conversation";

/** Deterministic counts for the shared model. Never trust counts supplied by an importer. */
export function buildConversationStats(messages: readonly ConversationMessage[]): ConversationStats {
  let userMessages = 0;
  let assistantMessages = 0;
  let codeBlocks = 0;
  let mathNodes = 0;
  let images = 0;

  function inline(nodes: readonly InlineNode[]) {
    for (const node of nodes) {
      if (node.type === "math") mathNodes++;
      else if (node.type === "link") inline(node.children);
    }
  }

  function blocks(items: readonly ContentBlock[]) {
    for (const block of items) {
      switch (block.type) {
        case "layout":
        case "blockquote":
          blocks(block.blocks);
          break;
        case "ordered-list":
        case "unordered-list":
          for (const item of block.items) blocks(item.blocks);
          break;
        case "paragraph":
        case "heading":
          inline(block.children);
          break;
        case "table":
          for (const row of block.rows) for (const cell of row.cells) inline(cell.children);
          break;
        case "code":
          codeBlocks++;
          break;
        case "math":
          mathNodes++;
          break;
        case "image":
          images++;
          break;
        case "control":
        case "horizontal-rule":
          break;
      }
    }
  }

  for (const message of messages) {
    if (message.role === "user") userMessages++;
    else if (message.role === "assistant") assistantMessages++;
    blocks(message.blocks);
  }

  return { totalMessages: messages.length, userMessages, assistantMessages, codeBlocks, mathNodes, images };
}
