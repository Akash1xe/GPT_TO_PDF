import type {
  CodeLine, CodeToken, ContentBlock, ImageBlock, InlineNode, MathNode, TableCell,
} from "./content";
import type {
  ConversationData, ConversationMessage, ExtractionCompleteness,
} from "./conversation";
import { buildConversationStats } from "./stats";
import { safeCssColor, safeLinkHref, safeSourceUrl, supportedImageSource } from "./urls";

export const CONVERSATION_SCHEMA_VERSION = 1 as const;

export interface ConversationDocumentV1 {
  schemaVersion: typeof CONVERSATION_SCHEMA_VERSION;
  conversation: ConversationData;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult<T> =
  | { ok: true; data: T; warnings: string[] }
  | { ok: false; issues: ValidationIssue[] };

const MAX_MESSAGES = 10_000;
const MAX_BLOCKS = 100_000;
const MAX_DEPTH = 40;
const MAX_STRING_BUDGET = 40_000_000;
const MAX_CHILDREN = 50_000;

class InvalidModel extends Error {
  constructor(public readonly path: string, message: string) {
    super(message);
  }
}

interface Context {
  blockCount: number;
  charCount: number;
  warnings: string[];
}

function invalid(path: string, message: string): never {
  throw new InvalidModel(path, message);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalid(path, "Expected an object.");
  }
  return value as Record<string, unknown>;
}

function text(ctx: Context, value: unknown, path: string, max = 100_000): string {
  if (typeof value !== "string" || value.length > max) invalid(path, `Expected a string of at most ${max.toLocaleString()} characters.`);
  ctx.charCount += value.length;
  if (ctx.charCount > MAX_STRING_BUDGET) invalid(path, "Conversation exceeds the total text/media size limit.");
  return value;
}

function optionalText(ctx: Context, value: unknown, path: string, max = 100_000): string | undefined {
  return value === undefined ? undefined : text(ctx, value, path, max);
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") invalid(path, "Expected a boolean.");
  return value;
}

function number(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    invalid(path, `Expected a number between ${min} and ${max}.`);
  }
  return value;
}

function integer(value: unknown, path: string, min: number, max: number): number {
  const n = number(value, path, min, max);
  if (!Number.isSafeInteger(n)) invalid(path, "Expected a safe integer.");
  return n;
}

function choice<T extends string>(value: unknown, path: string, variants: readonly T[]): T {
  if (typeof value !== "string" || !variants.includes(value as T)) invalid(path, `Expected one of: ${variants.join(", ")}.`);
  return value as T;
}

function array(value: unknown, path: string, max = MAX_CHILDREN): unknown[] {
  if (!Array.isArray(value) || value.length > max) invalid(path, `Expected an array of at most ${max} items.`);
  return value;
}

function depthCheck(depth: number, path: string) {
  if (depth > MAX_DEPTH) invalid(path, "Content is nested too deeply.");
}

function math(ctx: Context, value: Record<string, unknown>, path: string): MathNode {
  const source = optionalText(ctx, value.source, `${path}.source`, 200_000);
  const mathML = optionalText(ctx, value.mathML, `${path}.mathML`, 300_000);
  const fallbackText = text(ctx, value.fallbackText, `${path}.fallbackText`, 200_000);
  return {
    type: "math",
    displayMode: choice(value.displayMode, `${path}.displayMode`, ["inline", "block"] as const),
    ...(source === undefined ? {} : { source }),
    ...(value.sourceFormat === undefined ? {} : { sourceFormat: choice(value.sourceFormat, `${path}.sourceFormat`, ["latex", "tex", "mathml"] as const) }),
    fallbackText,
    ...(mathML === undefined ? {} : { mathML }),
    renderStrategy: choice(value.renderStrategy, `${path}.renderStrategy`, ["latex", "mathml", "dom-fallback", "text-fallback"] as const),
    ...(value.sourceLength === undefined ? {} : { sourceLength: integer(value.sourceLength, `${path}.sourceLength`, 0, 200_000) }),
  };
}

function inline(ctx: Context, input: unknown, path: string, depth: number): InlineNode {
  depthCheck(depth, path);
  const value = record(input, path);
  switch (value.type) {
    case "text": {
      const result: Extract<InlineNode, { type: "text" }> = { type: "text", text: text(ctx, value.text, `${path}.text`, 2_000_000) };
      for (const key of ["bold", "italic", "strikethrough"] as const) {
        if (value[key] !== undefined) result[key] = boolean(value[key], `${path}.${key}`);
      }
      for (const key of ["sourceColor", "sourceSurface"] as const) {
        if (value[key] !== undefined) {
          const color = text(ctx, value[key], `${path}.${key}`, 160);
          if (!safeCssColor(color)) invalid(`${path}.${key}`, "Unsupported CSS color value.");
          result[key] = color;
        }
      }
      return result;
    }
    case "link": {
      const href = text(ctx, value.href, `${path}.href`, 4096);
      const sanitized = safeLinkHref(href);
      if (!sanitized) invalid(`${path}.href`, "Unsupported or unsafe link URL.");
      return { type: "link", href: sanitized, children: array(value.children, `${path}.children`).map((child, i) => inline(ctx, child, `${path}.children[${i}]`, depth + 1)) };
    }
    case "inline-code":
      return { type: "inline-code", text: text(ctx, value.text, `${path}.text`, 2_000_000) };
    case "line-break":
      return { type: "line-break" };
    case "math":
      return math(ctx, value, path);
    default:
      return invalid(`${path}.type`, "Unknown inline node type.");
  }
}

function inlineChildren(ctx: Context, input: unknown, path: string, depth: number): InlineNode[] {
  return array(input, path).map((item, i) => inline(ctx, item, `${path}[${i}]`, depth + 1));
}

function block(ctx: Context, input: unknown, path: string, depth: number): ContentBlock {
  depthCheck(depth, path);
  if (++ctx.blockCount > MAX_BLOCKS) invalid(path, "Too many content blocks.");
  const v = record(input, path);
  switch (v.type) {
    case "layout": {
      const b: Extract<ContentBlock, { type: "layout" }> = {
        type: "layout", columns: integer(v.columns, `${path}.columns`, 1, 4),
        card: boolean(v.card, `${path}.card`),
        blocks: blocks(ctx, v.blocks, `${path}.blocks`, depth + 1),
      };
      if (v.darkOnly !== undefined) b.darkOnly = boolean(v.darkOnly, `${path}.darkOnly`);
      if (v.sourceAlign !== undefined) b.sourceAlign = choice(v.sourceAlign, `${path}.sourceAlign`, ["left", "center", "right"] as const);
      for (const key of ["sourceBackground", "sourceBorder"] as const) {
        if (v[key] === undefined) continue;
        const color = text(ctx, v[key], `${path}.${key}`, 160);
        if (!safeCssColor(color)) invalid(`${path}.${key}`, "Unsupported CSS color value.");
        b[key] = color;
      }
      if (v.columnWidths !== undefined) {
        const widths = text(ctx, v.columnWidths, `${path}.columnWidths`, 160);
        if (!/^[\d.fr\s]+$/.test(widths)) invalid(`${path}.columnWidths`, "Unsupported column widths.");
        b.columnWidths = widths;
      }
      return b;
    }
    case "control":
      return {
        type: "control",
        kind: choice(v.kind, `${path}.kind`, ["radio", "checkbox", "slider", "progress", "action"] as const),
        text: text(ctx, v.text, `${path}.text`, 20_000),
        checked: boolean(v.checked, `${path}.checked`),
        percent: number(v.percent, `${path}.percent`, 0, 100),
      };
    case "paragraph":
      return { type: "paragraph", children: inlineChildren(ctx, v.children, `${path}.children`, depth + 1) };
    case "heading":
      return { type: "heading", level: integer(v.level, `${path}.level`, 1, 6) as 1|2|3|4|5|6,
        children: inlineChildren(ctx, v.children, `${path}.children`, depth + 1) };
    case "ordered-list":
    case "unordered-list": {
      const items = array(v.items, `${path}.items`, 20_000).map((item, i) => {
        const p = `${path}.items[${i}]`;
        return { blocks: blocks(ctx, record(item, p).blocks, `${p}.blocks`, depth + 1) };
      });
      return v.type === "ordered-list"
        ? { type: "ordered-list", start: integer(v.start, `${path}.start`, 1, 1_000_000), items }
        : { type: "unordered-list", items };
    }
    case "blockquote":
      return { type: "blockquote", blocks: blocks(ctx, v.blocks, `${path}.blocks`, depth + 1) };
    case "table": {
      const rows = array(v.rows, `${path}.rows`, 10_000).map((row, ri) => {
        const p = `${path}.rows[${ri}]`;
        return { cells: array(record(row, p).cells, `${p}.cells`, 100).map((cell, ci): TableCell => {
          const pathCell = `${p}.cells[${ci}]`;
          const c = record(cell, pathCell);
          return {
            header: boolean(c.header, `${pathCell}.header`),
            colspan: integer(c.colspan, `${pathCell}.colspan`, 1, 100),
            rowspan: integer(c.rowspan, `${pathCell}.rowspan`, 1, 10_000),
            children: inlineChildren(ctx, c.children, `${pathCell}.children`, depth + 1),
          };
        }) };
      });
      return { type: "table", rows, columnCount: integer(v.columnCount, `${path}.columnCount`, 0, 100) };
    }
    case "horizontal-rule":
      return { type: "horizontal-rule" };
    case "code": {
      const lines = array(v.lines, `${path}.lines`, 100_000).map((line, i): CodeLine => {
        const p = `${path}.lines[${i}]`;
        const l = record(line, p);
        const tokens = array(l.tokens, `${p}.tokens`, 20_000).map((token, ti): CodeToken => {
          const pt = `${p}.tokens[${ti}]`;
          const t = record(token, pt);
          const ret: CodeToken = {
            text: text(ctx, t.text, `${pt}.text`, 2_000_000),
            tokenType: choice(t.tokenType, `${pt}.tokenType`, [
              "keyword","string","number","comment","function","variable","operator",
              "punctuation","property","class-name","type","builtin","boolean",
              "regex","tag","attribute","plain"
            ] as const),
          };
          if (t.classNames !== undefined) {
            ret.classNames = array(t.classNames, `${pt}.classNames`, 50).map((item, j) =>
              text(ctx, item, `${pt}.classNames[${j}]`, 160));
          }
          return ret;
        });
        return { number: integer(l.number, `${p}.number`, 1, 100_000), plainText: text(ctx, l.plainText, `${p}.plainText`, 2_000_000), tokens };
      });
      const code: Extract<ContentBlock, { type: "code" }> = {
        type: "code",
        code: text(ctx, v.code, `${path}.code`, 2_000_000),
        lines,
        source: choice(v.source, `${path}.source`, ["dom-highlighted", "plain"] as const),
        lineCount: integer(v.lineCount, `${path}.lineCount`, 0, 100_000),
        hasLongLines: boolean(v.hasLongLines, `${path}.hasLongLines`),
        maxLineLength: integer(v.maxLineLength, `${path}.maxLineLength`, 0, 2_000_000),
        tabSize: integer(v.tabSize, `${path}.tabSize`, 1, 32),
      };
      if (v.language !== undefined) code.language = text(ctx, v.language, `${path}.language`, 80);
      if (v.displayLanguage !== undefined) code.displayLanguage = text(ctx, v.displayLanguage, `${path}.displayLanguage`, 80);
      return code;
    }
    case "math":
      return math(ctx, v, path);
    case "image": {
      const src = optionalText(ctx, v.src, `${path}.src`, 8_000_000);
      if (src && !supportedImageSource(src)) invalid(`${path}.src`, "Unsupported or unsafe image source.");
      const b: ImageBlock = {
        type: "image",
        sourceType: choice(v.sourceType, `${path}.sourceType`, ["data", "blob", "remote", "unknown"] as const),
        mediaKind: choice(v.mediaKind, `${path}.mediaKind`, ["image", "svg", "canvas"] as const),
      };
      if (src !== undefined) b.src = src;
      if (v.alt !== undefined) b.alt = text(ctx, v.alt, `${path}.alt`, 10_000);
      if (v.caption !== undefined) b.caption = text(ctx, v.caption, `${path}.caption`, 10_000);
      for (const key of ["width", "height"] as const) {
        if (v[key] !== undefined) b[key] = number(v[key], `${path}.${key}`, 0, 100_000);
      }
      if (src?.startsWith("blob:")) ctx.warnings.push(`${path}.src: blob URL only works in its original browser session.`);
      if (src?.startsWith("data:image/svg+xml")) ctx.warnings.push(`${path}.src: embedded SVG must be sanitized before browser rendering.`);
      return b;
    }
    default:
      return invalid(`${path}.type`, "Unknown content block type.");
  }
}

function blocks(ctx: Context, input: unknown, path: string, depth: number): ContentBlock[] {
  depthCheck(depth, path);
  return array(input, path).map((item, i) => block(ctx, item, `${path}[${i}]`, depth + 1));
}

const COMPLETENESS_REASONS = [
  "virtualized-history", "load-limit", "timeout", "no-progress", "dom-change",
  "page-changed", "conversation-changed", "streaming-started", "scroll-container-lost",
  "identity-conflict", "user-cancelled", "unresolved-gap", "continuity-unverified",
  "tail-missing", "unknown",
] as const;

function completeness(ctx: Context, value: unknown, path: string): ExtractionCompleteness {
  const v = record(value, path);
  const c: ExtractionCompleteness = {
    state: choice(v.state, `${path}.state`, ["complete", "possibly-partial", "known-partial"] as const),
  };
  if (v.reason !== undefined) c.reason = choice(v.reason, `${path}.reason`, COMPLETENESS_REASONS);
  for (const key of ["reachedBeginning","verifiedBeginning","verifiedEnd","continuityVerified"] as const) {
    if (v[key] !== undefined) c[key] = boolean(v[key], `${path}.${key}`);
  }
  for (const key of [
    "iterations","collectedMessages","elapsedMs","noProgressPasses","topStabilityPasses",
    "tailStabilityPasses","turboIterations","recoveryIterations","gapsDetected",
    "gapsRecovered","unresolvedGaps","uniqueParsedMessages","duplicateCandidatesSkipped",
    "scrollRangePx"
  ] as const) {
    if (v[key] !== undefined) c[key] = number(v[key], `${path}.${key}`, 0, 1_000_000_000);
  }
  if (v.scrollPositionPx !== undefined) c.scrollPositionPx = number(v.scrollPositionPx, `${path}.scrollPositionPx`, -1_000_000_000, 1_000_000_000);
  for (const key of ["oldestMessageId","newestMessageId","scrollContainer"] as const) {
    if (v[key] !== undefined) c[key] = text(ctx, v[key], `${path}.${key}`, 4096);
  }
  if (v.beginningEvidence !== undefined) c.beginningEvidence = choice(v.beginningEvidence, `${path}.beginningEvidence`, ["turn-ordinal", "stable-top"] as const);
  if (v.scrollCoordinateMode !== undefined) c.scrollCoordinateMode = choice(v.scrollCoordinateMode, `${path}.scrollCoordinateMode`, ["standard", "negative"] as const);
  return c;
}

function internalParse(input: unknown): { data: ConversationData; warnings: string[] } {
  const ctx: Context = { blockCount: 0, charCount: 0, warnings: [] };
  const v = record(input, "$");
  if (v.provider !== "chatgpt") invalid("$.provider", "Expected provider chatgpt.");

  const messagesValue = array(v.messages, "$.messages", MAX_MESSAGES);
  const ids = new Set<string>();
  const messages: ConversationMessage[] = messagesValue.map((inputMessage, index) => {
    const path = `$.messages[${index}]`;
    const item = record(inputMessage, path);
    const id = text(ctx, item.id, `${path}.id`, 512);
    if (!id.trim()) invalid(`${path}.id`, "Message ID cannot be empty.");
    if (ids.has(id)) invalid(`${path}.id`, "Duplicate message ID.");
    ids.add(id);
    integer(item.order, `${path}.order`, 0, MAX_MESSAGES);
    if (item.order !== index) ctx.warnings.push(`${path}.order: normalized to its position in the message array.`);
    const role = choice(item.role, `${path}.role`, ["user", "assistant"] as const);
    const message: ConversationMessage = {
      id, role, order: index,
      plainText: text(ctx, item.plainText, `${path}.plainText`, 2_000_000),
      blocks: blocks(ctx, item.blocks, `${path}.blocks`, 0),
    };
    if (item.sourceOrder !== undefined) message.sourceOrder = integer(item.sourceOrder, `${path}.sourceOrder`, 0, 1_000_000_000);
    if (item.identityQuality !== undefined) message.identityQuality = choice(item.identityQuality, `${path}.identityQuality`, ["strong", "contextual"] as const);
    return message;
  });

  const title = text(ctx, v.title, "$.title", 4096);
  const url = text(ctx, v.url, "$.url", 4096);
  const capturedUrl = text(ctx, v.capturedUrl, "$.capturedUrl", 4096);
  if (!safeSourceUrl(url)) invalid("$.url", "Unsafe conversation source URL.");
  if (!safeSourceUrl(capturedUrl)) invalid("$.capturedUrl", "Unsafe captured URL.");
  const capturedAt = text(ctx, v.capturedAt, "$.capturedAt", 100);
  if (!Number.isFinite(Date.parse(capturedAt))) invalid("$.capturedAt", "Expected a valid timestamp.");
  const providedCount = integer(v.messageCount, "$.messageCount", 0, MAX_MESSAGES);
  const possiblyPartial = boolean(v.possiblyPartial, "$.possiblyPartial");
  const state = completeness(ctx, v.completeness, "$.completeness");
  if (providedCount !== messages.length) ctx.warnings.push("$.messageCount: recalculated from messages.");
  if (possiblyPartial !== (state.state !== "complete")) ctx.warnings.push("$.possiblyPartial: synchronized with completeness state.");
  if (state.collectedMessages !== undefined && state.collectedMessages !== messages.length) {
    ctx.warnings.push("$.completeness.collectedMessages: recalculated from messages.");
  }
  state.collectedMessages = messages.length;

  const stats = buildConversationStats(messages);
  if (v.stats !== undefined && JSON.stringify(v.stats) !== JSON.stringify(stats)) {
    ctx.warnings.push("$.stats: recalculated from validated content.");
  }
  if (v.stats === undefined) ctx.warnings.push("$.stats: computed from validated content.");

  const data: ConversationData = {
    provider: "chatgpt", title, url: safeSourceUrl(url)!, capturedUrl: safeSourceUrl(capturedUrl)!,
    capturedAt, messageCount: messages.length,
    possiblyPartial: state.state !== "complete",
    completeness: state, messages, stats,
  };
  if (v.conversationId !== undefined) data.conversationId = text(ctx, v.conversationId, "$.conversationId", 512);
  return { data, warnings: ctx.warnings };
}

export function parseConversationData(input: unknown): ValidationResult<ConversationData> {
  try {
    const { data, warnings } = internalParse(input);
    return { ok: true, data, warnings };
  } catch (error) {
    if (error instanceof InvalidModel) {
      return { ok: false, issues: [{ path: error.path, message: error.message }] };
    }
    // A cyclic/non-JSON input or unexpected proxy can never become trusted data.
    return { ok: false, issues: [{ path: "$", message: "Unable to read conversation data safely." }] };
  }
}

export function createConversationDocument(data: ConversationData): ConversationDocumentV1 {
  return { schemaVersion: CONVERSATION_SCHEMA_VERSION, conversation: data };
}

export function parseConversationDocument(input: unknown): ValidationResult<ConversationDocumentV1> {
  try {
    const envelope = record(input, "$");
    if (envelope.schemaVersion !== CONVERSATION_SCHEMA_VERSION) {
      invalid("$.schemaVersion", "Unsupported conversation model schema version.");
    }
    const result = parseConversationData(envelope.conversation);
    return result.ok
      ? { ok: true, data: createConversationDocument(result.data), warnings: result.warnings }
      : result;
  } catch (error) {
    if (error instanceof InvalidModel) return { ok: false, issues: [{ path: error.path, message: error.message }] };
    return { ok: false, issues: [{ path: "$", message: "Invalid document envelope." }] };
  }
}
