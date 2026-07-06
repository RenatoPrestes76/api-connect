/**
 * @seltriva/ai-core/feedback
 * Feedback System — captures human signals to improve ATHENA over time
 *
 * Feedback is the bridge between human corrections and machine learning.
 * Every decision event (approve/reject/modify) generates a feedback record.
 * The learning module consumes feedback records to update AI behavior.
 *
 * Feedback types:
 *   Positive — AI was correct, human confirmed
 *   Negative — AI was wrong, human rejected
 *   Corrective — AI was partially wrong, human provided the right answer
 *   Implicit — inferred from downstream behavior (e.g., recommendation was ignored)
 */

import type {
  AIResult, FeedbackId, RecommendationId, AgentId, AITaskType, SessionId,
} from '../providers/index';
import type { AIRecommendation } from '../recommendations/index';
import type { DecisionRecord } from '../decision-engine/index';

// ─── Feedback System ──────────────────────────────────────────────────────

export interface FeedbackSystem {
  /**
   * Record feedback from a human decision
   */
  record(input: FeedbackInput): Promise<AIResult<FeedbackRecord>>;

  /**
   * Record feedback derived automatically from a decision record
   */
  recordFromDecision(decision: DecisionRecord): Promise<AIResult<FeedbackRecord>>;

  /**
   * Get a feedback record by ID
   */
  get(id: FeedbackId): Promise<FeedbackRecord | null>;

  /**
   * Search feedback records
   */
  search(query: FeedbackQuery): Promise<FeedbackSearchResult>;

  /**
   * Aggregate feedback into a summary for a specific agent
   */
  aggregate(agentId: AgentId, period?: DateRange): Promise<FeedbackAggregate>;

  /**
   * Get feedback records ready to be consumed by the learning module
   */
  getPendingForLearning(limit?: number): Promise<FeedbackRecord[]>;

  /**
   * Mark feedback records as consumed by the learning module
   */
  markConsumed(ids: FeedbackId[]): Promise<void>;
}

// ─── Feedback Record ──────────────────────────────────────────────────────

export interface FeedbackRecord {
  readonly id: FeedbackId;
  readonly kind: FeedbackKind;
  readonly agentId: AgentId;
  readonly taskType: AITaskType;
  readonly sessionId?: SessionId;
  readonly recommendationId: RecommendationId;

  /** The recommendation that received feedback */
  readonly recommendation: AIRecommendation;

  /** The original confidence score */
  readonly originalConfidence: number;

  /** Human-provided signal */
  readonly signal: FeedbackSignal;

  /** What was corrected (for corrective feedback) */
  readonly correction?: FeedbackCorrection;

  /** Whether the AI reasoning was sound (even if wrong conclusion) */
  readonly reasoningQuality?: ReasoningQualityRating;

  /** Free-text comment from the reviewer */
  readonly comment?: string;

  /** Whether this record has been consumed by learning */
  readonly isConsumed: boolean;

  readonly recordedAt: Date;
  readonly reviewer?: string;
}

export interface FeedbackInput {
  readonly kind: FeedbackKind;
  readonly agentId: AgentId;
  readonly taskType: AITaskType;
  readonly recommendationId: RecommendationId;
  readonly recommendation: AIRecommendation;
  readonly signal: FeedbackSignal;
  readonly correction?: FeedbackCorrection;
  readonly reasoningQuality?: ReasoningQualityRating;
  readonly comment?: string;
  readonly reviewer?: string;
  readonly sessionId?: SessionId;
}

// ─── Feedback Kinds ───────────────────────────────────────────────────────

export type FeedbackKind =
  | 'positive'     // AI was correct
  | 'negative'     // AI was wrong
  | 'corrective'   // AI was wrong — human provided correction
  | 'implicit';    // inferred from downstream behavior

// ─── Feedback Signal ──────────────────────────────────────────────────────

export type FeedbackSignal =
  | 'approved'              // human explicitly approved
  | 'rejected'              // human explicitly rejected
  | 'modified-and-approved' // human corrected and approved
  | 'ignored'               // recommendation was not acted on
  | 'revoked-later'         // was approved but later revoked
  | 'confirmed-correct'     // external validation confirmed AI was right
  | 'confirmed-incorrect';  // external validation confirmed AI was wrong

// ─── Feedback Correction ──────────────────────────────────────────────────

export interface FeedbackCorrection {
  readonly correctedField: string;
  readonly originalValue: string;
  readonly correctedValue: string;
  readonly correctionType: CorrectionType;
}

export type CorrectionType =
  | 'wrong-cbl-term'
  | 'wrong-entity-kind'
  | 'wrong-field-kind'
  | 'wrong-erp-identification'
  | 'wrong-sync-strategy'
  | 'wrong-security-level'
  | 'wrong-severity'
  | 'other';

// ─── Reasoning Quality ────────────────────────────────────────────────────

export type ReasoningQualityRating =
  | 'sound'           // reasoning was valid even if conclusion was wrong
  | 'partially-sound' // some reasoning steps were valid
  | 'flawed'          // reasoning contained logical errors
  | 'not-evaluated';

// ─── Feedback Query ───────────────────────────────────────────────────────

export interface FeedbackQuery {
  readonly kinds?: FeedbackKind[];
  readonly signals?: FeedbackSignal[];
  readonly agentIds?: AgentId[];
  readonly taskTypes?: AITaskType[];
  readonly isConsumed?: boolean;
  readonly period?: DateRange;
  readonly limit?: number;
  readonly offset?: number;
}

export interface FeedbackSearchResult {
  readonly records: FeedbackRecord[];
  readonly total: number;
  readonly hasMore: boolean;
}

// ─── Feedback Aggregate ───────────────────────────────────────────────────

export interface FeedbackAggregate {
  readonly agentId: AgentId;
  readonly period?: DateRange;
  readonly totalFeedback: number;
  readonly positiveCount: number;
  readonly negativeCount: number;
  readonly correctiveCount: number;
  readonly accuracyRate: number;
  readonly averageOriginalConfidence: number;
  readonly correctionsAtHighConfidence: number;
  readonly topCorrectionTypes: Array<{ type: CorrectionType; count: number }>;
  readonly reasoningQualityBreakdown: Readonly<Record<ReasoningQualityRating, number>>;
  readonly trend: 'improving' | 'stable' | 'degrading';
}

// ─── Date Range ───────────────────────────────────────────────────────────

export interface DateRange {
  readonly from: Date;
  readonly to: Date;
}

// ─── Feedback Store ───────────────────────────────────────────────────────

export interface FeedbackStore {
  save(record: FeedbackRecord): Promise<void>;
  getById(id: FeedbackId): Promise<FeedbackRecord | null>;
  findPendingForLearning(limit?: number): Promise<FeedbackRecord[]>;
  markConsumed(ids: FeedbackId[]): Promise<void>;
  findByAgent(agentId: AgentId, limit?: number): Promise<FeedbackRecord[]>;
  countBySignal(agentId: AgentId): Promise<Partial<Record<FeedbackSignal, number>>>;
  delete(id: FeedbackId): Promise<void>;
}
