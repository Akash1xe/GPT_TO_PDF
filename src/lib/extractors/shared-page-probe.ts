import { parse } from "parse5";

/**
 * Local-only feasibility parser for HTML supplied by the user.
 * parse5 creates an inert document tree: no script execution, CSS, JS hydration,
 * outgoing fetches, or DOM evaluation. Not a complete conversation extractor.
 */
type TreeNode = {
  nodeName: string;
  tagName?: string;
  value?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: TreeNode[];
};

export interface PrototypeMessage {
  role: "user" | "assistant";
  text: string;
}

export type HtmlProbeResult = {
  kind: "static-markup" | "hydration-only" | "blocked-or-login" | "unrecognized";
  title: string | null;
  messages: PrototypeMessage[];
  signals: { reactFlight: boolean; nextData: boolean; roleMarkers: number };
  warnings: string[];
};

const MAX_HTML_CHARS = 2_000_000;
const BLOCK_TAGS = new Set(["p", "div", "article", "section", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "tr", "br"]);
const IGNORED_TAGS = new Set(["script", "style", "noscript", "template", "svg", "iframe", "button", "nav", "aside", "footer"]);

function attr(node: TreeNode, name: string): string | undefined {
  return node.attrs?.find((entry) => entry.name === name)?.value;
}

function roleOf(node: TreeNode): "user" | "assistant" | null {
  for (const name of ["data-message-author-role", "data-conversation-role", "data-role", "data-message-author"]) {
    const role = attr(node, name);
    if (role === "user" || role === "assistant") return role;
  }
  if (attr(node, "data-user-message-bubble") !== undefined) return "user";
  return null;
}

function hidden(node: TreeNode): boolean {
  return attr(node, "hidden") !== undefined || attr(node, "aria-hidden") === "true";
}

function nodeText(node: TreeNode): string {
  if (node.nodeName === "#text") return node.value ?? "";
  if (hidden(node) || IGNORED_TAGS.has(node.tagName || "")) return "";
  const tag = node.tagName || "";
  const children = (node.childNodes || []).map(nodeText).join("");
  if (tag === "br") return "\n";
  return BLOCK_TAGS.has(tag) ? `\n${children}\n` : children;
}

function cleanText(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n").trim();
}

function titleOf(root: TreeNode): string | null {
  let title: string | null = null;
  const scan = (node: TreeNode): void => {
    if (title !== null) return;
    if (node.tagName === "title") {
      title = cleanText((node.childNodes || []).map(nodeText).join(""));
      return;
    }
    for (const child of node.childNodes || []) scan(child);
  };
  scan(root);
  return title || null;
}

export function inspectUserProvidedSharedHtml(html: string): HtmlProbeResult {
  if (html.length > MAX_HTML_CHARS) {
    throw new Error("HTML sample exceeds the 2 MB local preview limit.");
  }
  const root = parse(html) as TreeNode;
  const messages: PrototypeMessage[] = [];
  let roleMarkers = 0;
  const scan = (node: TreeNode, insideRole = false): void => {
    if (hidden(node) || IGNORED_TAGS.has(node.tagName || "")) return;
    const role = roleOf(node);
    if (role) roleMarkers++;
    if (role && !insideRole) {
      const text = cleanText(nodeText(node));
      if (text && !/^(?:ChatGPT|Assistant|You)\s+said\s*:?$/i.test(text)) {
        messages.push({ role, text });
      }
    }
    for (const child of node.childNodes || []) scan(child, insideRole || Boolean(role));
  };
  scan(root);
  const signals = {
    reactFlight: html.includes("self.__next_f.push") || html.includes("self.__next_f ="),
    nextData: html.includes('id="__NEXT_DATA__"') || html.includes("id='__NEXT_DATA__'"),
    roleMarkers,
  };
  const title = titleOf(root);
  const blocked = /(?:just a moment|checking your browser|access denied|verify you are human|log in to chatgpt)/i.test(title || "");
  const kind: HtmlProbeResult["kind"] = messages.length > 0 ? "static-markup"
    : blocked ? "blocked-or-login"
    : signals.reactFlight || signals.nextData ? "hydration-only"
    : "unrecognized";
  const warnings = [
    "Prototype only: message text is recovered from visible semantic HTML markers. Rich blocks, embedded images and completeness are not yet verified.",
  ];
  if (kind === "hydration-only") warnings.push("This HTML contains hydration payloads but no directly identifiable message markup. Do not treat the page shell as an empty conversation.");
  if (kind === "blocked-or-login") warnings.push("This appears to be an access or login page rather than a public conversation.");
  if (kind === "unrecognized") warnings.push("No recognizable ChatGPT message structure was found.");
  if (roleMarkers > messages.length) warnings.push("Some role markers contained no printable message text; this sample may be incomplete.");
  return { kind, title, messages, signals, warnings };
}
