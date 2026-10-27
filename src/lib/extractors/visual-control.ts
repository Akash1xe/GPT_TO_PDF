import type { ContentBlock } from "@/lib/conversation/content";
import { attr, children, descendants, ignored, parentOf, tag, textOf, type HtmlNode } from "./html-tree";
import { styleDeclarations } from "./visual-style";

export type ControlBlock = Extract<ContentBlock, { type: "control" }>;
const SAFE_ACTION = /^(?:open pdf|check answer|submit|review|download)(?:\s|$)/i;
const ALLOWED_ROLES = new Set(["checkbox", "radio", "switch", "slider", "progressbar"]);
const CONTROL_TAGS = new Set(["input", "progress", "button", "label"]);
const CONTROL_TYPES = new Set(["checkbox", "radio", "range"]);

function clipped(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
}
function numeric(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function percentage(raw: number, min: number, max: number): number {
  if (!(max > min)) return 0;
  return Math.round(Math.max(0, Math.min(100, (100 * (raw - min)) / (max - min))) * 100) / 100;
}

function controlOwnText(node: HtmlNode): string {
  // Root <button> and role="button" are purposely ignored by general prose
  // parsing. Read child text only after positive action allowlisting.
  return clipped(children(node).map(textOf).join(""));
}
function inputType(node: HtmlNode): string {
  return (attr(node, "type") ?? "").toLowerCase();
}

export function isVisualControl(node: HtmlNode): boolean {
  const name = tag(node);
  const role = (attr(node, "role") ?? "").toLowerCase();
  if (name === "input") return CONTROL_TYPES.has(inputType(node));
  if (name === "progress" || ALLOWED_ROLES.has(role)) return true;
  if (name === "button" || role === "button") return SAFE_ACTION.test(controlOwnText(node));
  if (name === "label") {
    return descendants(node, (candidate) => tag(candidate) === "input"
      && ["checkbox", "radio"].includes(inputType(candidate))).length === 1;
  }
  // CSS-only bars are recognized only with explicit background, height and
  // a single empty child with a percentage width. Never infer from generic divs.
  if (["div", "span"].includes(name) && !clipped(textOf(node)) && children(node).length === 1) {
    const track = styleDeclarations(node);
    const height = track.get("height");
    const bg = track.get("background-color") ?? track.get("background");
    const fill = styleDeclarations(children(node)[0]);
    const width = fill.get("width") ?? "";
    return Boolean(bg && /^\d+(?:\.\d+)?px$/.test(height ?? "")
      && numeric(height?.replace("px", ""), 99) <= 24
      && /^\d+(?:\.\d+)?%$/.test(width) && numeric(width.replace("%", ""), -1) <= 100);
  }
  return false;
}

function closestLabel(input: HtmlNode): string {
  let node: HtmlNode | null = parentOf(input);
  while (node) {
    if (tag(node) === "label") {
      const labelText = clipped(textOf(node));
      if (labelText) return labelText;
    }
    if (["article", "section", "body"].includes(tag(node))) break;
    node = parentOf(node);
  }
  return clipped(attr(input, "aria-label") ?? attr(input, "name"));
}

function choiceControl(node: HtmlNode, kind: "radio" | "checkbox", label?: string): ControlBlock {
  const state = attr(node, "checked") !== undefined || attr(node, "aria-checked") === "true";
  const text = clipped(label ?? closestLabel(node));
  return {
    type: "control", kind, checked: state, percent: 0,
    text: (state ? "[x] " : "[ ] ") + text,
  };
}

/**
 * Represent static state without reading input.value of passwords, text fields,
 * private form fields, hidden inputs, or executing user actions.
 */
export function visualControl(node: HtmlNode): ControlBlock | null {
  if (!isVisualControl(node)) return null;
  const name = tag(node);
  const role = (attr(node, "role") ?? "").toLowerCase();
  if (name === "label") {
    const choices = descendants(node, (item) => tag(item) === "input"
      && ["checkbox", "radio"].includes(inputType(item)));
    if (choices.length === 1) return choiceControl(choices[0], inputType(choices[0]) as "radio" | "checkbox", textOf(node));
  }
  const type = name === "input" ? inputType(node) : role;
  if (type === "checkbox" || type === "radio" || type === "switch") {
    const kind = type === "radio" ? "radio" : "checkbox";
    if (name === "input") return choiceControl(node, kind);
    const state = attr(node, "aria-checked") === "true";
    const label = clipped(attr(node, "aria-label") || textOf(node));
    return { type: "control", kind, checked: state, percent: 0, text: (state ? "[x] " : "[ ] ") + label };
  }
  if (name === "progress" || type === "progressbar" || type === "range" || type === "slider") {
    const kind = type === "range" || type === "slider" ? "slider" : "progress";
    const min = numeric(attr(node, "min") ?? attr(node, "aria-valuemin"), 0);
    const max = numeric(attr(node, "max") ?? attr(node, "aria-valuemax"), 100);
    const value = numeric(attr(node, "value") ?? attr(node, "aria-valuenow"), min);
    const percent = percentage(value, min, max);
    const label = clipped(attr(node, "aria-label")) || (kind === "progress" ? "Progress" : "Slider");
    const valueText = clipped(attr(node, "aria-valuetext")) || String(value);
    return { type: "control", kind, checked: false, percent, text: label + ": " + valueText };
  }
  if (["button", "span", "div"].includes(name) && SAFE_ACTION.test(controlOwnText(node))) {
    return { type: "control", kind: "action", text: controlOwnText(node), checked: false, percent: 0 };
  }
  const fill = children(node)[0];
  const width = fill ? styleDeclarations(fill).get("width") ?? "0%" : "0%";
  const percent = numeric(width.replace("%", ""), 0);
  return { type: "control", kind: "progress", checked: false, percent, text: "Progress: " + percent + "%" };
}

export function hasVisualControls(node: HtmlNode): boolean {
  if (ignored(node) && !isVisualControl(node)) return false;
  return isVisualControl(node) || children(node).some(hasVisualControls);
}

export function isDirectControlElement(node: HtmlNode): boolean {
  return CONTROL_TAGS.has(tag(node)) || ALLOWED_ROLES.has((attr(node, "role") ?? "").toLowerCase())
    || isVisualControl(node);
}
