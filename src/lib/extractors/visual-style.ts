import { attr, children, isElement, parentOf, tag, type HtmlNode } from "./html-tree";
import { safeCssColor } from "@/lib/conversation/urls";

/** Read only explicit CSS declarations, never mount or execute source styles. */
export function styleDeclarations(node: HtmlNode): ReadonlyMap<string, string> {
  const output = new Map<string, string>();
  const source = attr(node, "style") ?? "";
  if (source.length > 8_000) return output;
  for (const fragment of source.split(";").slice(0, 80)) {
    const separator = fragment.indexOf(":");
    if (separator <= 0) continue;
    const property = fragment.slice(0, separator).trim().toLowerCase();
    const value = fragment.slice(separator + 1).trim();
    if (/^[a-z-]{1,60}$/.test(property) && value.length <= 300) output.set(property, value);
  }
  return output;
}

export function colorValue(value: string | undefined): string | undefined {
  if (!value || !safeCssColor(value) || /(?:^transparent$|^rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$)/i.test(value)) return undefined;
  return value;
}

function borderColor(value: string | undefined): string | undefined {
  if (!value || value.length > 200) return undefined;
  // Border shorthand may contain rgb(12, 34, 56) with spaces, so splitting
  // at whitespace destroys the actual color. Extract one safe color token.
  const token = value.match(/(?:rgba?|hsla?|oklch|oklab|lch|lab|color)\([^)]{1,130}\)|#[0-9a-f]{3,8}\b/i)?.[0];
  return colorValue(token);
}

function visibleChildren(node: HtmlNode): HtmlNode[] {
  return children(node).filter(isElement).filter((child) => !["script", "style", "template"].includes(tag(child)));
}

function gridTracks(source: string): string[] {
  // We intentionally accept only simple fr tracks for safe export. Complex
  // minmax(), calc(), CSS variables and responsive styles remain unresolved.
  return source.trim().split(/\s+/).filter(Boolean);
}

function extractGrid(node: HtmlNode, declaration: ReadonlyMap<string, string>): { columns: number; widths?: string } {
  const css = declaration.get("grid-template-columns") ?? "";
  const repeated = /^repeat\(\s*([1-4])\s*,\s*(?:(?:minmax\(\s*0\s*,\s*)?(\d+(?:\.\d+)?fr)\s*\)?)\s*\)$/i.exec(css);
  if (repeated) {
    const n = Number(repeated[1]), value = repeated[2];
    return { columns: n, widths: Array(n).fill(value).join(" ") };
  }
  const tracks = gridTracks(css);
  if (tracks.length >= 2 && tracks.length <= 4 && tracks.every((part) => /^\d+(?:\.\d+)?fr$/.test(part))) {
    return { columns: tracks.length, widths: tracks.join(" ") };
  }
  const classes = (attr(node, "class") ?? "").split(/\s+/);
  const explicit = classes.find((name) => /^grid-cols-[2-4]$/.test(name));
  if (explicit) return { columns: Number(explicit.slice(-1)) };
  return { columns: 1 };
}

function numericPixelWidth(node: HtmlNode): number | null {
  const value = styleDeclarations(node).get("width") || attr(node, "width");
  const match = value?.match(/^(\d+(?:\.\d+)?)(?:px)?$/);
  const width = match ? Number(match[1]) : NaN;
  return Number.isFinite(width) && width > 0 && width <= 100_000 ? width : null;
}

export type VisualLayout = {
  columns: number;
  card: boolean;
  darkOnly?: boolean;
  columnWidths?: string;
  sourceAlign?: "left" | "center" | "right";
  sourceBackground?: string;
  sourceBorder?: string;
};

/**
 * Port of newGptTopdf/layoutInfo, restricted to available HTML evidence.
 * We do not pretend to have getComputedStyle or getBoundingClientRect.
 */
export function layoutInfo(node: HtmlNode): VisualLayout | null {
  if (!["div", "section", "article", "fieldset", "label"].includes(tag(node))) return null;
  const styles = styleDeclarations(node);
  const classes = (attr(node, "class") ?? "").split(/\s+/);
  const display = styles.get("display")?.toLowerCase() ?? "";
  const isGrid = display === "grid" || classes.includes("grid");
  const isFlex = display === "flex" || classes.includes("flex");
  const direction = styles.get("flex-direction") || (classes.includes("flex-col") ? "column" : "row");
  const grid = isGrid ? extractGrid(node, styles) : { columns: 1, widths: undefined };
  const visible = visibleChildren(node);
  let columns = grid.columns;
  if (isFlex && direction !== "column" && direction !== "column-reverse" && visible.length >= 2) {
    columns = Math.min(4, visible.length);
  }
  const border = borderColor(styles.get("border-color") ?? styles.get("border-top-color"))
    ?? borderColor(styles.get("border") ?? styles.get("border-top"));
  const borderWidth = styles.get("border-width") ?? styles.get("border-top-width") ?? "";
  const hasBorder = Boolean(border) || /^\d+(?:\.\d+)?px$/.test(borderWidth) && Number.parseFloat(borderWidth) > 0
    || classes.some((name) => name === "border" || /^border-[0-9]+$/.test(name));
  const background = colorValue(styles.get("background-color"))
    ?? colorValue(styles.get("background"));
  const align = styles.get("text-align");
  const sourceAlign = align === "center" || align === "right" || align === "left" ? align : undefined;
  if (!hasBorder && !background && columns <= 1 && sourceAlign === undefined) return null;
  const widths = columns > 1 && isFlex && visible.length === columns
    ? visible.map(numericPixelWidth) : [];
  const columnWidths = grid.widths || (widths.length === columns && widths.every((n): n is number => n !== null)
    ? widths.map((n) => n + "fr").join(" ") : undefined);
  return {
    columns, card: hasBorder,
    darkOnly: !hasBorder && columns === 1,
    ...(columnWidths ? { columnWidths } : {}),
    ...(sourceAlign ? { sourceAlign } : {}),
    ...(background ? { sourceBackground: background } : {}),
    ...(border ? { sourceBorder: border } : {}),
  };
}


/** Available inline color and enclosing surface, with no computed CSS access. */
export function explicitTextAppearance(textNode: HtmlNode): { sourceColor?: string; sourceSurface?: string } {
  let node = parentOf(textNode);
  let color: string | undefined, surface: string | undefined;
  while (node) {
    const css = styleDeclarations(node);
    color ??= colorValue(css.get("color"));
    surface ??= colorValue(css.get("background-color")) ?? colorValue(css.get("background"));
    if (tag(node) === "body") break;
    node = parentOf(node);
  }
  return {
    ...(color ? { sourceColor: color } : {}),
    ...(surface ? { sourceSurface: surface } : {}),
  };
}
