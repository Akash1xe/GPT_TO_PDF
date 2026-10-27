import katex from "katex";
import type { MathNode } from "@/lib/conversation/content";
import { descendants, parseHtmlTree, tag } from "./html-tree";
import { safeMathML } from "./chatgpt-math";

export type MathPreview =
  | { kind: "katex"; html: string; text: string }
  | { kind: "mathml"; html: string; text: string }
  | { kind: "text"; text: string };

/**
 * Pure math rendering preparation for the eventual PDF renderer.
 * HTML comes exclusively from bundled KaTeX or strictly sanitized MathML.
 * A future component may mount only HTML from this function, never raw input.
 */
export function prepareMathPreview(node: MathNode): MathPreview {
  const fallback = node.fallbackText || node.source || "[math]";
  if (node.source && node.sourceFormat !== "mathml" && node.source.length <= 20_000) {
    try {
      const html = katex.renderToString(node.source, {
        displayMode: node.displayMode === "block",
        throwOnError: true,
        trust: false,
        strict: "ignore",
        maxExpand: 150,
        maxSize: 20,
        output: "htmlAndMathml",
      });
      if (html && html.includes("class=\"katex")) {
        return { kind: "katex", html, text: fallback };
      }
    } catch {
      // Intentionally fall through to validated MathML or readable text.
    }
  }
  const source = node.mathML || (node.sourceFormat === "mathml" ? node.source : undefined);
  if (source && source.length < 300_000) {
    try {
      const parsed = parseHtmlTree(source);
      const math = descendants(parsed, (candidate) => tag(candidate) === "math")[0];
      if (math) {
        const html = safeMathML(math);
        if (html) return { kind: "mathml", html, text: fallback };
      }
    } catch {
      // Inert fallback for invalid or unexpectedly huge MathML.
    }
  }
  return { kind: "text", text: fallback };
}
