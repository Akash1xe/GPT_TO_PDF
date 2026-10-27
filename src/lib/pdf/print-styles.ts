import type { ExportPreferences } from "@/lib/conversation/preferences";
import { resolvePdfAppearance } from "./appearance";

export function buildPrintStyles(preferences: ExportPreferences): string {
  const pageSize = preferences.pageSize === "Letter" ? "Letter" : "A4";
  const appearance = resolvePdfAppearance(preferences);
  return `
@page { size: ${pageSize}; margin: ${appearance.marginTop} ${appearance.marginRight} ${appearance.marginBottom} ${appearance.marginLeft}; }
:root {
  color-scheme: light dark;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
  font-size: 14px;
  --pdf-body-font: ${appearance.bodyFontFamily};
  --pdf-body-size: ${appearance.bodyFontSize};
  --pdf-body-weight: ${appearance.bodyFontWeight};
  --pdf-bold-weight: ${appearance.boldFontWeight};
  --pdf-heading-weight: ${appearance.headingFontWeight};
  --pdf-title-weight: ${appearance.titleFontWeight};
  --pdf-table-header-weight: ${appearance.tableHeaderFontWeight};
  --pdf-role-weight: ${appearance.roleFontWeight};
  --pdf-meta-weight: ${appearance.metaFontWeight};
  --pdf-code-label-weight: ${appearance.codeLabelFontWeight};
  --pdf-code-size: ${appearance.codeFontSize};
  --pdf-line-height: ${appearance.lineHeight};
  --pdf-message-padding: ${appearance.messagePadding};
  --pdf-message-gap: ${appearance.messageSpacing};
  --pdf-paragraph-gap: ${appearance.paragraphSpacing};
  --pdf-margin-top: ${appearance.marginTop};
  --pdf-margin-right: ${appearance.marginRight};
  --pdf-margin-bottom: ${appearance.marginBottom};
  --pdf-margin-left: ${appearance.marginLeft};
  --pdf-page-height: ${pageSize === "Letter" ? "279.4mm" : "297mm"};
  --pdf-rule: #e5e7eb;
  --pdf-muted: #6b7280;
  --pdf-soft: #f5f5f5;
  --pdf-code-bg: #f3f4f4;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { background: #f3f4f6; color: #171717; }
a { color: inherit; text-decoration: underline; text-underline-offset: 1.5px; overflow-wrap: anywhere; }
.print-toolbar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; background: #fff; color: #18181b; border-bottom: 1px solid #e4e4e7; font: 13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
.print-toolbar-actions { display: flex; gap: 8px; }
.print-toolbar button { border: 1px solid #d4d4d8; background: #fff; color: #18181b; border-radius: 8px; padding: 7px 11px; cursor: pointer; }
.print-toolbar button.primary { background: #18181b; color: #fff; border-color: #18181b; }
.print-status { color: #71717a; }
.export-document { width: min(900px, calc(100% - 28px)); margin: 18px auto 54px; padding: 28px 34px; background: #fff; color: #171717; box-shadow: 0 8px 32px rgba(0,0,0,.07); font-family: var(--pdf-body-font); font-size: var(--pdf-body-size); font-weight: var(--pdf-body-weight); line-height: var(--pdf-line-height); }
.export-document.theme-dark { background: #18181b; color: #f4f4f5; --pdf-rule: #3f3f46; --pdf-muted: #a1a1aa; --pdf-soft: #27272a; --pdf-code-bg: #202024; }
.theme-dark .source-color { color: var(--source-color, inherit); }
.export-document.theme-light { color: #000; }
.theme-light .source-color { color: var(--source-color-light, inherit); }
.theme-dark .visual-card { border-color: #52525b; }
.theme-dark .visual-radio, .theme-dark .visual-checkbox { border-color: #d4d4d8; }
.theme-dark .visual-radio.is-checked::after { background: #f4f4f5; }
.theme-dark .visual-slider { background: #3f3f46; border-color: #71717a; }
.theme-dark .visual-slider::after { background: #fafafa; border-color: #d4d4d8; }
.document-header { border-bottom: 1px solid var(--pdf-rule); padding-bottom: .68em; margin-bottom: .95em; }
.document-title { font-size: 1.9em; line-height: 1.12; letter-spacing: -.02em; margin: 0; font-weight: var(--pdf-title-weight); }
.document-meta { margin-top: .32em; display: flex; flex-wrap: wrap; gap: .35em .9em; color: var(--pdf-muted); font-size: .72em; line-height: 1.3; font-weight: var(--pdf-meta-weight); }
.message { margin: 0 0 var(--pdf-message-gap); break-inside: auto; }
.assistant-only-document .message { margin-bottom: calc(var(--pdf-message-gap) * .72); }
.message-role { display: inline-block; margin-bottom: .24em; font-size: .64em; line-height: 1.25; font-weight: var(--pdf-role-weight); text-transform: uppercase; letter-spacing: .09em; color: var(--pdf-muted); }
.message-user { border-left: 1.5px solid #b5b8bd; padding-left: .8em; }
.message-assistant { border-left: 1px solid transparent; }
.message-body { padding-block: var(--pdf-message-padding); }
.message-body > :first-child { margin-top: 0; }
.message-body > :last-child { margin-bottom: 0; }
.message-body strong, .message-body b { font-weight: var(--pdf-bold-weight); }
p { margin: 0 0 var(--pdf-paragraph-gap); orphans: 2; widows: 2; }
h1,h2,h3,h4,h5,h6 { line-height: 1.22; margin: .86em 0 .32em; break-after: avoid; page-break-after: avoid; font-weight: var(--pdf-heading-weight); }
.message-body > h1:first-child, .message-body > h2:first-child, .message-body > h3:first-child { margin-top: .12em; }
h1 { font-size: 1.5em; } h2 { font-size: 1.34em; } h3 { font-size: 1.18em; } h4 { font-size: 1.08em; } h5,h6 { font-size: 1em; }
ul,ol { margin: .3em 0 .5em; padding-left: 1.55em; }
/* Restore list markers reset by the website's Tailwind preflight. */
.export-document ul { list-style: disc outside; }
.export-document ol { list-style: decimal outside; }
.export-document ul ul { list-style-type: circle; }
.export-document ul ul ul { list-style-type: square; }
.export-document li { display: list-item; }
li { margin: .08em 0; }
li > p { margin: 0 0 .16em; }
li > ul, li > ol { margin-top: .12em; margin-bottom: .18em; }
blockquote { margin: .52em 0; padding: .36em .62em; border-left: 2px solid #a7abb1; background: var(--pdf-soft); break-inside: avoid-page; }
hr { border: 0; border-top: 1px solid var(--pdf-rule); margin: .72em 0; }
.inline-code { font-family: ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: .88em; font-weight: 400; background: var(--pdf-soft); border: 0; border-radius: 2px; padding: 0 .18em; }
.code-block { margin: .5em 0 .68em; border: 0; border-radius: 2px; overflow: hidden; background: var(--pdf-code-bg); break-inside: auto; }
.code-short { break-inside: avoid-page; }
.code-label { padding: .35em .58em .18em; border: 0; font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; font-size: .72em; font-weight: var(--pdf-code-label-weight); line-height: 1.25; color: var(--pdf-muted); background: transparent; }
.code-block pre { margin: 0; padding: .5em .62em .62em; font-family: ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: var(--pdf-code-size); font-weight: 400; line-height: 1.35; white-space: pre; tab-size: 4; }
.code-block.code-wrap pre, .code-block.code-has-long-lines pre { white-space: pre-wrap; overflow-wrap: anywhere; word-break: normal; }
.code-theme-dark { background: #1f2024; color: #f4f4f5; }
.code-theme-dark .code-label { color: #b9bbc1; }
.tok-keyword,.tok-type,.tok-builtin { color: #047857; }
.tok-string,.tok-regex { color: #9a5b13; }
.tok-number,.tok-boolean { color: #9f1239; }
.tok-comment { color: #6b7280; font-style: italic; }
.tok-function,.tok-class-name { color: #1d4ed8; }
.tok-variable { color: inherit; }
.tok-operator,.tok-punctuation { color: #4b5563; }
.tok-tag,.tok-attribute,.tok-property { color: #06715f; }
.code-theme-dark .tok-keyword,.code-theme-dark .tok-type,.code-theme-dark .tok-builtin { color: #6ee7b7; }
.code-theme-dark .tok-string,.code-theme-dark .tok-regex { color: #fcd34d; }
.code-theme-dark .tok-number,.code-theme-dark .tok-boolean { color: #fda4af; }
.code-theme-dark .tok-comment { color: #a1a1aa; }
.code-theme-dark .tok-function,.code-theme-dark .tok-class-name { color: #93c5fd; }
.code-theme-dark .tok-operator,.code-theme-dark .tok-punctuation { color: #d4d4d8; }
.code-theme-dark .tok-tag,.code-theme-dark .tok-attribute,.code-theme-dark .tok-property { color: #5eead4; }
.math { max-width: 100%; font-weight: 400; }
.math-inline { display: inline; vertical-align: baseline; }
.math-block { display: block; margin: .52em 0; text-align: center; overflow: visible; break-inside: avoid-page; }
.math .katex { font-size: 1.06em; color: inherit; }
.math-inline > .katex { display: inline; }
.math-block > .katex-display { margin: 0; overflow: visible; }
.math .katex-html { white-space: nowrap; }
.math math { max-width: 100%; }
.math-fallback { font-family: "Cambria Math", "Times New Roman", serif; white-space: pre-wrap; overflow-wrap: anywhere; }
.math-simple { display: inline-flex; align-items: baseline; }
.math-radicand { border-top: 1px solid currentColor; padding: 0 2px; }
.math-fraction { display: inline-grid; grid-template-rows: auto auto; vertical-align: middle; text-align: center; line-height: 1.12; }
.math-num { border-bottom: 1px solid currentColor; padding: 0 3px 1px; } .math-den { padding: 1px 3px 0; }
.table-shell { width: 100%; overflow: hidden; margin: .5em 0 .68em; }
table { width: 100%; border-collapse: collapse; table-layout: auto; font-size: .9em; }
th,td { border: 1px solid #cfd2d6; padding: .24em .4em; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
th { background: #e9eaec; font-weight: var(--pdf-table-header-weight); }
.theme-dark th,.theme-dark td { border-color: #52525b; } .theme-dark th { background: #2f3035; }
thead { display: table-header-group; } tr { break-inside: avoid; }
.visual-layout { gap: .65em; margin: .6em 0; min-width: 0; }
.visual-layout .visual-layout { margin-block: .25em; }
.visual-layout > :first-child { margin-top: 0; }
.visual-layout > :last-child { margin-bottom: 0; }
.visual-layout > .visual-layout > .visual-control { margin-block: .15em; }
.visual-control, .visual-action { break-inside: avoid; }
.message-role { break-after: avoid; page-break-after: avoid; }
.message-body > :first-child { break-before: avoid-page; }
.visual-card { box-decoration-break: clone; -webkit-box-decoration-break: clone; }
.code-label { break-after: avoid; }
.diagram-block { margin: .7em 0; padding: .6em; break-inside: avoid-page; text-align: center; }
.diagram-block svg { display: block; width: 100%; height: auto; max-width: 100%; max-height: min(190mm, calc(var(--pdf-page-height) - var(--pdf-margin-top) - var(--pdf-margin-bottom) - 20mm)); margin: 0 auto; overflow: visible; }
.diagram-block .node rect { rx: 12px; ry: 12px; }
.diagram-warning { padding: .5em .7em; font-size: .85em; color: var(--pdf-muted); }
.diagram-measurement { position: absolute; left: -100000px; top: 0; width: 1000px; visibility: hidden; }
.visual-card { border: 1px solid #aaa; border-radius: 10px; padding: .8em; }
.visual-control { display: flex; align-items: center; gap: .5em; margin: .35em 0; }
.visual-panel { padding: .8em; border-radius: 10px; }
.visual-action { justify-content: center; border: 1px solid #999; border-radius: 2em; padding: .5em 1em; background: #eee; color: #111; }
.visual-meter { flex-direction: column; align-items: stretch; gap: .7em; padding-block: .5em; }
.visual-meter .visual-slider { flex: none; }
.visual-progress { display: block; width: 100%; height: .5em; background: #ddd; border-radius: 1em; overflow: hidden; }
.visual-progress::after { content: ''; display: block; height: 100%; width: var(--position); background: #444; border-radius: inherit; }
.theme-dark .visual-progress { background: #303030; }
.theme-dark .visual-progress::after { background: #eee; }
.visual-radio, .visual-checkbox { display: inline-block; flex: 0 0 1em; width: 1em; height: 1em; border: 1px solid #555; }
.visual-radio { border-radius: 50%; }
.visual-radio.is-checked::after { content: ''; display: block; margin: 25%; width: 50%; height: 50%; background: #222; border-radius: 50%; }
.visual-checkbox.is-checked::after { content: '\\2713'; display: block; line-height: 1; text-align: center; }
.visual-slider { display: block; position: relative; height: .45em; flex: 1; min-width: 5em; background: #ddd; border: 1px solid #888; border-radius: 1em; }
.visual-slider::after { content: ''; position: absolute; left: clamp(.5em, var(--position), calc(100% - .5em)); top: 50%; transform: translate(-50%, -50%); width: 1em; height: 1em; border: 1px solid #333; border-radius: 50%; background: #fff; }
.media-block { margin: .62em 0; text-align: center; break-inside: avoid-page; }
.media-block img { display: block; max-width: 100%; max-height: min(240mm, calc(var(--pdf-page-height) - var(--pdf-margin-top) - var(--pdf-margin-bottom) - 15mm)); width: auto; height: auto; margin: 0 auto; object-fit: contain; }
.media-block figcaption { margin-top: .28em; font-size: .76em; font-weight: var(--pdf-meta-weight); color: var(--pdf-muted); }
.media-placeholder { padding: .62em; border: 1px dashed #a1a1aa; color: var(--pdf-muted); font-size: .8em; font-weight: var(--pdf-meta-weight); }
@media print {
  html, body { background: transparent !important; }
  .print-toolbar { display: none !important; }
  .skip-link, nextjs-portal { display: none !important; }
  .export-document, .export-document.theme-dark { width: auto; margin: 0; padding: 0; box-shadow: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .message { margin-bottom: var(--pdf-message-gap); }
  .assistant-only-document .message { margin-bottom: calc(var(--pdf-message-gap) * .72); }
  .export-document > .message:last-child { margin-bottom: 0; }
  .export-document > .message:last-child > .message-body { padding-bottom: 0; }
  .document-header { margin-bottom: .9em; }
  .code-block { overflow: visible; }
  .table-shell { overflow: visible; }
}
${preferences.pdfTheme === 'dark' ? `
@page { background: #18181b; }
html, body { background: #18181b; color: #f4f4f5; }
@media print {
  html, body { background: #18181b !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .export-document::before { content: ''; position: fixed; inset: calc(-1 * var(--pdf-margin-top)) calc(-1 * var(--pdf-margin-right)) calc(-1 * var(--pdf-margin-bottom)) calc(-1 * var(--pdf-margin-left)); background: #18181b; z-index: -1; }
}` : ''}
`;
}
