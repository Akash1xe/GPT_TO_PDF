import type { MathNode } from "@/lib/conversation/content";
import { prepareMathPreview } from "@/lib/extractors/math-preview";
import { el } from "./dom";

/** Only generated KaTeX HTML or allowlisted MathML enters this DOM. */
export function renderMath(document: Document, node: MathNode): HTMLElement {
  const container = el(document, node.displayMode === "block" ? "div" : "span", `math math-${node.displayMode}`);
  container.setAttribute("aria-label", node.fallbackText || node.source || "Mathematical expression");
  const prepared = prepareMathPreview(node);
  if (prepared.kind !== "text") {
    // This is trusted output from local KaTeX or the strict MathML sanitizer;
    // raw user-controlled HTML is never written to innerHTML.
    const template = document.createElement("template");
    template.innerHTML = prepared.html;
    if (template.content.childNodes.length > 0) {
      container.appendChild(template.content.cloneNode(true));
      return container;
    }
  }
  const fallback = el(document, "span", "math-fallback");
  fallback.textContent = prepared.text;
  container.appendChild(fallback);
  return container;
}
