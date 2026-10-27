/**
 * Ported from the owner's Akash1xe/newGptTopdf extension.
 * The structural shape is intentionally compatible with its normalized JSON model.
 * Do not add browser-extension or DOM dependencies to these types.
 */
export type MessageRole = "user" | "assistant";
export type MathDisplayMode = "inline" | "block";
export type MathSourceFormat = "latex" | "tex" | "mathml";
export type MathRenderStrategy = "latex" | "mathml" | "dom-fallback" | "text-fallback";

export type CodeTokenType =
  | "keyword"
  | "string"
  | "number"
  | "comment"
  | "function"
  | "variable"
  | "operator"
  | "punctuation"
  | "property"
  | "class-name"
  | "type"
  | "builtin"
  | "boolean"
  | "regex"
  | "tag"
  | "attribute"
  | "plain";

export interface TextNode {
  type: "text";
  sourceColor?: string;
  sourceSurface?: string;
  text: string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
}

export interface LinkNode {
  type: "link";
  href: string;
  children: InlineNode[];
}

export interface InlineCodeNode {
  type: "inline-code";
  text: string;
}

export interface LineBreakNode {
  type: "line-break";
}

export interface MathNode {
  type: "math";
  displayMode: MathDisplayMode;
  source?: string;
  sourceFormat?: MathSourceFormat;
  fallbackText: string;
  mathML?: string;
  renderStrategy: MathRenderStrategy;
  sourceLength?: number;
}

export type InlineNode = TextNode | LinkNode | InlineCodeNode | LineBreakNode | MathNode;

export interface ParagraphBlock {
  type: "paragraph";
  children: InlineNode[];
}

export interface HeadingBlock {
  type: "heading";
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: InlineNode[];
}

export interface ListItem {
  blocks: ContentBlock[];
}

export interface OrderedListBlock {
  type: "ordered-list";
  start: number;
  items: ListItem[];
}

export interface UnorderedListBlock {
  type: "unordered-list";
  items: ListItem[];
}

export interface BlockquoteBlock {
  type: "blockquote";
  blocks: ContentBlock[];
}

export interface TableCell {
  header: boolean;
  colspan: number;
  rowspan: number;
  children: InlineNode[];
}

export interface TableRow {
  cells: TableCell[];
}

export interface TableBlock {
  type: "table";
  rows: TableRow[];
  columnCount: number;
}

export interface HorizontalRuleBlock {
  type: "horizontal-rule";
}

export interface CodeToken {
  text: string;
  tokenType: CodeTokenType;
  classNames?: string[];
}

export interface CodeLine {
  number: number;
  tokens: CodeToken[];
  plainText: string;
}

export interface CodeBlock {
  type: "code";
  language?: string;
  displayLanguage?: string;
  code: string;
  lines: CodeLine[];
  source: "dom-highlighted" | "plain";
  lineCount: number;
  hasLongLines: boolean;
  maxLineLength: number;
  tabSize: number;
}

export type ImageSourceType = "data" | "blob" | "remote" | "unknown";

export interface ImageBlock {
  type: "image";
  src?: string;
  alt?: string;
  width?: number;
  height?: number;
  caption?: string;
  sourceType: ImageSourceType;
  mediaKind: "image" | "svg" | "canvas";
}

export type ContentBlock =
  | { type: "layout"; columns: number; card: boolean; sourceBackground?: string; sourceBorder?: string; sourceAlign?: string; columnWidths?: string; darkOnly?: boolean; blocks: ContentBlock[] }
  | { type: "control"; kind: "radio" | "checkbox" | "slider" | "progress" | "action"; text: string; checked: boolean; percent: number }
  | ParagraphBlock
  | HeadingBlock
  | OrderedListBlock
  | UnorderedListBlock
  | BlockquoteBlock
  | TableBlock
  | HorizontalRuleBlock
  | CodeBlock
  | MathNode
  | ImageBlock;
