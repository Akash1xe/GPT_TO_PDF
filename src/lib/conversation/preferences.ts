/**
 * Ported from the owner's Akash1xe/newGptTopdf extension.
 * The structural shape is intentionally compatible with its normalized JSON model.
 * Do not add browser-extension or DOM dependencies to these types.
 */
export type PdfTheme = "light" | "dark";
export type PageSize = "A4" | "Letter";
export type MessageFilter = "all" | "user" | "assistant";
export type MarginPreset = "compact" | "normal" | "wide" | "custom";
export type SpacingPreset = "compact" | "normal" | "spacious";
export type LineSpacingPreset = "compact" | "normal" | "relaxed";
export type BodyFontFamily = "system" | "arial" | "georgia" | "times" | "verdana" | "tahoma" | "trebuchet";
export type TextWeight = "light" | "regular" | "medium" | "semibold" | "bold" | "extrabold" | "custom";
export type CodeTheme = "light" | "dark";

export interface CustomMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ExportPreferences {
  pdfTheme: PdfTheme;
  pageSize: PageSize;
  messageFilter: MessageFilter;
  /** Convenience preference for exporting only ChatGPT responses. */
  excludeUserMessages: boolean;
  includeTitle: boolean;
  includeExportDate: boolean;
  includeSourceUrl: boolean;
  codeTheme: CodeTheme;
  wrapCode: boolean;
  showCodeLanguage: boolean;
  marginPreset: MarginPreset;
  customMargins: CustomMargins;
  messagePadding: SpacingPreset;
  messageSpacing: SpacingPreset;
  paragraphSpacing: SpacingPreset;
  lineSpacing: LineSpacingPreset;
  bodyFontFamily: BodyFontFamily;
  bodyFontSize: number;
  textWeight: TextWeight;
  customTextWeight: number;
  codeFontSize: number;
}

/**
 * Print-oriented defaults tuned for a dense technical document rather than a
 * screenshot-like web layout. Users can still override every value in the UI.
 */
export const DEFAULT_EXPORT_PREFERENCES: ExportPreferences = {
  pdfTheme: "light",
  pageSize: "A4",
  messageFilter: "all",
  excludeUserMessages: false,
  includeTitle: true,
  includeExportDate: true,
  includeSourceUrl: false,
  codeTheme: "light",
  wrapCode: true,
  showCodeLanguage: true,
  marginPreset: "compact",
  customMargins: { top: 11, right: 11, bottom: 11, left: 11 },
  messagePadding: "compact",
  messageSpacing: "compact",
  paragraphSpacing: "compact",
  lineSpacing: "compact",
  bodyFontFamily: "system",
  bodyFontSize: 8,
  textWeight: "regular",
  customTextWeight: 400,
  codeFontSize: 8
};
