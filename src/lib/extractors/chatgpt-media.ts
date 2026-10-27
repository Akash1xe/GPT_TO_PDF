import type { ImageBlock, ImageSourceType } from "@/lib/conversation/content";
import { safeSourceUrl, supportedImageSource } from "@/lib/conversation/urls";
import { attr, children, descendants, ignored, parentOf, parseHtmlTree, tag, textOf, type HtmlNode } from "./html-tree";

/**
 * Portable adaptation of newGptTopdf/chatgptMedia.ts for static, user-supplied HTML.
 * No live canvas, computed styles, network reads or unsanitized SVG are involved.
 */
const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_ELEMENTS = new Set([
  "svg", "g", "defs", "title", "desc", "rect", "circle", "ellipse", "line", "polyline",
  "polygon", "path", "text", "tspan", "textpath", "lineargradient", "radialgradient",
  "stop", "clippath", "mask", "pattern", "marker", "symbol", "use",
]);
const SVG_ATTRS = new Set([
  "id", "class", "viewbox", "preserveaspectratio", "width", "height", "x", "y", "x1",
  "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry", "d", "points", "transform",
  "fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-dashoffset",
  "stroke-linecap", "stroke-linejoin", "stroke-opacity", "opacity", "font-size",
  "font-family", "font-weight", "text-anchor", "dominant-baseline", "letter-spacing",
  "color", "stop-color", "stop-opacity", "offset", "gradientunits", "gradienttransform",
  "spreadmethod", "patternunits", "patterncontentunits", "patterntransform",
  "markerwidth", "markerheight", "markerunits", "refx", "refy", "orient",
  "clippathunits", "maskunits", "maskcontentunits", "clip-path", "mask", "filter",
  "aria-label", "role",
]);
const SVG_STYLE = new Set([
  "fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-dashoffset",
  "stroke-linecap", "stroke-linejoin", "fill-opacity", "stroke-opacity", "opacity",
  "font-size", "font-family", "font-weight", "text-anchor", "color", "stop-color",
  "stop-opacity", "letter-spacing", "dominant-baseline",
]);
const LOCAL_FRAGMENT = /^url\(\s*["']?#([a-zA-Z_][\w:.-]{0,120})["']?\s*\)$/i;
const MAX_IMAGE_DATA_LENGTH = 7_800_000;
const MAX_SVG_LENGTH = 600_000;

export type MediaWarnings = { messages: string[] };

function sourceType(src?: string): ImageSourceType {
  if (!src) return "unknown";
  if (src.startsWith("data:")) return "data";
  if (src.startsWith("blob:")) return "blob";
  if (/^https?:/i.test(src)) return "remote";
  return "unknown";
}

function dimension(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const match = /^\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*$/i.exec(raw);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 && value <= 100_000 ? value : undefined;
}

function svgSize(node: HtmlNode): { width?: number; height?: number } {
  const width = dimension(attr(node, "width"));
  const height = dimension(attr(node, "height"));
  const viewBox = attr(node, "viewBox") ?? attr(node, "viewbox");
  const dims = viewBox?.trim().split(/[\s,]+/).map(Number);
  const vw = dims?.length === 4 && dims.every(Number.isFinite) && dims[2] > 0 ? dims[2] : undefined;
  const vh = dims?.length === 4 && dims.every(Number.isFinite) && dims[3] > 0 ? dims[3] : undefined;
  return { ...(width ?? vw ? { width: width ?? vw } : {}), ...(height ?? vh ? { height: height ?? vh } : {}) };
}

function safePaint(value: string): boolean {
  if (!value || value.length > 180 || /[<>;{}\\]/.test(value)) return false;
  if (LOCAL_FRAGMENT.test(value)) return true;
  if (/url\s*\(/i.test(value) || /(?:https?:|javascript:|data:|expression\s*\()/i.test(value)) return false;
  return /^[#\w\s.,%()+/-]+$/.test(value);
}

function safeSvgAttribute(name: string, value: string): boolean {
  if (!SVG_ATTRS.has(name) || value.length > 100_000 || /[<>\u0000-\u001f\u007f]/.test(value)) return false;
  if (["fill", "stroke", "color", "stop-color", "clip-path", "mask", "filter"].includes(name)) return safePaint(value);
  if (name === "d" || name === "points" || name === "transform" || name === "viewbox") {
    return value.length <= 100_000 && /^[a-z0-9.,%+\-eE\s()]*$/i.test(value);
  }
  if (["id", "class"].includes(name)) return /^[\w:.\- ]{1,160}$/.test(value);
  if (name === "font-family") return /^[\w\s'",.\-]{1,160}$/.test(value);
  if (name === "aria-label") return value.length <= 1000;
  if (name === "role") return /^[a-z-]{1,50}$/.test(value);
  return value.length <= 160 && /^[#\w\s.,%()+/\-]*$/.test(value);
}

function cssStyle(value: string): string {
  const sanitized: string[] = [];
  for (const declaration of value.split(";").slice(0, 40)) {
    const sep = declaration.indexOf(":");
    if (sep < 0) continue;
    const name = declaration.slice(0, sep).trim().toLowerCase();
    const part = declaration.slice(sep + 1).trim();
    if (!SVG_STYLE.has(name) || !safeSvgAttribute(name, part)) continue;
    sanitized.push(name + ":" + part);
  }
  return sanitized.join(";");
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/**
 * Rebuild SVG from a strict whitelist; no scripts, foreignObject, HTML, external
 * images, event handlers, external CSS, animation or outbound URLs survive.
 * Generated data URIs may be embedded by the later image renderer.
 */
export function serializeSafeSvg(node: HtmlNode): string | null {
  if (tag(node) !== "svg") return null;
  let total = 0;
  function write(current: HtmlNode, depth: number): string {
    if (depth > 35 || total > MAX_SVG_LENGTH) return "";
    if (current.nodeName === "#text" && "value" in current) {
      const content = escapeXml(current.value.slice(0, 50_000));
      total += content.length;
      return content;
    }
    const name = tag(current);
    if (!SVG_ELEMENTS.has(name)) return "";
    // SVG <use> only supports same-document fragment references; no external href.
    let attributes = name === "svg" ? ' xmlns="' + SVG_NS + '"' : "";
    if ("attrs" in current) {
      for (const item of current.attrs) {
        const key = item.name.toLowerCase();
        if ((key === "href" || key === "xlink:href") && name === "use"
          && /^#[a-zA-Z_][\w:.-]{0,120}$/.test(item.value)) {
          attributes += ' href="' + escapeXml(item.value) + '"';
        } else if (key === "style") {
          const safe = cssStyle(item.value);
          if (safe) attributes += ' style="' + escapeXml(safe) + '"';
        } else if (safeSvgAttribute(key, item.value)) {
          const canonical = key === "viewbox" ? "viewBox"
            : key === "preserveaspectratio" ? "preserveAspectRatio" : key;
          attributes += " " + canonical + '="' + escapeXml(item.value) + '"';
        }
      }
    }
    total += attributes.length + name.length * 2 + 5;
    const nested = children(current).map((child) => write(child, depth + 1)).join("");
    return "<" + name + attributes + ">" + nested + "</" + name + ">";
  }
  const serialized = write(node, 0);
  return serialized && serialized.length <= MAX_SVG_LENGTH ? serialized : null;
}

function imageSource(raw: string | undefined, warnings: MediaWarnings): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;
  if (value.length > MAX_IMAGE_DATA_LENGTH) {
    warnings.messages.push("An image source was too large and was replaced by a placeholder.");
    return undefined;
  }
  if (/^data:image\/svg\+xml;charset=utf-8,/i.test(value)) {
    try {
      const decoded = decodeURIComponent(value.slice(value.indexOf(",") + 1));
      const tree = parseHtmlTree(decoded);
      const svg = descendants(tree, (item) => tag(item) === "svg")[0];
      const clean = svg && serializeSafeSvg(svg);
      if (clean) return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(clean);
    } catch { /* Invalid SVG must not be used as input for an image tag. */ }
    warnings.messages.push("Embedded SVG image could not be safely sanitized.");
    return undefined;
  }
  if (/^data:/i.test(value) || /^blob:/i.test(value)) {
    if (supportedImageSource(value)) {
      if (/^blob:/i.test(value)) warnings.messages.push("A blob image URL may be unavailable outside its original browser session.");
      return value;
    }
    warnings.messages.push("An unsupported embedded image source was replaced by a placeholder.");
    return undefined;
  }
  // A static HTML snapshot cannot resolve currentSrc; prefer explicit src.
  const url = /^\/\//.test(value) ? safeSourceUrl("https:" + value)
    : safeSourceUrl(value) ?? (/^(?:\/(?!\/)|\.\/)/.test(value) ? safeSourceUrl(new URL(value, "https://chatgpt.com/").href) : null);
  if (url) {
    warnings.messages.push("Remote image URLs are preserved without downloading them; image availability and permissions must be checked when exporting.");
    return url;
  }
  warnings.messages.push("Unsafe or unsupported image URL was replaced by a placeholder.");
  return undefined;
}

function srcsetChoice(node: HtmlNode): string | undefined {
  const direct = attr(node, "srcset") ?? attr(node, "data-srcset");
  const picture = parentOf(node);
  const candidate = direct ?? (picture && tag(picture) === "picture"
    ? children(picture).filter((child) => tag(child) === "source")
      .map((child) => attr(child, "srcset") ?? "").find(Boolean) : undefined);
  if (!candidate) return undefined;
  const list = candidate.split(",").map((entry) => entry.trim().split(/\s+/)).filter((parts) => parts[0]);
  return list.filter((parts) => !parts[0].startsWith("data:"))
    .sort((a,b) => (Number.parseInt(b[1] ?? "0") || 0) - (Number.parseInt(a[1] ?? "0") || 0))[0]?.[0];
}

function imageDimensions(node: HtmlNode): { width?: number; height?: number } {
  const style = attr(node, "style") ?? "";
  const cssNumber = (name: "width" | "height") =>
    dimension(new RegExp("(?:^|;)\\s*" + name + "\\s*:\\s*(\\d+(?:\\.\\d+)?px)(?=;|$)", "i").exec(style)?.[1]);
  const width = dimension(attr(node, "width")) ?? cssNumber("width");
  const height = dimension(attr(node, "height")) ?? cssNumber("height");
  return {
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  };
}

function accessibleText(node: HtmlNode, fallback: string): string {
  return (attr(node, "aria-label") ?? attr(node, "alt") ?? attr(node, "title") ?? fallback)
    .replace(/\s+/g, " ").trim().slice(0, 10_000) || fallback;
}

export function isMediaElement(node: HtmlNode): boolean {
  return ["img", "svg", "canvas"].includes(tag(node)) && !ignored(node);
}

export function containsMedia(node: HtmlNode): boolean {
  if (ignored(node)) return false;
  return isMediaElement(node) || children(node).some(containsMedia);
}

export function extractMediaBlock(node: HtmlNode, warnings: MediaWarnings): ImageBlock | null {
  if (!isMediaElement(node)) return null;
  const name = tag(node);
  const dims = name === "svg" ? svgSize(node) : imageDimensions(node);
  const width = dims.width;
  const height = dims.height;

  if (name === "img") {
    const alt = accessibleText(node, "Conversation image");
    if (width && height && width <= 40 && height <= 40) return null;
    if (/^(avatar|logo|icon)(?:\s|$)/i.test(alt) && Math.max(width ?? 0, height ?? 0) <= 96) return null;
    const raw = attr(node, "src") || attr(node, "data-src") || srcsetChoice(node);
    const src = imageSource(raw, warnings);
    if (!src) warnings.messages.push("An image could not be recovered from the provided HTML; an accessible placeholder was retained.");
    const caption = attr(node, "data-caption")?.slice(0, 10_000);
    return {
      type: "image", mediaKind: "image", sourceType: sourceType(src),
      ...(src ? { src } : {}), alt,
      ...(caption ? { caption } : {}), ...dims,
    };
  }

  if (name === "svg") {
    if (width && height && width <= 40 && height <= 40) return null;
    const clean = serializeSafeSvg(node);
    const alt = accessibleText(node, "Diagram");
    const labels = textOf(node).replace(/\s+/g, " ").trim().slice(0, 500);
    const accessible = labels && alt === "Diagram" ? "Diagram: " + labels : alt;
    if (!clean) warnings.messages.push("An SVG diagram could not be serialized safely; a descriptive placeholder was retained.");
    else warnings.messages.push("An SVG diagram was extracted from static attributes; CSS-only or computed styles may not be available.");
    return {
      type: "image", mediaKind: "svg", sourceType: clean ? "data" : "unknown",
      ...(clean ? { src: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(clean) } : {}),
      alt: accessible, ...dims,
    };
  }

  // Canvas pixels are NOT stored in static HTML. Accept only explicit, user-
  // supplied encoded raster snapshots, never pretend to call canvas.toDataURL.
  if (width && height && width <= 40 && height <= 40) return null;
  const alt = accessibleText(node, "Canvas diagram");
  const raw = attr(node, "data-canvas-png") ?? attr(node, "data-canvas-data-url");
  let src: string | undefined;
  if (raw?.startsWith("data:image/png;base64,")) src = imageSource(raw, warnings);
  else if (raw) warnings.messages.push("Canvas snapshot must be an explicit PNG data URL.");
  if (!src) warnings.messages.push("Canvas pixels cannot be recovered from saved HTML. A labeled placeholder is retained; use the original extension or provide a PNG snapshot.");
  return {
    type: "image", mediaKind: "canvas", sourceType: sourceType(src),
    ...(src ? { src } : {}), alt, ...dims,
  };
}
