import type { TableBlock } from "@/lib/conversation/content";
import { renderInlineNodes } from "./inline-renderer";
import { el } from "./dom";

export function renderTable(document: Document, block: TableBlock): HTMLElement {
  const shell = el(document, "div", "table-shell");
  const table = el(document, "table");
  const firstIsHeader = Boolean(block.rows[0]?.cells.length) && block.rows[0].cells.every((cell) => cell.header);
  const head = firstIsHeader ? el(document, "thead") : null;
  const body = el(document, "tbody");

  block.rows.forEach((row, rowIndex) => {
    const tr = el(document, "tr");
    row.cells.forEach((cell) => {
      const td = el(document, cell.header ? "th" : "td");
      if (cell.colspan > 1) td.setAttribute("colspan", String(cell.colspan));
      if (cell.rowspan > 1) td.setAttribute("rowspan", String(cell.rowspan));
      td.appendChild(renderInlineNodes(document, cell.children));
      tr.appendChild(td);
    });
    if (head && rowIndex === 0) head.appendChild(tr); else body.appendChild(tr);
  });
  if (head) table.appendChild(head);
  table.appendChild(body);
  shell.appendChild(table);
  return shell;
}
