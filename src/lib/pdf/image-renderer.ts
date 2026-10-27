import type { ImageBlock } from "@/lib/conversation/content";
import { safeSourceUrl, supportedImageSource } from "@/lib/conversation/urls";
import { descendants, parseHtmlTree, tag } from "@/lib/extractors/html-tree";
import { serializeSafeSvg } from "@/lib/extractors/chatgpt-media";
import { el } from "./dom";

function safeImageUrl(source?: string): string | null {
  if (!source || !supportedImageSource(source)) return null;
  if (!/^data:image\/svg\+xml;charset=utf-8,/i.test(source)) return source;
  try {
    // Re-sanitize SVG even when model validation succeeds: an imported model
    // can bypass the HTML extractor that originally rebuilt safe media.
    const decoded = decodeURIComponent(source.slice(source.indexOf(",") + 1));
    const tree = parseHtmlTree(decoded);
    const svg = descendants(tree, (node) => tag(node) === "svg")[0];
    const sanitized = svg && serializeSafeSvg(svg);
    return sanitized ? "data:image/svg+xml;charset=utf-8," + encodeURIComponent(sanitized) : null;
  } catch {
    return null;
  }
}

export function renderImage(document: Document, block: ImageBlock): HTMLElement {
  const figure = el(document, "figure", "media-block");
  const placeholder = () => {
    const message = el(document, "div", "media-placeholder");
    message.textContent = block.alt ? `[Image unavailable: ${block.alt}]` : "[Image could not be included]";
    return message;
  };
  const safe = safeImageUrl(block.src);
  if (!safe) {
    figure.appendChild(placeholder());
  } else {
    const image = el(document, "img");
    image.src = safe;
    image.alt = block.alt ?? "Conversation image";
    image.loading = "eager";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    if (block.width && Number.isFinite(block.width)) image.style.width = `${block.width}px`;
    if (block.height && Number.isFinite(block.height)) image.style.maxHeight = `${block.height}px`;
    image.addEventListener("error", () => image.replaceWith(placeholder()), { once: true });
    figure.appendChild(image);
  }
  if (block.caption) {
    const caption = el(document, "figcaption");
    const href=block.captionHref&&safeSourceUrl(block.captionHref);
    if(href){
      const link=el(document,"a");link.href=href;link.rel="noreferrer noopener";link.textContent=block.caption;
      caption.appendChild(link);
    }else caption.textContent = block.caption;
    figure.appendChild(caption);
  }
  return figure;
}

/** Replace unsettled image elements before printing so no blank assets remain. */
export function markUnavailableImages(document: Document): number {
  for(const image of Array.from(document.querySelectorAll<HTMLImageElement>(".media-block img"))){
    if(image.complete&&image.naturalWidth>0)continue;
    const placeholder=el(document,"div","media-placeholder");
    placeholder.textContent=`[Image unavailable: ${image.alt||"Conversation image"}. The image did not finish loading.]`;
    image.replaceWith(placeholder);
  }
  return document.querySelectorAll(".media-placeholder").length;
}
