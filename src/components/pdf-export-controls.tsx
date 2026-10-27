"use client";

import { useState } from "react";
import type { ConversationData } from "@/lib/conversation/conversation";
import { DEFAULT_EXPORT_PREFERENCES, type ExportPreferences } from "@/lib/conversation/preferences";
import { openPrintPreview } from "@/lib/pdf/print-job";
import { countExternalImages } from "@/lib/pdf/external-media";

type Choice<K extends keyof ExportPreferences> = {
  field: K;
  label: string;
  options: { value: ExportPreferences[K]; label: string }[];
};

const SELECTS: Array<Choice<"pdfTheme" | "pageSize" | "messageFilter" | "marginPreset" | "bodyFontFamily">> = [
  { field: "pdfTheme", label: "Page theme", options: [{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }] },
  { field: "pageSize", label: "Paper size", options: [{ value: "A4", label: "A4" }, { value: "Letter", label: "US Letter" }] },
  { field: "messageFilter", label: "Messages", options: [{ value: "all", label: "All messages" }, { value: "assistant", label: "Assistant only" }, { value: "user", label: "User only" }] },
  { field: "marginPreset", label: "Margins", options: [{ value: "compact", label: "Compact" }, { value: "normal", label: "Normal" }, { value: "wide", label: "Wide" }, { value: "custom", label: "Custom (11 mm)" }] },
  { field: "bodyFontFamily", label: "Font family", options: [{ value: "system", label: "System" }, { value: "arial", label: "Arial" }, { value: "georgia", label: "Georgia" }, { value: "times", label: "Times" }] },
];

export function PdfExportControls({ conversation }: { conversation: ConversationData }) {
  const [preferences, setPreferences] = useState<ExportPreferences>(DEFAULT_EXPORT_PREFERENCES);
  const [error, setError] = useState("");
  const [allowExternalImages, setAllowExternalImages] = useState(false);
  const onlineImages=countExternalImages(conversation);
  const update = <K extends keyof ExportPreferences>(key: K, value: ExportPreferences[K]) =>
    setPreferences((current) => ({ ...current, [key]: value }));

  function open(includeImages=allowExternalImages) {
    setError("");
    try {
      openPrintPreview(conversation, preferences, includeImages);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not open the print preview.");
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-[#bad9c3] bg-white p-4">
      <p className="text-sm font-bold text-[#1c5438]">PDF print options</p>
      <p className="mt-1 text-xs leading-5 text-[#617767]">
        Opens a printable page directly in your browser. Imported conversations are not uploaded or stored by this website.
        Choose “Save as PDF” in the browser print dialog.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SELECTS.map((setting) => (
          <label key={setting.field} className="text-xs font-semibold text-[#355941]">
            {setting.label}
            <select value={preferences[setting.field] as string}
              onChange={(event) => update(setting.field, event.target.value as ExportPreferences[typeof setting.field])}
              className="mt-1 w-full rounded-lg border border-[#d1e1d6] bg-white px-3 py-2.5 text-xs">
              {setting.options.map((option) => (
                <option key={option.value as string} value={option.value as string}>{option.label}</option>
              ))}
            </select>
          </label>
        ))}
        <label className="text-xs font-semibold text-[#355941]">
          Body font size: {preferences.bodyFontSize} pt
          <input className="mt-3 w-full accent-[#17603d]" type="range" min={8} max={18} step={1}
            value={preferences.bodyFontSize} onChange={(e) => update("bodyFontSize", Number(e.target.value))}/>
        </label>
        <label className="text-xs font-semibold text-[#355941]">
          Code font size: {preferences.codeFontSize} pt
          <input className="mt-3 w-full accent-[#17603d]" type="range" min={8} max={16} step={1}
            value={preferences.codeFontSize} onChange={(e) => update("codeFontSize", Number(e.target.value))}/>
        </label>
        {([
          ["wrapCode", "Wrap long code lines"],
          ["showCodeLanguage", "Show code language"],
          ["includeTitle", "Include conversation title"],
          ["includeExportDate", "Include export date"],
          ["includeSourceUrl", "Include source link"],
        ] as const).map(([field, label]) => (
          <label key={field} className="flex items-center gap-2 text-xs text-[#355941]">
            <input className="accent-[#17603d]" type="checkbox" checked={preferences[field]}
              onChange={(e) => update(field, e.target.checked)}/>
            {label}
          </label>
        ))}
      </div>
      <label className="mt-4 flex items-start gap-2 rounded-lg border border-[#e0eadb] bg-[#f7faf7] p-3 text-xs leading-5 text-[#355941]">
        <input type="checkbox" className="mt-0.5 accent-[#17603d]" checked={allowExternalImages}
          onChange={(event) => setAllowExternalImages(event.target.checked)} />
        <span><strong>Load external images</strong> (off by default). Remote pictures may contact third-party servers and reveal your IP address.
        Leave unchecked to show labeled placeholders instead. Embedded PNGs/SVGs still print.</span>
      </label>
      {conversation.stats.images > 0 && (
        <p className="mt-2 text-xs leading-5 text-[#617767]">
          This conversation contains {conversation.stats.images} image(s). Enable external images to include available public pictures.
          Images supplied only as internal ChatGPT file references stay labeled as unavailable; browser capture with embedded images is required for those.
        </p>
      )}
      {onlineImages>0&&!allowExternalImages&&(
        <div className="mt-4 rounded-lg border border-[#d8e3ca] bg-[#f6faef] p-3 text-xs leading-5 text-[#355941]">
          <p>This chat contains {onlineImages} online illustration(s). Include them to preserve the diagrams shown in ChatGPT. This contacts their image hosts.</p>
          <button type="button" onClick={()=>{setAllowExternalImages(true);open(true);}}
            className="mt-2 w-full rounded-lg bg-[#174d36] px-4 py-3 text-sm font-semibold text-white">
            Preview PDF with {onlineImages} online images
          </button>
          <p className="mt-2">The button below keeps images disabled and shows labeled placeholders.</p>
        </div>
      )}
      <button onClick={()=>open()} type="button"
        className="mt-4 w-full rounded-lg bg-[#174d36] px-5 py-3 text-sm font-semibold text-white hover:bg-[#136342]">
        Open print preview / Save as PDF
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-[#ad3c3c]">{error}</p>}
      {conversation.possiblyPartial && (
        <p className="mt-2 text-xs leading-5 text-[#9c6e2a]">
          This import may be incomplete. Missing messages, computed styles, and unavailable canvas pixels cannot appear in the PDF.
        </p>
      )}
    </div>
  );
}
