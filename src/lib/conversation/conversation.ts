/**
 * Ported from the owner's Akash1xe/newGptTopdf extension.
 * The structural shape is intentionally compatible with its normalized JSON model.
 * Do not add browser-extension or DOM dependencies to these types.
 */
import type { ContentBlock, MessageRole } from "./content";

export type MessageIdentityQuality = "strong" | "contextual";

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  order: number;
  plainText: string;
  blocks: ContentBlock[];
  /** Stable ChatGPT turn ordinal when the DOM exposes one, e.g. conversation-turn-42. */
  sourceOrder?: number;
  /** Used by the full collector to avoid claiming completeness when only unstable fallback IDs exist. */
  identityQuality?: MessageIdentityQuality;
}

export interface ConversationStats {
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  codeBlocks: number;
  mathNodes: number;
  images: number;
}

export type CompletenessState = "complete" | "possibly-partial" | "known-partial";
export type CompletenessReason =
  | "virtualized-history"
  | "load-limit"
  | "timeout"
  | "no-progress"
  | "dom-change"
  | "page-changed"
  | "conversation-changed"
  | "streaming-started"
  | "scroll-container-lost"
  | "identity-conflict"
  | "user-cancelled"
  | "unresolved-gap"
  | "continuity-unverified"
  | "tail-missing"
  | "unknown";

export type BeginningEvidence = "turn-ordinal" | "stable-top";

export interface ExtractionCompleteness {
  state: CompletenessState;
  reason?: CompletenessReason;
  iterations?: number;
  collectedMessages?: number;
  elapsedMs?: number;
  noProgressPasses?: number;
  topStabilityPasses?: number;
  tailStabilityPasses?: number;
  reachedBeginning?: boolean;
  verifiedBeginning?: boolean;
  verifiedEnd?: boolean;
  continuityVerified?: boolean;
  beginningEvidence?: BeginningEvidence;
  turboIterations?: number;
  recoveryIterations?: number;
  gapsDetected?: number;
  gapsRecovered?: number;
  unresolvedGaps?: number;
  uniqueParsedMessages?: number;
  duplicateCandidatesSkipped?: number;
  oldestMessageId?: string;
  newestMessageId?: string;
  scrollContainer?: string;
  scrollRangePx?: number;
  scrollPositionPx?: number;
  scrollCoordinateMode?: "standard" | "negative";
}

export interface ConversationData {
  provider: "chatgpt";
  title: string;
  url: string;
  capturedUrl: string;
  capturedAt: string;
  conversationId?: string;
  messageCount: number;
  possiblyPartial: boolean;
  completeness: ExtractionCompleteness;
  messages: ConversationMessage[];
  stats: ConversationStats;
}
