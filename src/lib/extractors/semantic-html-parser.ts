import type {
  ContentBlock, InlineNode, ListItem, TableCell, TableRow, TextNode,
} from "@/lib/conversation/content";
import { safeLinkHref } from "@/lib/conversation/urls";
import {
  attr, children, ignored, isElement, normalizedText, parentOf, tag, textOf,
  type HtmlNode,
} from "./html-tree";
import { extractCodeBlock, isCodeBlock } from "./chatgpt-code";
import { extractMathNode, isMathElement } from "./chatgpt-math";
import { containsMedia, extractMediaBlock, isMediaElement } from "./chatgpt-media";
import { explicitTextAppearance, layoutInfo } from "./visual-style";
import { hasVisualControls, visualControl } from "./visual-control";

const INLINE_TAGS = new Set([
  "a", "abbr", "b", "br", "cite", "code", "del", "em", "i", "kbd",
  "mark", "s", "small", "span", "strong", "sub", "sup", "time", "u",
]);
const ROLE_LABEL = /^(?:ChatGPT|Assistant|You)\s+said\s*:?$/i;
const MAX_BLOCK_DEPTH = 35;

export type ParserWarnings = { messages: string[] };

type Marks = Pick<TextNode, "bold" | "italic" | "strikethrough">;

function marksFor(element: HtmlNode, current: Marks): Marks {
  const name = tag(element);
  return {
    ...(current.bold || name === "b" || name === "strong" ? { bold: true } : {}),
    ...(current.italic || name === "i" || name === "em" ? { italic: true } : {}),
    ...(current.strikethrough || ["del", "s", "strike"].includes(name) ? { strikethrough: true } : {}),
  };
}

function adjacentText(nodes: InlineNode[]): InlineNode[] {
  const result: InlineNode[] = [];
  for (const node of nodes) {
    if (node.type === "text" && !node.text) continue;
    const previous = result[result.length - 1];
    if (previous?.type === "text" && node.type === "text"
      && !!previous.bold === !!node.bold
      && !!previous.italic === !!node.italic
      && !!previous.strikethrough === !!node.strikethrough
      && previous.sourceColor === node.sourceColor
      && previous.sourceSurface === node.sourceSurface) {
      previous.text += node.text;
    } else result.push(node);
  }
  const first = result[0];
  if (first?.type === "text") first.text = first.text.replace(/^ +/, "");
  const last = result[result.length - 1];
  if (last?.type === "text") last.text = last.text.replace(/ +$/, "");
  return result.filter((node) => node.type !== "text" || node.text);
}

export function inlineText(nodes: readonly InlineNode[]): string {
  return nodes.map((node) => {
    switch (node.type) {
      case "text": return node.text;
      case "link": return inlineText(node.children);
      case "inline-code": return node.text;
      case "line-break": return "\n";
      case "math": return node.fallbackText;
    }
  }).join("");
}

function inlineNode(node: HtmlNode, warnings: ParserWarnings, marks: Marks, depth: number): InlineNode[] {
  if (depth > MAX_BLOCK_DEPTH) return [];
  if (node.nodeName === "#text" && "value" in node) {
    const content = node.value.replace(/[\t\r\n ]+/g, " ");
    return content ? [{ type: "text", text: content, ...marks, ...explicitTextAppearance(node) }] : [];
  }
  if (!isElement(node)) return [];
  const control = visualControl(node);
  if (control) {
    warnings.messages.push("A control in an inline-only context was preserved as a static state label.");
    return [{ type: "text", text: control.text, ...marks }];
  }
  if (ignored(node)) return [];

  const name = tag(node);
  if (name === "br") return [{ type: "line-break" }];
  if (isMathElement(node)) {
    const math = extractMathNode(node);
    if (math?.displayMode === "inline") return [math];
    return [];
  }
  if (name === "code" && !hasAncestorPre(node) && !isCodeBlock(node)) {
    return [{ type: "inline-code", text: textOf(node) }];
  }
  // Inline-only contexts (notably table cells) cannot carry ImageBlock in
  // the extension-compatible InlineNode schema. Preserve meaningful alt text.
  if (isMediaElement(node)) {
    const image = extractMediaBlock(node, warnings);
    if (!image) return [];
    warnings.messages.push("A media item in an inline-only context was represented by its description; PDF layout cannot embed it inside a table cell yet.");
    return [{ type: "text", text: "[Image: " + (image.alt ?? "media") + "]", ...marks }];
  }
  const next = marksFor(node, marks);
  const contents = children(node).flatMap((child) => inlineNode(child, warnings, next, depth + 1));
  if (name !== "a") return contents;
  const href = attr(node, "href");
  const safe = href ? safeLinkHref(href) : null;
  if (!safe && href) warnings.messages.push("Unsafe or unsupported link URL was discarded.");
  return safe && contents.length ? [{ type: "link", href: safe, children: adjacentText(contents) }] : contents;
}

function hasAncestorPre(node: HtmlNode): boolean {
  let parent = parentOf(node);
  while (parent) {
    if (tag(parent) === "pre") return true;
    parent = parentOf(parent);
  }
  return false;
}

function asInline(nodes: HtmlNode[], warnings: ParserWarnings): InlineNode[] {
  return adjacentText(nodes.flatMap((node) => inlineNode(node, warnings, {}, 0)));
}

/** For normal text, retain links/emphasis in semantic inline nodes. */
function paragraph(nodes: HtmlNode[], warnings: ParserWarnings): ContentBlock | null {
  const result = asInline(nodes, warnings);
  if (!inlineText(result).trim() && !result.some((x) => x.type === "inline-code" || x.type === "math")) return null;
  return { type: "paragraph", children: result };
}

/**
 * Preserve the order of image/diagram blocks interleaved with prose inside a
 * paragraph. Ordinary inline markup still goes through rich inline parsing.
 * Wrappers containing media are descended into rather than flattened away.
 */
function inlineWithMedia(nodes: HtmlNode[], warnings: ParserWarnings, depth: number): ContentBlock[] {
  const result: ContentBlock[] = [];
  let pending: HtmlNode[] = [];
  const flush = () => {
    if (!pending.length) return;
    const p = paragraph(pending, warnings);
    if (p) result.push(p);
    pending = [];
  };
  const visit = (node: HtmlNode, level: number) => {
    if (level > MAX_BLOCK_DEPTH) return;
    const staticControl = visualControl(node);
    if (staticControl) {
      flush();
      result.push(staticControl);
      return;
    }
    if (ignored(node)) return;
    if (isMathElement(node)) {
      // MathML/KaTeX may include decoration paths or SVG glyphs.
      pending.push(node);
    } else if (isMediaElement(node)) {
      flush();
      const media = extractMediaBlock(node, warnings);
      if (media) result.push(media);
    } else if (containsMedia(node) || hasVisualControls(node)) {
      // Media/controls may be wrapped inside <a>, <span> or <picture>.
      for (const child of children(node)) visit(child, level + 1);
    } else {
      pending.push(node);
    }
  };
  for (const node of nodes) visit(node, depth);
  flush();
  return result;
}

function boundedSpan(node: HtmlNode, name: string): number {
  const value = Number(attr(node, name) ?? 1);
  return Number.isSafeInteger(value) && value >= 1 && value <= 100 ? value : 1;
}

function parseTable(node: HtmlNode, warnings: ParserWarnings): ContentBlock {
  const allRows: HtmlNode[] = [];
  function rowsDirect(treeNode: HtmlNode) {
    for (const child of children(treeNode)) {
      const t = tag(child);
      if (t === "tr") allRows.push(child);
      else if (["thead", "tbody", "tfoot"].includes(t)) rowsDirect(child);
    }
  }
  rowsDirect(node);
  const rows: TableRow[] = allRows.map((r) => ({
    cells: children(r).filter((c) => ["th", "td"].includes(tag(c))).map((c): TableCell => ({
      header: tag(c) === "th",
      colspan: boundedSpan(c, "colspan"),
      rowspan: boundedSpan(c, "rowspan"),
      children: asInline(children(c), warnings),
    })),
  }));
  return {
    type: "table", rows,
    columnCount: Math.max(0, ...rows.map((row) => row.cells.reduce((sum, cell) => sum + cell.colspan, 0))),
  };
}

function directListItems(node: HtmlNode): HtmlNode[] {
  return children(node).filter((item) => tag(item) === "li");
}

function contentOf(node: HtmlNode, warnings: ParserWarnings, depth: number): ContentBlock[] {
  if (depth > MAX_BLOCK_DEPTH) return [];
  const name = tag(node);
  const control = visualControl(node);
  if (control) return [control];
  if (ignored(node)) return [];
  if (name === "ol" || name === "ul") {
    const items: ListItem[] = directListItems(node).map((item) => ({
      blocks: parseSemanticBlocks(children(item), warnings, depth + 1),
    }));
    if (name === "ol") {
      const start = Number(attr(node, "start") ?? 1);
      return [{ type: "ordered-list",
        start: Number.isSafeInteger(start) && start >= 1 ? start : 1,
        items }];
    }
    return [{ type: "unordered-list", items }];
  }
  if (name === "blockquote") return [{
    type: "blockquote", blocks: parseSemanticBlocks(children(node), warnings, depth + 1),
  }];
  if (name === "table") return [parseTable(node, warnings)];
  if (name === "figure") {
    const figcaption = children(node).find((child) => tag(child) === "figcaption");
    const caption = figcaption ? textOf(figcaption).replace(/\s+/g, " ").trim().slice(0, 10_000) : "";
    const other = children(node).filter((child) => child !== figcaption);
    const blocks = parseSemanticBlocks(other, warnings, depth + 1);
    if (caption) {
      const firstMedia = blocks.find((block) => block.type === "image");
      if (firstMedia?.type === "image" && !firstMedia.caption) firstMedia.caption = caption;
      else blocks.push({ type: "paragraph", children: [{ type: "text", text: caption }] });
    }
    return blocks;
  }
  if (name === "hr") return [{ type: "horizontal-rule" }];
  if (isCodeBlock(node)) { const block = extractCodeBlock(node); return block ? [block] : []; }
  if (/^h[1-6]$/.test(name)) {
    const childNodes = asInline(children(node), warnings);
    return childNodes.length ? [{ type: "heading", level: Number(name[1]) as 1|2|3|4|5|6, children: childNodes }] : [];
  }
  if (isMathElement(node)) {
    const math = extractMathNode(node);
    return math ? [math] : [];
  }
  if (isMediaElement(node)) {
    const media = extractMediaBlock(node, warnings);
    return media ? [media] : [];
  }
  const layout = layoutInfo(node);
  if (layout) {
    const contents = layout.columns > 1
      ? children(node).filter((child) => !ignored(child))
          .flatMap((child) => {
            const parsed = parseSemanticBlocks([child], warnings, depth + 1);
            return parsed.length
              ? [{ type: "layout" as const, columns: 1, card: false, blocks: parsed }]
              : [];
          })
      : parseSemanticBlocks(children(node), warnings, depth + 1);
    return contents.length ? [{ type: "layout", ...layout, blocks: contents }] : [];
  }
  if (name === "p") {
    return inlineWithMedia(children(node), warnings, depth + 1);
  }
  return parseSemanticBlocks(children(node), warnings, depth + 1);
}

/**
 * Walk structural blocks in document order and preserve inline sequences.
 * Adapted from the extension's parseBlocks/inlineParser/tableParser semantics.
 */
export function parseSemanticBlocks(nodes: HtmlNode[], warnings: ParserWarnings, depth = 0): ContentBlock[] {
  if (depth > MAX_BLOCK_DEPTH) return [];
  const result: ContentBlock[] = [];
  let pending: HtmlNode[] = [];
  const flush = () => {
    if (!pending.length) return;
    const p = paragraph(pending, warnings);
    if (p) result.push(p);
    pending = [];
  };
  for (const node of nodes) {
    const control = visualControl(node);
    if (control) {
      flush();
      result.push(control);
      continue;
    }
    if (ignored(node)) continue;
    // KaTeX can contain SVG glyphs. Treat the entire root as one formula,
    // not a collection of independent media blocks.
    if (isMathElement(node)) {
      const math = extractMathNode(node);
      if (math?.displayMode === "block") {
        flush();
        result.push(math);
      } else {
        pending.push(node);
      }
      continue;
    }
    if (isMediaElement(node) || (isElement(node) && (INLINE_TAGS.has(tag(node)) || tag(node) === "picture") && (containsMedia(node) || hasVisualControls(node)))) {
      flush();
      result.push(...inlineWithMedia([node], warnings, depth + 1));
      continue;
    }
    if (node.nodeName === "#text" || (isElement(node) && INLINE_TAGS.has(tag(node)) && !isCodeBlock(node) && !(isMathElement(node) && extractMathNode(node)?.displayMode === "block"))) {
      pending.push(node);
      continue;
    }
    const name = tag(node);
    if (name === "p") {
      flush();
      result.push(...inlineWithMedia(children(node), warnings, depth + 1));
      continue;
    }
    flush();
    result.push(...contentOf(node, warnings, depth + 1));
  }
  flush();
  return result;
}

export function semanticBlocksToPlainText(blocks: readonly ContentBlock[]): string {
  return normalizedText(blocks.map((b) => {
    switch (b.type) {
      case "paragraph":
      case "heading": return inlineText(b.children);
      case "blockquote":
      case "layout": return semanticBlocksToPlainText(b.blocks);
      case "ordered-list":
      case "unordered-list": return b.items.map((item) => semanticBlocksToPlainText(item.blocks)).join("\n");
      case "table": return b.rows.map((row) => row.cells.map((c) => inlineText(c.children)).join("\t")).join("\n");
      case "code": return b.code;
      case "math": return b.fallbackText;
      case "image": return b.alt ?? "[Image]";
      case "control": return b.text;
      case "horizontal-rule": return "---";
    }
  }).filter(Boolean).join("\n\n"));
}

export { ROLE_LABEL };
