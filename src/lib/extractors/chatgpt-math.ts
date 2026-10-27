import type { MathNode } from "@/lib/conversation/content";
import { attr, children, descendants, hasAttr, parentOf, tag, textOf, type HtmlNode } from "./html-tree";

/** Adapted from newGptTopdf/chatgptMath.ts for inert parse5 trees. */
const TEX_ATTRIBUTES = ["data-latex", "data-tex", "data-math", "data-math-source", "data-formula"] as const;
const MATHML_NS = "http://www.w3.org/1998/Math/MathML";
const MATH_TAGS = new Set([
  "math", "semantics", "mrow", "mi", "mn", "mo", "mtext", "ms", "mfrac", "msqrt",
  "mroot", "msub", "msup", "msubsup", "munder", "mover", "munderover", "mmultiscripts",
  "mprescripts", "none", "mtable", "mtr", "mlabeledtr", "mtd", "mfenced", "mspace",
  "mstyle", "mphantom", "mpadded", "menclose", "maction", "maligngroup", "malignmark",
]);
const MATH_ATTRIBUTES = new Set([
  "display", "mathvariant", "mathsize", "mathcolor", "mathbackground", "linethickness",
  "stretchy", "symmetric", "fence", "separator", "form", "minsize", "maxsize", "lspace",
  "rspace", "accent", "accentunder", "movablelimits", "bevelled", "notation", "rowalign",
  "columnalign", "columnspacing", "rowspacing", "columnspan", "rowspan", "width",
  "height", "depth", "open", "close", "separators", "scriptlevel", "displaystyle",
  "subscriptshift", "superscriptshift", "framespacing", "frame", "side",
]);

function classes(node: HtmlNode): string[] {
  return (attr(node, "class") ?? "").split(/\s+/).filter(Boolean);
}
function hasClass(node: HtmlNode, name: string): boolean {
  return classes(node).includes(name);
}
function ancestorHas(node: HtmlNode, names: readonly string[]): boolean {
  let parent = parentOf(node);
  while (parent) {
    if (names.some((name) => hasClass(parent!, name))) return true;
    parent = parentOf(parent);
  }
  return false;
}

/** A KaTeX presentation + its hidden MathML are ONE formula, not two. */
export function isMathElement(node: HtmlNode): boolean {
  if (hasClass(node, "katex-display")) return !ancestorHas(node, ["katex-display"]);
  if (hasClass(node, "katex")) return !ancestorHas(node, ["katex", "katex-display"]);
  if (tag(node) === "math") return !ancestorHas(node, ["katex", "katex-display", "katex-mathml"]);
  if (TEX_ATTRIBUTES.some((name) => hasAttr(node, name))) {
    return !ancestorHas(node, ["katex", "katex-display"]);
  }
  return false;
}

function formulaRoot(node: HtmlNode): HtmlNode {
  return node;
}

function sourceFrom(node: HtmlNode): string | undefined {
  for (const name of TEX_ATTRIBUTES) {
    const candidate = attr(node, name)?.replace(/\r\n?/g, "\n").trim();
    if (candidate) return candidate;
  }
  // Annotations can be nested within the MathML semantics wrapper.
  for (const annotation of descendants(node, (item) => tag(item) === "annotation")) {
    const encoding = (attr(annotation, "encoding") ?? "").trim();
    if (!/^(?:application\/x-(?:tex|latex)|text\/latex)(?:\s*;.*)?$/i.test(encoding)) continue;
    const source = textOf(annotation).replace(/\r\n?/g, "\n").trim();
    if (source) return source;
  }
  const aria = attr(node, "aria-label")?.trim();
  if (aria && /\\[A-Za-z]+|[_^{}]/.test(aria)) return aria;
  return undefined;
}

function mathChild(node: HtmlNode): HtmlNode | undefined {
  return tag(node) === "math" ? node : descendants(node, (item) => tag(item) === "math")[0];
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Whitelist MathML nodes and attributes. Never propagate events/URLs/HTML. */
export function safeMathML(math: HtmlNode): string | undefined {
  if (tag(math) !== "math") return undefined;
  let size = 0;
  function serialize(node: HtmlNode, depth: number): string {
    if (depth > 35 || size > 300_000) return "";
    if (node.nodeName === "#text" && "value" in node) {
      const value = xmlEscape(node.value);
      size += value.length;
      return value;
    }
    const name = tag(node);
    if (!MATH_TAGS.has(name)) return "";
    let attrs = name === "math" ? ' xmlns="' + MATHML_NS + '"' : "";
    if ("attrs" in node) {
      for (const item of node.attrs) {
        const key = item.name.toLowerCase();
        if (!MATH_ATTRIBUTES.has(key) || item.value.length > 120 ||
          !/^[\w\s.,%+\-()/^#]*$/.test(item.value)) continue;
        attrs += ' ' + key + '="' + xmlEscape(item.value) + '"';
      }
    }
    const content = children(node).map((item) => serialize(item, depth + 1)).join("");
    size += content.length + attrs.length;
    return "<" + name + attrs + ">" + content + "</" + name + ">";
  }
  const result = serialize(math, 0);
  return result && result.length <= 300_000 ? result : undefined;
}

function semanticText(node: HtmlNode): string {
  const name = tag(node);
  if (name === "annotation" || name === "annotation-xml") return "";
  if (node.nodeName === "#text" && "value" in node) return node.value;
  const bits = children(node).filter((child) => tag(child) !== "annotation")
    .map(semanticText).filter(Boolean);
  if (name === "mfrac" && bits.length >= 2) return "(" + bits[0] + ")/(" + bits[1] + ")";
  if (name === "msqrt") return "√(" + bits.join("") + ")";
  if (name === "msup" && bits.length >= 2) return bits[0] + "^(" + bits[1] + ")";
  if (name === "msub" && bits.length >= 2) return bits[0] + "_(" + bits[1] + ")";
  if (name === "mtable") return bits.join("; ");
  if (name === "mtr") return "[" + bits.join(", ") + "]";
  return bits.join("");
}

function displayMode(node: HtmlNode): "inline" | "block" {
  for (const name of ["data-math-style", "data-display", "display"]) {
    const value = attr(node, name)?.toLowerCase();
    if (value === "block" || value === "display" || value === "true") return "block";
  }
  if (["katex-display", "math-display", "display-math", "math-block"].some((name) => hasClass(node, name))) return "block";
  if (ancestorHas(node, ["katex-display", "math-display", "display-math", "math-block"])) return "block";
  if (attr(mathChild(node) ?? node, "display") === "block") return "block";
  if (tag(node) === "div" && TEX_ATTRIBUTES.some((name) => hasAttr(node, name))) return "block";
  return "inline";
}

export function extractMathNode(node: HtmlNode): MathNode | null {
  if (!isMathElement(node)) return null;
  const root = formulaRoot(node);
  const source = sourceFrom(root);
  const math = mathChild(root);
  const mathML = math ? safeMathML(math) : undefined;
  const aria = attr(root, "aria-label")?.trim();
  const semantic = math ? semanticText(math).trim() : undefined;
  const fallbackText = source || aria || semantic || "[math]";
  const result: MathNode = {
    type: "math",
    displayMode: displayMode(root),
    fallbackText,
    renderStrategy: source ? "latex" : mathML ? "mathml" : "text-fallback",
  };
  if (source) {
    result.source = source;
    result.sourceFormat = "latex";
    result.sourceLength = source.length;
  } else if (mathML) result.sourceFormat = "mathml";
  if (mathML) result.mathML = mathML;
  return result;
}
