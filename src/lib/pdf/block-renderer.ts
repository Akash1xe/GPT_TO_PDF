import type { ContentBlock } from "@/lib/conversation/content";
import type { ExportPreferences } from "@/lib/conversation/preferences";
import { renderInlineNodes } from "./inline-renderer";
import { renderCodeBlock } from "./code-renderer";
import { renderMath } from "./math-renderer";
import { renderTable } from "./table-renderer";
import { renderImage } from "./image-renderer";
import { el } from "./dom";
import { isSourceColor } from "./source-colors";

function renderList(document: Document, block: Extract<ContentBlock, { type: "ordered-list" | "unordered-list" }>, preferences: ExportPreferences): HTMLElement {
  const list: HTMLOListElement | HTMLUListElement = block.type === "ordered-list" ? el(document, "ol") : el(document, "ul");
  if (block.type === "ordered-list" && block.start !== 1) list.setAttribute("start", String(block.start));
  block.items.forEach((item) => {
    const li = el(document, "li");
    item.blocks.forEach((child) => li.appendChild(renderBlock(document, child, preferences)));
    list.appendChild(li);
  });
  return list;
}

export function renderBlock(document: Document, block: ContentBlock, preferences: ExportPreferences): HTMLElement {
  switch (block.type) {
    case 'layout': {
      const container = el(document, 'div', `visual-layout${block.card ? ' visual-card' : ''}`);
      if (preferences.pdfTheme === 'dark') {
        if (isSourceColor(block.sourceBackground)) {
          container.style.backgroundColor = block.sourceBackground;
          container.classList.add('visual-panel');
        }
        if (isSourceColor(block.sourceBorder)) container.style.borderColor = block.sourceBorder;
        if (block.sourceAlign === 'center') container.style.textAlign = 'center';
      }
      if (preferences.pdfTheme === 'light') {
        if (isSourceColor(block.sourceBackground)) {
          container.style.backgroundColor = `color-mix(in srgb, ${block.sourceBackground} 12%, white)`;
          container.classList.add('visual-panel');
        }
        if (block.sourceAlign === 'center') container.style.textAlign = 'center';
      }
      if (block.columns > 1) {
        container.style.display = 'grid';
        container.style.gridTemplateColumns = `repeat(${block.columns}, minmax(0, 1fr))`;
        if (block.columnWidths && /^[\d.fr\s]+$/.test(block.columnWidths)) container.style.gridTemplateColumns = block.columnWidths;
      }
      block.blocks.forEach(child => container.appendChild(renderBlock(document, child, preferences)));
      return container;
    }
    case 'control': {
      const container = el(document, 'div', 'visual-control');
      if (block.kind === 'action') {
        container.classList.add('visual-action'); container.textContent = block.text;
        return container;
      }
      const symbol = el(document, 'span', `visual-${block.kind}${block.checked ? ' is-checked' : ''}`);
      symbol.setAttribute('aria-hidden', 'true');
      if (block.kind === 'slider' || block.kind === 'progress') {
        symbol.style.setProperty('--position', `${block.percent}%`);
        container.classList.add('visual-meter');
      }
      const label = el(document, 'span');
      label.textContent = block.text.replace(/^\[[ x-]\]\s*/, '');
      container.append(symbol, label);
      return container;
    }
    case "paragraph": {
      const p = el(document, "p");
      p.appendChild(renderInlineNodes(document, block.children));
      return p;
    }
    case "heading": {
      const h = document.createElement(`h${block.level}`) as HTMLHeadingElement;
      h.appendChild(renderInlineNodes(document, block.children));
      return h;
    }
    case "ordered-list":
    case "unordered-list": return renderList(document, block, preferences);
    case "blockquote": {
      const quote = el(document, "blockquote");
      block.blocks.forEach((child) => quote.appendChild(renderBlock(document, child, preferences)));
      return quote;
    }
    case "table": return renderTable(document, block);
    case "horizontal-rule": return el(document, "hr");
    case "code": return renderCodeBlock(document, block, preferences);
    case "math": return renderMath(document, block);
    case "image": return renderImage(document, block);
  }
}

export function renderBlocks(document: Document, blocks: ContentBlock[], preferences: ExportPreferences): DocumentFragment {
  const fragment = document.createDocumentFragment();
  blocks.forEach((block) => fragment.appendChild(renderBlock(document, block, preferences)));
  return fragment;
}
