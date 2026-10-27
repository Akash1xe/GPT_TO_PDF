import type { CodeBlock } from "@/lib/conversation/content";
import type { ExportPreferences } from "@/lib/conversation/preferences";
import { el } from "./dom";
import { highlightCodeLines } from "@/lib/extractors/fallback-code-highlighter";

export function renderCodeBlock(document: Document, block: CodeBlock, preferences: ExportPreferences): HTMLElement {
  const wrapper = el(document, "figure", `code-block code-theme-${preferences.pdfTheme === 'dark' ? 'dark' : preferences.codeTheme}`);
  if (block.lineCount <= 18) wrapper.classList.add("code-short");
  if (block.hasLongLines) wrapper.classList.add("code-has-long-lines");
  if (preferences.wrapCode) wrapper.classList.add("code-wrap");

  if (preferences.showCodeLanguage && (block.displayLanguage || block.language)) {
    const label = el(document, "figcaption", "code-label");
    label.textContent = block.displayLanguage || block.language || "Code";
    wrapper.appendChild(label);
  }

  const hasSemanticTokens = block.lines.some((line) => line.tokens.some((token) => token.tokenType !== "plain"));
  const renderLines = hasSemanticTokens ? block.lines : highlightCodeLines(block.code, block.language);
  if (!hasSemanticTokens && block.code) wrapper.classList.add("code-fallback-highlighted");

  const pre = el(document, "pre");
  pre.style.tabSize = String(block.tabSize || 4);
  const code = el(document, "code");
  renderLines.forEach((line, index) => {
    line.tokens.forEach((token) => {
      const span = el(document, "span", `tok tok-${token.tokenType}`);
      span.textContent = token.text;
      code.appendChild(span);
    });
    if (index < renderLines.length - 1) code.appendChild(document.createTextNode("\n"));
  });
  if (!renderLines.length && block.code) code.textContent = block.code;
  pre.appendChild(code);
  wrapper.appendChild(pre);
  return wrapper;
}
