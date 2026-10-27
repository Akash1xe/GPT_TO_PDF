import type { PdfTheme } from "@/lib/conversation/preferences";

let diagramSequence = 0;
const MAX_DIAGRAMS = 25;
const MAX_SOURCE_LENGTH = 50_000;

function hasExternalResource(value: string): boolean {
  if (/@import|javascript:/i.test(value)) return true;
  return Array.from(value.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi))
    .some(match => !(match[1] ?? match[2] ?? match[3] ?? "").trim().startsWith("#"));
}

/** Defense in depth on generated SVG: no active content or external resources.
 * Mermaid is configured with strict security and SVG text labels below.
 */
export function safeDiagramSvg(document: Document, source: string): SVGElement {
  const template = document.createElement("template");
  template.innerHTML = source;
  const svg = template.content.querySelector("svg");
  if (!svg) throw new Error("The diagram renderer did not produce SVG.");
  svg.querySelectorAll("script,foreignObject,iframe,object,embed,image,animate,animateTransform,set").forEach(node => node.remove());
  svg.querySelectorAll("a").forEach(node => node.replaceWith(...Array.from(node.childNodes)));
  for (const node of [svg, ...Array.from(svg.querySelectorAll("*"))]) {
    for (const attribute of Array.from(node.attributes)) {
      const name = attribute.name.toLowerCase(), value = attribute.value;
      if (name.startsWith("on") || ((name === "href" || name === "xlink:href") && !value.startsWith("#"))
        || hasExternalResource(value)) node.removeAttribute(attribute.name);
    }
  }
  for (const style of Array.from(svg.querySelectorAll("style"))) {
    if (hasExternalResource(style.textContent ?? "")) style.remove();
  }
  svg.removeAttribute("height");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Rendered Mermaid diagram");
  return svg;
}

/** Browser-only: replace Mermaid code figures before enabling PDF printing.
 * The code remains readable if a diagram is invalid or exceeds its limits.
 */
export async function renderMermaidDiagrams(root: HTMLElement, theme: PdfTheme): Promise<{ rendered: number; failed: number }> {
  const figures = Array.from(root.querySelectorAll<HTMLElement>('[data-diagram-language="mermaid"]'));
  if (!figures.length) return { rendered: 0, failed: 0 };
  const document = root.ownerDocument;
  let rendered = 0, failed = 0;
  const fallback = (figure: HTMLElement) => {
    failed++;
    figure.dataset.diagramState = "failed";
    const note = document.createElement("p");
    note.className = "diagram-warning";
    note.textContent = "This diagram could not be rendered. Its Mermaid source is preserved below.";
    figure.prepend(note);
  };
  try {
    if (document.fonts) await document.fonts.ready;
    const { default: mermaid } = await import("mermaid");
    mermaid.initialize({
      startOnLoad: false, securityLevel: "strict", suppressErrorRendering: true,
      maxTextSize: MAX_SOURCE_LENGTH, maxEdges: 500, htmlLabels: false,
      layout: "dagre", look: "classic", theme: "base", fontFamily: "Arial, Helvetica, sans-serif",
      secure: ["secure", "securityLevel", "startOnLoad", "maxTextSize", "maxEdges", "htmlLabels", "flowchart", "theme", "themeVariables", "layout"],
      flowchart: { htmlLabels: false, useMaxWidth: true, look: "classic", wrappingWidth: 220, curve: "basis", nodeSpacing: 35, rankSpacing: 45, padding: 20 },
      themeVariables: theme === "dark" ? {
        background: "#18181b", primaryColor: "#062b47", primaryTextColor: "#add5ff",
        primaryBorderColor: "#285575", lineColor: "#a6a6a6", secondaryColor: "#12354b", tertiaryColor: "#202024",
      } : {
        background: "#ffffff", primaryColor: "#e8f2ff", primaryTextColor: "#193a57",
        primaryBorderColor: "#34679a", lineColor: "#64748b", secondaryColor: "#eff6ff", tertiaryColor: "#f5f7fa",
      },
    });
    for (const [index, figure] of figures.entries()) {
      const source = figure.querySelector("pre code")?.textContent ?? "";
      // Imported configuration cannot enable HTML, callbacks, or external CSS.
      if (index >= MAX_DIAGRAMS || !source.trim() || source.length > MAX_SOURCE_LENGTH
        || /%%\s*\{|^\s*---\s*\r?\n|\b(?:img|image)\s*[:=]|url\s*\(/i.test(source)) {
        fallback(figure);
        continue;
      }
      const scratch = document.createElement("div");
      scratch.className = "diagram-measurement";
      scratch.setAttribute("aria-hidden", "true");
      document.body.appendChild(scratch);
      try {
        const result = await mermaid.render(`chatpdf-diagram-${++diagramSequence}`, source, scratch);
        const svg = safeDiagramSvg(document, result.svg);
        const diagram = document.createElement("figure");
        diagram.className = "diagram-block";
        diagram.dataset.diagramState = "rendered";
        diagram.appendChild(svg);
        figure.replaceWith(diagram);
        rendered++;
        // bindFunctions is intentionally never called: PDF diagrams are inert.
      } catch {
        fallback(figure);
      } finally {
        scratch.remove();
      }
    }
  } catch {
    figures.filter(figure => !figure.dataset.diagramState).forEach(fallback);
  }
  return { rendered, failed };
}
