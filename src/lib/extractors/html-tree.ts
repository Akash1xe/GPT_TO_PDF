import { parse, type DefaultTreeAdapterMap } from "parse5";

/**
 * Browser-independent, inert DOM representation. No HTML is ever hydrated,
 * interpreted by the browser, or turned into executable markup.
 * parse5 uses an HTML tree, not an actual Window / Document.
 */
export type HtmlNode = DefaultTreeAdapterMap["node"];
export type HtmlElement = DefaultTreeAdapterMap["element"];
export type HtmlDocument = DefaultTreeAdapterMap["document"];

export const MAX_HTML_LENGTH = 2_000_000;
export const MAX_TREE_DEPTH = 100;
export const MAX_TREE_NODES = 75_000;

export function parseHtmlTree(html: string): HtmlDocument {
  if (html.length > MAX_HTML_LENGTH) {
    throw new Error("HTML sample exceeds the 2 MB local extraction limit.");
  }
  const doc = parse(html);
  let count = 0;
  function inspect(node: HtmlNode, depth: number) {
    if (depth > MAX_TREE_DEPTH || ++count > MAX_TREE_NODES) {
      throw new Error("HTML sample is too deeply nested or contains too many nodes.");
    }
    for (const child of children(node)) inspect(child, depth + 1);
  }
  inspect(doc, 0);
  return doc;
}

export function isElement(node: HtmlNode): node is HtmlElement {
  return "tagName" in node && typeof node.tagName === "string";
}

/** parse5 Document nodes have no parentNode; element/text nodes do. */
export function parentOf(node: HtmlNode): HtmlNode | null {
  return "parentNode" in node ? (node.parentNode as HtmlNode | null) : null;
}

export function tag(node: HtmlNode): string {
  return isElement(node) ? node.tagName.toLowerCase() : "";
}

export function attr(node: HtmlNode, name: string): string | undefined {
  if (!isElement(node)) return undefined;
  return node.attrs.find((item) => item.name === name)?.value;
}

export function hasAttr(node: HtmlNode, name: string): boolean {
  return attr(node, name) !== undefined;
}

export function children(node: HtmlNode): HtmlNode[] {
  return "childNodes" in node ? node.childNodes : [];
}

export function hidden(node: HtmlNode): boolean {
  if (!isElement(node)) return false;
  if (hasAttr(node, "hidden") || attr(node, "aria-hidden") === "true") return true;
  const style = attr(node, "style") ?? "";
  return /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:;|$)/i.test(style);
}

/** Skip toolbar/response controls and passive markup entirely. */
export function ignored(node: HtmlNode): boolean {
  if (hidden(node)) return true;
  const name = tag(node);
  if (["script", "style", "noscript", "template", "nav", "aside", "footer", "iframe",
    "form", "textarea", "select", "input", "button"].includes(name)) return true;
  const role = attr(node, "role");
  if (["button", "menu", "menuitem", "navigation", "toolbar"].includes(role ?? "")) return true;
  const testId = (attr(node, "data-testid") ?? "").toLowerCase();
  return ["copy", "feedback", "regenerate", "share-button", "read-aloud"]
    .some((part) => testId.includes(part))
    || (attr(node, "class") ?? "").split(/\s+/).includes("turn-action-controls");
}

export function descendants(root: HtmlNode, predicate: (node: HtmlNode) => boolean): HtmlNode[] {
  const found: HtmlNode[] = [];
  function walk(node: HtmlNode) {
    if (predicate(node)) found.push(node);
    for (const child of children(node)) walk(child);
  }
  walk(root);
  return found;
}

/** Only for identifying a role label or document title, never for rendering. */
export function textOf(node: HtmlNode): string {
  if (node.nodeName === "#text" && "value" in node) return node.value;
  if (ignored(node)) return "";
  if (tag(node) === "br") return "\n";
  return children(node).map(textOf).join("");
}

export function normalizedText(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n").trim();
}
