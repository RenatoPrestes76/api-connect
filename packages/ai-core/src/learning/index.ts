/**
 * @seltriva/ai-core/learning
 * AI Learning Engine — improves ATHENA from confirmed decisions
 *
 * Learning occurs ONLY after a human confirms a recommendation.
 * Sources of learning:
 *   1. Feedback records (approved/rejected/corrected)
 *   2. Observed patterns in confirmed entity classifications
 *   3. ERP conventions discovered through real integrations
 *   4. Performance patterns from observed sync execution
 *
 * INVARIANT: Learning never reads business data values.
 * Only structural metadata (names, types, patterns) is stored.
 *
 * Learning produces:
 *   - Updated confidence weights for specific agents
 *   - New pattern entries in AI Memory
 *   - ERP profile refinements (forwarded to semantic-engine profiles)
 *   - Prompt performance signals (forwarded to prompt-registry)
 */

import type { AIResult, AgentId, AITaskType } from '../providers/index';
import type { FeedbackRecord, FeedbackAggregate } from '../feedback/index';
import type { MemoryEntryInput } from '../memory/index';

// ─── AI Learning Engine ───────────────────────────────────────────────────

export interface AILearningEngine {
  /**
   * Process a single feedback record and extract learnable patterns
   */
  learn(feedback: FeedbackRecord): Promise<AIResult<LearningOutcome>>;

  /**
   * Process a batch of feedback records (called periodically)
   */
  learnBatch(feedbackRecords: FeedbackRecord[]): Promise<AIResult<BatchLearningOutcome>>;

  /**
   * Query extracted AI learning patterns
   */
  queryPatterns(query: AILearningPatternQuery): Promise<AILearningPattern[]>;

  /**
   * Get all patterns for a specific agent
   */
  getPatternsForAgent(agentId: AgentId): Promise<AILearningPattern[]>;

  /**
   * Get learning statistics
   */
  getStats(agentId?: AgentId): AILearningStats;

  /**
   * Forget a pattern (remove from learning memory)
   */
  forgetPattern(patternId: string): Promise<void>;

  /**
   * Recalibrate confidence weights based on accumulated feedback
   */
  recalibrateWeights(agentId: AgentId): Promise<AIResult<WeightRecalibration>>;
}

// ─── Learning Outcome ─────────────────────────────────────────────────────

export interface LearningOutcome {
  readonly feedbackId: string;
  readonly agentId: AgentId;
  readonly patternsExtracted: number;
  readonly patternsReinforced: number;
  readonly patternsContradicted: number;
  readonly memoryEntriesCreated: MemoryEntryInput[];
  readonly weightAdjustments: WeightAdjustment[];
  readonly durationMs: number;
}

export interface BatchLearningOutcome {
  readonly totalProcessed: number;
  readonly successful: number;
  readonly failed: number;
  readonly patternsExtracted: number;
  readonly patternsReinforced: number;
  readonly memoryEntriesCreated: number;
  readonly durationMs: number;
  readonly outcomes: LearningOutcome[];
}

// ─── AI Learning Patterns ─────────────────────────────────────────────────

export interface AILearningPattern {
  readonly id: string;
  readonly kind: AILearningPatternKind;
  readonly agentId: AgentId;
  readonly taskType: AITaskType;
  readonly payload: AILearningPatternPayload;
  readonly confidence: number;
  readonly reinforcementCount: number;
  readonly contradictionCount: number;
  readonly isReliable: boolean;
  readonly firstLearnedAt: Date;
  readonly lastConfirmedAt: Date;
  readonly source: 'human-confirmation' | 'correction' | 'inference';
}

export type AILearningPatternKind =
  | 'naming-convention' // entity/field naming patterns for an ERP
  | 'structural-signature' // field composition that identifies an entity kind
  | 'type-heuristic' // type patterns that indicate field kinds
  | 'erp-prefix-stripping' // ERP-specific prefix/suffix to remove
  | 'abbreviation-expansion' // abbreviation → full word mapping
  | 'multilingual-synonym' // word in another language → CBL term
  | 'confidence-calibration' // agent overestimates/underestimates for context
  | 'conflict-resolution' // how a specific conflict type should be resolved
  | 'rejection-pattern'; // patterns that were consistently rejected

export type AILearningPatternPayload =
  | NamingConventionPattern
  | StructuralSignaturePattern
  | TypeHeuristicPattern
  | PrefixStrippingPattern
  | AbbreviationExpansionPattern
  | MultilingualSynonymPattern
  | ConfidenceCalibrationPattern
  | ConflictResolutionPattern
  | RejectionPattern;

export interface NamingConventionPattern {
  readonly kind: 'naming-convention';
  readonly erpProfileId: string;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly convention: string;
  readonly cblTermHint?: string;
}

export interface StructuralSignaturePattern {
  readonly kind: 'structural-signature';
  readonly requiredFieldNames: string[];
  readonly optionalFieldNames: string[];
  readonly cblEntityKind: string;
  readonly confidence: number;
}

export interface TypeHeuristicPattern {
  readonly kind: 'type-heuristic';
  readonly nativeType: string;
  readonly cblFieldKind: string;
  readonly confidence: number;
}

export interface PrefixStrippingPattern {
  readonly kind: 'erp-prefix-stripping';
  readonly erpProfileId: string;
  readonly prefix: string;
  readonly strippedBeforeAnalysis: boolean;
}

export interface AbbreviationExpansionPattern {
  readonly kind: 'abbreviation-expansion';
  readonly abbreviation: string;
  readonly expansion: string;
  readonly language: string;
  readonly erpProfileId?: string;
}

export interface MultilingualSynonymPattern {
  readonly kind: 'multilingual-synonym';
  readonly word: string;
  readonly language: string;
  readonly cblTermHint: string;
}

export interface ConfidenceCalibrationPattern {
  readonly kind: 'confidence-calibration';
  readonly agentId: AgentId;
  readonly contextSignature: string;
  readonly biasDirection: 'overconfident' | 'underconfident';
  readonly adjustmentFactor: number;
}

export interface ConflictResolutionPattern {
  readonly kind: 'conflict-resolution';
  readonly conflictType: string;
  readonly entityKind: string;
  readonly resolution: string;
  readonly successRate: number;
}

export interface RejectionPattern {
  readonly kind: 'rejection-pattern';
  readonly patternDescription: string;
  readonly cblTermAvoided: string;
  readonly context: string;
}

// ─── Weight Recalibration ─────────────────────────────────────────────────

export interface WeightAdjustment {
  readonly signalId: string;
  readonly previousWeight: number;
  readonly newWeight: number;
  readonly reason: string;
}

export interface WeightRecalibration {
  readonly agentId: AgentId;
  readonly adjustments: WeightAdjustment[];
  readonly basedOnFeedbackCount: number;
  readonly recalibratedAt: Date;
}

// ─── Learning Pattern Query ───────────────────────────────────────────────

export interface AILearningPatternQuery {
  readonly kinds?: AILearningPatternKind[];
  readonly agentIds?: AgentId[];
  readonly taskTypes?: AITaskType[];
  readonly minConfidence?: number;
  readonly isReliable?: boolean;
  readonly limit?: number;
}

// ─── Learning Stats ───────────────────────────────────────────────────────

export interface AILearningStats {
  readonly totalPatterns: number;
  readonly reliablePatterns: number;
  readonly contradictedPatterns: number;
  readonly patternsByKind: Partial<Record<AILearningPatternKind, number>>;
  readonly patternsByAgent: Partial<Record<string, number>>;
  readonly averageConfidence: number;
  readonly totalFeedbackProcessed: number;
  readonly lastLearnedAt?: Date;
}

// ─── Learning Store ───────────────────────────────────────────────────────

export interface AILearningStore {
  save(pattern: AILearningPattern): Promise<void>;
  getById(id: string): Promise<AILearningPattern | null>;
  findByKind(kind: AILearningPatternKind, limit?: number): Promise<AILearningPattern[]>;
  findByAgent(agentId: AgentId): Promise<AILearningPattern[]>;
  reinforce(id: string): Promise<void>;
  contradict(id: string): Promise<void>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
}
