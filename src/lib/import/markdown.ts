import { Marked } from "marked";
import type { ContentBlock, InlineNode } from "@/lib/conversation/content";
import { children, descendants, parseHtmlTree, tag } from "@/lib/extractors/html-tree";
import { parseSemanticBlocks, semanticBlocksToPlainText } from "@/lib/extractors/semantic-html-parser";

/** Pure, browser-independent rich text parsing. HTML is never mounted or run. */
const renderer = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    // ChatGPT export text can itself contain raw HTML; render as inert text,
    // never as a style/control/media element.
    html({ text }) { return escapeHtml(text); },
  },
});
function escapeHtml(value: string): string {
  return value.replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

export function parseRichMarkdown(source: string): { blocks: ContentBlock[]; plainText: string; warnings: string[] } {
  if (source.length > 1_000_000) throw new Error("Message exceeds the 1 MB rich-text limit.");
  const html = renderer.parse(source, { async: false }) as string;
  const parsed = parseHtmlTree("<main data-import-root>" + html + "</main>");
  const root = descendants(parsed, node => tag(node) === "main")[0];
  const diagnostics = { messages: [] as string[] };
  const blocks = parseSemanticBlocks(root ? children(root) : [], diagnostics);
  // Empty fenced/whitespace-only text still must not disappear silently.
  if (!blocks.length && source.trim()) {
    blocks.push({ type: "paragraph", children: [{type:"text",text:source.slice(0,1_000_000)}] });
  }
  const plainText = semanticBlocksToPlainText(blocks);
  return { blocks, plainText, warnings: diagnostics.messages };
}

/** Preserve line breaks in a literal .txt rather than interpreting Markdown. */
export function parseLiteralText(source: string): { blocks: ContentBlock[]; plainText: string } {
  if (source.length > 1_000_000) throw new Error("Message exceeds the 1 MB text limit.");
  const blocks: ContentBlock[] = source.replace(/\r\n?/g,"\n").split(/\n{2,}/)
    .map(paragraph=>paragraph.split("\n").flatMap((part,index):InlineNode[]=>
      index===0 ? [{type:"text",text:part}] : [{type:"line-break"},{type:"text",text:part}]
    ))
    .filter(nodes=>nodes.some(node=>node.type==="text"&&node.text.trim()))
    .map(children=>({type:"paragraph" as const,children}));
  return {blocks,plainText:source.replace(/\r\n?/g,"\n").trim()};
}
