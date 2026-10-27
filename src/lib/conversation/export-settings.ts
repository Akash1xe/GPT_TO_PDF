import {
  DEFAULT_EXPORT_PREFERENCES,
  type ExportPreferences,
} from "./preferences";
import type { ConversationData } from "./conversation";
import { buildConversationStats } from "./stats";

export interface PreferencesResult {
  data: ExportPreferences;
  warnings: string[];
}

const DEFAULTS = DEFAULT_EXPORT_PREFERENCES;
const THEME = ["light", "dark"] as const;
const PAGE = ["A4", "Letter"] as const;
const MESSAGE = ["all", "user", "assistant"] as const;
const MARGINS = ["compact", "normal", "wide", "custom"] as const;
const SPACING = ["compact", "normal", "spacious"] as const;
const LINE_SPACING = ["compact", "normal", "relaxed"] as const;
const FONT = ["system", "arial", "georgia", "times", "verdana", "tahoma", "trebuchet"] as const;
const WEIGHT = ["light", "regular", "medium", "semibold", "bold", "extrabold", "custom"] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/** Read untrusted settings as safe, browser-independent PDF preferences. */
export function normalizeExportPreferences(input: unknown): PreferencesResult {
  const v = asRecord(input);
  const warnings: string[] = [];
  const fallback = <T>(field: string, raw: unknown, defaultValue: T, accept: (raw: unknown) => raw is T): T => {
    if (raw === undefined) return defaultValue;
    if (accept(raw)) return raw;
    warnings.push(`${field}: unsupported value replaced with default.`);
    return defaultValue;
  };
  const enumeration = <T extends string>(items: readonly T[]) => (raw: unknown): raw is T =>
    typeof raw === "string" && items.includes(raw as T);
  const bool = (raw: unknown): raw is boolean => typeof raw === "boolean";
  const bounded = (field: string, raw: unknown, defaultValue: number, min: number, max: number): number => {
    if (raw === undefined) return defaultValue;
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      warnings.push(`${field}: unsupported value replaced with default.`);
      return defaultValue;
    }
    const safe = Math.max(min, Math.min(max, raw));
    if (safe !== raw) warnings.push(`${field}: value clamped to permitted range.`);
    return safe;
  };
  const margins = asRecord(v.customMargins);
  return {
    data: {
      pdfTheme: fallback("pdfTheme", v.pdfTheme, DEFAULTS.pdfTheme, enumeration(THEME)),
      pageSize: fallback("pageSize", v.pageSize, DEFAULTS.pageSize, enumeration(PAGE)),
      messageFilter: fallback("messageFilter", v.messageFilter, DEFAULTS.messageFilter, enumeration(MESSAGE)),
      excludeUserMessages: fallback("excludeUserMessages", v.excludeUserMessages, DEFAULTS.excludeUserMessages, bool),
      includeTitle: fallback("includeTitle", v.includeTitle, DEFAULTS.includeTitle, bool),
      includeExportDate: fallback("includeExportDate", v.includeExportDate, DEFAULTS.includeExportDate, bool),
      includeSourceUrl: fallback("includeSourceUrl", v.includeSourceUrl, DEFAULTS.includeSourceUrl, bool),
      codeTheme: fallback("codeTheme", v.codeTheme, DEFAULTS.codeTheme, enumeration(THEME)),
      wrapCode: fallback("wrapCode", v.wrapCode, DEFAULTS.wrapCode, bool),
      showCodeLanguage: fallback("showCodeLanguage", v.showCodeLanguage, DEFAULTS.showCodeLanguage, bool),
      marginPreset: fallback("marginPreset", v.marginPreset, DEFAULTS.marginPreset, enumeration(MARGINS)),
      customMargins: {
        top: bounded("customMargins.top", margins.top, DEFAULTS.customMargins.top, 5, 40),
        right: bounded("customMargins.right", margins.right, DEFAULTS.customMargins.right, 5, 40),
        bottom: bounded("customMargins.bottom", margins.bottom, DEFAULTS.customMargins.bottom, 5, 40),
        left: bounded("customMargins.left", margins.left, DEFAULTS.customMargins.left, 5, 40),
      },
      messagePadding: fallback("messagePadding", v.messagePadding, DEFAULTS.messagePadding, enumeration(SPACING)),
      messageSpacing: fallback("messageSpacing", v.messageSpacing, DEFAULTS.messageSpacing, enumeration(SPACING)),
      paragraphSpacing: fallback("paragraphSpacing", v.paragraphSpacing, DEFAULTS.paragraphSpacing, enumeration(SPACING)),
      lineSpacing: fallback("lineSpacing", v.lineSpacing, DEFAULTS.lineSpacing, enumeration(LINE_SPACING)),
      bodyFontFamily: fallback("bodyFontFamily", v.bodyFontFamily, DEFAULTS.bodyFontFamily, enumeration(FONT)),
      bodyFontSize: bounded("bodyFontSize", v.bodyFontSize, DEFAULTS.bodyFontSize, 8, 18),
      textWeight: fallback("textWeight", v.textWeight, DEFAULTS.textWeight, enumeration(WEIGHT)),
      customTextWeight: bounded("customTextWeight", v.customTextWeight, DEFAULTS.customTextWeight, 100, 800),
      codeFontSize: bounded("codeFontSize", v.codeFontSize, DEFAULTS.codeFontSize, 8, 16),
    },
    warnings,
  };
}

/** Pure port of the extension's message filtering, without Chrome APIs. */
export function filterConversationForExport(
  conversation: ConversationData,
  preferences: ExportPreferences,
): ConversationData {
  const effectiveFilter = preferences.excludeUserMessages ? "assistant" : preferences.messageFilter;
  const messages = conversation.messages
    .filter((message) => effectiveFilter === "all" || message.role === effectiveFilter)
    .map((message, order) => ({ ...message, order }));
  return { ...conversation, messages, messageCount: messages.length, stats: buildConversationStats(messages) };
}
