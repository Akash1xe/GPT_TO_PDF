import type { CodeBlock, CodeLine, CodeToken, CodeTokenType } from "@/lib/conversation/content";
import { attr, children, descendants, ignored, parentOf, tag, textOf, type HtmlNode } from "./html-tree";
import { highlightCodeLines } from "./fallback-code-highlighter";

/** Port of newGptTopdf/chatgptCode.ts for static HTML trees. */
const ALIASES: Record<string, string> = {
  "c++": "cpp", cpp: "cpp", cxx: "cpp", js: "javascript", javascript: "javascript",
  ts: "typescript", typescript: "typescript", py: "python", python: "python",
  sh: "bash", shell: "bash", bash: "bash", jsx: "jsx", tsx: "tsx", html: "html",
  xml: "xml", css: "css", json: "json", java: "java", c: "c", csharp: "csharp",
  "c#": "csharp", cs: "csharp", go: "go", rust: "rust", sql: "sql",
  markdown: "markdown", md: "markdown",
};
const DISPLAY: Record<string, string> = {
  cpp: "C++", javascript: "JavaScript", typescript: "TypeScript", python: "Python",
  bash: "Bash", jsx: "JSX", tsx: "TSX", html: "HTML", xml: "XML", css: "CSS",
  json: "JSON", java: "Java", c: "C", csharp: "C#", go: "Go", rust: "Rust",
  sql: "SQL", markdown: "Markdown",
};

export function normalizeLanguage(value: string | null | undefined): string | undefined {
  const input = value?.trim().toLowerCase().replace(/^(?:language-|lang-)/, "");
  if (!input) return undefined;
  return ALIASES[input] ?? (/^[a-z0-9+#.-]{1,30}$/.test(input) ? input : undefined);
}

function classTokens(node: HtmlNode): string[] {
  return (attr(node, "class") ?? "").split(/\s+/).filter((cls) => /^[a-zA-Z0-9_-]{1,100}$/.test(cls)).slice(0, 30);
}

function tokenType(classes: string[]): CodeTokenType {
  // Use separate class tokens; avoid matching language-* names as syntax tokens.
  const word = classes.map((cls) => cls.toLowerCase().replace(/^(?:hljs-|token-)/, ""));
  const has = (...values: string[]) => word.some((cls) => values.some((val) => cls === val || cls.endsWith("-" + val)));
  if (has("comment", "hljs-comment")) return "comment";
  if (has("keyword", "selector-tag", "pl-k")) return "keyword";
  if (has("string", "quote", "pl-s")) return "string";
  if (has("number", "literal", "pl-c1")) return "number";
  if (has("function", "title.function", "title-function")) return "function";
  if (has("variable", "parameter")) return "variable";
  if (has("operator")) return "operator";
  if (has("punctuation")) return "punctuation";
  if (has("property", "attr")) return "property";
  if (has("class-name", "class", "title.class", "title-class")) return "class-name";
  if (has("type", "built_in_type")) return "type";
  if (has("builtin", "built_in", "built-in")) return "builtin";
  if (has("boolean")) return "boolean";
  if (has("regex", "regexp")) return "regex";
  if (has("tag")) return "tag";
  if (has("attribute", "attr-name")) return "attribute";
  return "plain";
}

function flattenedTokens(root: HtmlNode): { tokens: CodeToken[]; structuralEnding: boolean } {
  const tokens: CodeToken[] = [];
  let structuralEnding = false;
  function append(value: string, classes: string[], structural = false) {
    if (!value) return;
    tokens.push({
      text: value.replace(/\r\n?/g, "\n"),
      tokenType: tokenType(classes),
      ...(classes.length ? { classNames: classes.slice(0, 30) } : {}),
    });
    structuralEnding = structural;
  }
  function visit(node: HtmlNode, inherited: string[]) {
    if (node.nodeName === "#text" && "value" in node) {
      append(node.value, inherited);
      return;
    }
    if (ignored(node)) return;
    if (tag(node) === "br") {
      append("\n", [], true);
      return;
    }
    const name = tag(node);
    const cls = classTokens(node);
    const all = [...inherited, ...cls].slice(-30);
    const lineWrapper = name === "div" || cls.includes("line") || cls.includes("code-line");
    if (lineWrapper && tokens.length && !tokens[tokens.length - 1].text.endsWith("\n")) {
      append("\n", [], true);
    }
    for (const child of children(node)) visit(child, all);
    if (lineWrapper && tokens.length && !tokens[tokens.length - 1].text.endsWith("\n")) {
      append("\n", [], true);
    }
  }
  for (const child of children(root)) visit(child, []);
  return { tokens, structuralEnding };
}

function tokenLines(tokens: CodeToken[], code: string): CodeLine[] {
  if (!code) return [];
  const lines: CodeLine[] = [{ number: 1, plainText: "", tokens: [] }];
  for (const t of tokens) {
    t.text.split("\n").forEach((part, index, parts) => {
      if (part) {
        const line = lines[lines.length - 1];
        line.tokens.push({ ...t, text: part });
        line.plainText += part;
      }
      if (index + 1 < parts.length) lines.push({ number: lines.length + 1, plainText: "", tokens: [] });
    });
  }
  return lines;
}

function detectedLanguage(pre: HtmlNode, code: HtmlNode): string | undefined {
  const values: string[] = [];
  for (const node of [code, pre]) {
    values.push(attr(node, "data-language") ?? "", attr(node, "lang") ?? "");
    for (const name of classTokens(node)) {
      if (name.startsWith("language-") || name.startsWith("lang-")) values.push(name);
    }
  }
  // Headers above <pre> may contain "python", "C++", etc.
  const parent = parentOf(pre);
  if (parent) {
    for (const node of children(parent)) {
      if (node === pre) break;
      if (["div", "span"].includes(tag(node))) {
        const label = textOf(node).trim();
        if (label && label.length < 30 && !/^(?:copy|copied|edit)$/i.test(label)) values.push(label);
      }
    }
  }
  return values.map(normalizeLanguage).find(Boolean);
}

export function isCodeBlock(node: HtmlNode): boolean {
  if (tag(node) === "pre") return true;
  if (tag(node) !== "code") return false;
  let ancestor = parentOf(node);
  while (ancestor) {
    if (tag(ancestor) === "pre") return false;
    ancestor = parentOf(ancestor);
  }
  const hasLang = attr(node, "data-language") || classTokens(node).some((cls) => cls.startsWith("language-"));
  return Boolean(hasLang || /\n/.test(textOf(node)));
}

export function extractCodeBlock(node: HtmlNode): CodeBlock | null {
  if (!isCodeBlock(node)) return null;
  const code = tag(node) === "code" ? node
    : descendants(node, (item) => tag(item) === "code")[0] ?? node;
  const flattened = flattenedTokens(code);
  let tokens = flattened.tokens;
  const structuralEnding = flattened.structuralEnding;
  let source = tokens.map((token) => token.text).join("");
  // A synthesized newline from a final line wrapper is structure, not a
  // source newline. Do not trim actual trailing newline text from user code.
  if (structuralEnding && source.endsWith("\n")) {
    source = source.slice(0, -1);
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (tokens[i].text.endsWith("\n")) {
        tokens[i] = { ...tokens[i], text: tokens[i].text.slice(0, -1) };
        break;
      }
    }
    tokens = tokens.filter((token) => token.text);
  }
  const language = detectedLanguage(node, code);
  const hasSemantic = tokens.some((token) => token.tokenType !== "plain");
  const lines = hasSemantic ? tokenLines(tokens, source) : highlightCodeLines(source, language);
  const maxLineLength = Math.max(0, ...source.split("\n").map((line) => line.length));
  return {
    type: "code", ...(language ? { language, displayLanguage: DISPLAY[language] ?? language } : {}),
    code: source, lines, source: hasSemantic ? "dom-highlighted" : "plain",
    lineCount: source ? source.split("\n").length : 0,
    hasLongLines: maxLineLength > 100, maxLineLength, tabSize: 4,
  };
}
