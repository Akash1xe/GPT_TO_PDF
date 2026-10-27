/** Pure URL safeguards used by typed import validation. No network requests. */
export function safeLinkHref(raw: string): string | null {
  if (!raw || raw.length > 4096 || /[\u0000-\u001f\u007f\\]/.test(raw)) return null;
  try {
    const url = new URL(raw, "https://chatgpt.com/");
    if (!["http:", "https:", "mailto:"].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function safeSourceUrl(raw: string): string | null {
  if (!raw || raw.length > 4096 || /[\u0000-\u001f\u007f\\]/.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function supportedImageSource(raw: string): boolean {
  if (!raw || raw.length > 8_000_000 || /[\u0000-\u001f\u007f]/.test(raw)) return false;
  if (/^blob:https?:\/\//i.test(raw)) return true; // Browser-session-bound; caller must warn.
  if (/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(raw)) return true;
  // SVG remains *untrusted*, including when accepted as a model field.
  // Must be sanitized in the renderer before it can enter any DOM.
  if (/^data:image\/svg\+xml;charset=utf-8,/i.test(raw)) return true;
  try {
    const url = new URL(raw);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password && url.href.length <= 4096;
  } catch {
    return false;
  }
}

export function safeCssColor(raw: string): boolean {
  return raw.length <= 160 &&
    /^(?:#[0-9a-f]{3,8}|(?:rgba?|hsla?|oklch|oklab|lch|lab|color)\([a-z0-9.,%\s/+\-]+\))$/i.test(raw);
}
