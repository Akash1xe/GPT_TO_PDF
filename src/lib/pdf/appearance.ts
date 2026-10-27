import { DEFAULT_EXPORT_PREFERENCES, type BodyFontFamily, type ExportPreferences, type SpacingPreset, type TextWeight } from "@/lib/conversation/preferences";

export interface ResolvedTextWeights {
  body: string;
  bold: string;
  heading: string;
  title: string;
  tableHeader: string;
  role: string;
  meta: string;
  codeLabel: string;
}

export interface ResolvedPdfAppearance {
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  messagePadding: string;
  messageSpacing: string;
  paragraphSpacing: string;
  lineHeight: string;
  bodyFontFamily: string;
  bodyFontSize: string;
  bodyFontWeight: string;
  boldFontWeight: string;
  headingFontWeight: string;
  titleFontWeight: string;
  tableHeaderFontWeight: string;
  roleFontWeight: string;
  metaFontWeight: string;
  codeLabelFontWeight: string;
  codeFontSize: string;
}

const FONT_STACKS: Record<BodyFontFamily, string> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  arial: 'Arial, Helvetica, sans-serif',
  georgia: 'Georgia, "Times New Roman", serif',
  times: '"Times New Roman", Times, serif',
  verdana: 'Verdana, Geneva, sans-serif',
  tahoma: 'Tahoma, Arial, sans-serif',
  trebuchet: '"Trebuchet MS", Arial, sans-serif'
};

const STANDARD_BASE_WEIGHT = 400;
const MIN_FONT_WEIGHT = 100;
const MAX_FONT_WEIGHT = 900;
const MIN_CUSTOM_TEXT_WEIGHT = 100;
const MAX_CUSTOM_TEXT_WEIGHT = 800;

const TEXT_WEIGHT_BASELINES: Record<Exclude<TextWeight, "custom">, number> = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800
};

const SEMANTIC_WEIGHTS = {
  body: 400,
  bold: 700,
  heading: 700,
  title: 700,
  tableHeader: 700,
  role: 750,
  meta: 400,
  codeLabel: 600
} as const;

const MESSAGE_PADDING: Record<SpacingPreset, string> = {
  compact: "4px",
  normal: "9px",
  spacious: "15px"
};

const MESSAGE_SPACING: Record<SpacingPreset, string> = {
  compact: "10px",
  normal: "20px",
  spacious: "30px"
};

const PARAGRAPH_SPACING: Record<SpacingPreset, string> = {
  compact: "0.35em",
  normal: "0.65em",
  spacious: "1em"
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function spacingValue<T extends string>(value: unknown, map: Record<T, string>, fallback: T): string {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(map, value) ? map[value as T] : map[fallback];
}

function fontStack(value: unknown): string {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(FONT_STACKS, value)
    ? FONT_STACKS[value as BodyFontFamily]
    : FONT_STACKS.system;
}

function clampFontWeight(value: number): number {
  return Math.min(MAX_FONT_WEIGHT, Math.max(MIN_FONT_WEIGHT, value));
}

function resolveBaseTextWeight(weight: unknown, customTextWeight: unknown): number {
  if (weight === "custom") {
    return clampNumber(customTextWeight, MIN_CUSTOM_TEXT_WEIGHT, MAX_CUSTOM_TEXT_WEIGHT, STANDARD_BASE_WEIGHT);
  }
  if (typeof weight === "string" && Object.prototype.hasOwnProperty.call(TEXT_WEIGHT_BASELINES, weight)) {
    return TEXT_WEIGHT_BASELINES[weight as Exclude<TextWeight, "custom">];
  }
  return STANDARD_BASE_WEIGHT;
}

function shiftedWeight(canonicalWeight: number, delta: number): string {
  return String(clampFontWeight(canonicalWeight + delta));
}

function resolveTextWeights(weight: unknown, customTextWeight: unknown): ResolvedTextWeights {
  const selectedBaseWeight = resolveBaseTextWeight(weight, customTextWeight);
  const delta = selectedBaseWeight - STANDARD_BASE_WEIGHT;
  return {
    body: shiftedWeight(SEMANTIC_WEIGHTS.body, delta),
    bold: shiftedWeight(SEMANTIC_WEIGHTS.bold, delta),
    heading: shiftedWeight(SEMANTIC_WEIGHTS.heading, delta),
    title: shiftedWeight(SEMANTIC_WEIGHTS.title, delta),
    tableHeader: shiftedWeight(SEMANTIC_WEIGHTS.tableHeader, delta),
    role: shiftedWeight(SEMANTIC_WEIGHTS.role, delta),
    meta: shiftedWeight(SEMANTIC_WEIGHTS.meta, delta),
    codeLabel: shiftedWeight(SEMANTIC_WEIGHTS.codeLabel, delta)
  };
}

function margins(preferences: ExportPreferences): [number, number, number, number] {
  if (preferences.marginPreset === "compact") return [8, 10, 8, 10];
  if (preferences.marginPreset === "wide") return [22, 24, 22, 24];
  if (preferences.marginPreset === "custom") {
    const fallback = DEFAULT_EXPORT_PREFERENCES.customMargins;
    const value = preferences.customMargins ?? fallback;
    return [
      clampNumber(value.top, 5, 40, fallback.top),
      clampNumber(value.right, 5, 40, fallback.right),
      clampNumber(value.bottom, 5, 40, fallback.bottom),
      clampNumber(value.left, 5, 40, fallback.left)
    ];
  }
  return [15, 15, 15, 15];
}

export function resolvePdfAppearance(preferences: ExportPreferences): ResolvedPdfAppearance {
  const [top, right, bottom, left] = margins(preferences);
  const lineHeight = preferences.lineSpacing === "compact" ? "1.35" : preferences.lineSpacing === "relaxed" ? "1.7" : "1.5";
  const weights = resolveTextWeights(preferences.textWeight, preferences.customTextWeight);
  return {
    marginTop: `${top}mm`,
    marginRight: `${right}mm`,
    marginBottom: `${bottom}mm`,
    marginLeft: `${left}mm`,
    messagePadding: spacingValue(preferences.messagePadding, MESSAGE_PADDING, "normal"),
    messageSpacing: spacingValue(preferences.messageSpacing, MESSAGE_SPACING, "normal"),
    paragraphSpacing: spacingValue(preferences.paragraphSpacing, PARAGRAPH_SPACING, "normal"),
    lineHeight,
    bodyFontFamily: fontStack(preferences.bodyFontFamily),
    bodyFontSize: `${clampNumber(preferences.bodyFontSize, 8, 18, DEFAULT_EXPORT_PREFERENCES.bodyFontSize)}pt`,
    bodyFontWeight: weights.body,
    boldFontWeight: weights.bold,
    headingFontWeight: weights.heading,
    titleFontWeight: weights.title,
    tableHeaderFontWeight: weights.tableHeader,
    roleFontWeight: weights.role,
    metaFontWeight: weights.meta,
    codeLabelFontWeight: weights.codeLabel,
    codeFontSize: `${clampNumber(preferences.codeFontSize, 8, 16, DEFAULT_EXPORT_PREFERENCES.codeFontSize)}pt`
  };
}

export function getBodyFontStack(font: BodyFontFamily): string {
  return FONT_STACKS[font];
}

export function getTextWeightValues(weight: TextWeight, customTextWeight = STANDARD_BASE_WEIGHT): ResolvedTextWeights {
  return resolveTextWeights(weight, customTextWeight);
}
