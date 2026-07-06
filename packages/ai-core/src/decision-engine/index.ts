/**
 * @seltriva/ai-core/decision-engine
 * Decision Engine — validates and gates all AI recommendations
 *
 * INVARIANT: AI never executes. AI only recommends.
 * The Decision Engine is the boundary between AI suggestions and real actions.
 *
 * Responsibilities:
 *   1. Validate that a recommendation meets quality thresholds
 *   2. Apply business constraints (no auto-approve for destructive changes)
 *   3. Route to human review or auto-approve based on rules
 *   4. Produce a signed DecisionRecord for every recommendation
 *   5. Emit decision events for audit and learning
 *
 * Nothing in the system executes an integration action without a
 * signed DecisionRecord. The application layer checks this record.
 */

import type {
  AIResult, DecisionId, RecommendationId, AgentId, AIConfidenceValue, SessionId,
} from '../providers/index';
import type { AIRecommendation, RecommendationKind, RecommendationPriority } from '../recommendations/index';
import type { Explanation } from '../explainability/index';

// ─── Decision Engine ──────────────────────────────────────────────────────

export interface DecisionEngine {
  /**
   * Evaluate a single recommendation and produce a decision record.
   * This is the primary entry point — every recommendation passes through here.
   */
  evaluate(recommendation: AIRecommendation): Promise<AIResult<DecisionRecord>>;

  /**
   * Evaluate a batch of recommendations
   */
  evaluateBatch(recommendations: AIRecommendation[]): Promise<AIResult<DecisionRecord[]>>;

  /**
   * Approve a pending decision (human action)
   */
  approve(decisionId: DecisionId, approval: DecisionApproval): Promise<AIResult<DecisionRecord>>;

  /**
   * Reject a pending decision (human action)
   */
  reject(decisionId: DecisionId, rejection: DecisionRejection): Promise<AIResult<DecisionRecord>>;

  /**
   * Modify a pending decision before approving (human action)
   */
  modify(decisionId: DecisionId, modification: DecisionModification): Promise<AIResult<DecisionRecord>>;

  /**
   * Auto-approve all decisions above a confidence threshold in a session
   */
  bulkApprove(sessionId: SessionId, minConfidence: number, approvedBy: string): Promise<BulkDecisionResult>;

  /**
   * Get a decision record by ID
   */
  getDecision(decisionId: DecisionId): Promise<DecisionRecord | null>;

  /**
   * Get all pending decisions
   */
  getPending(filter?: DecisionFilter): Promise<DecisionRecord[]>;

  /**
   * Revoke a previously approved decision
   */
  revoke(decisionId: DecisionId, reason: string, revokedBy: string): Promise<AIResult<void>>;

  /**
   * Statistics about current decision state
   */
  getStats(): DecisionStats;

  /**
   * Register a custom decision rule
   */
  registerRule(rule: DecisionRule): void;
}

// ─── Decision Record ──────────────────────────────────────────────────────

/**
 * The signed record that authorizes (or denies) an AI recommendation.
 * Application code must check this record before executing any action.
 */
export interface DecisionRecord {
  readonly id: DecisionId;
  readonly recommendationId: RecommendationId;
  readonly agentId: AgentId;
  readonly kind: RecommendationKind;

  /** The validated recommendation */
  readonly recommendation: AIRecommendation;

  /** The outcome */
  readonly outcome: DecisionOutcome;

  /** How the decision was made */
  readonly decisionMethod: DecisionMethod;

  /** Violations of decision rules */
  readonly ruleViolations: DecisionRuleViolation[];

  /** Required review queue entry (if pending) */
  readonly reviewEntry?: DecisionReviewEntry;

  /** Human review result (if reviewed) */
  readonly review?: DecisionReview;

  /** Whether this decision can be used to trigger an action */
  readonly isActionable: boolean;

  /** Cryptographic signature (implementation-defined) */
  readonly signature?: string;

  readonly createdAt: Date;
  readonly decidedAt?: Date;
  readonly expiresAt?: Date;
}

// ─── Decision Outcome ─────────────────────────────────────────────────────

export type DecisionOutcome =
  | 'auto-approved'       // confidence above threshold, no blocking rules
  | 'pending-review'      // queued for human review
  | 'approved'            // human reviewed and approved
  | 'rejected'            // human reviewed and rejected
  | 'modified-approved'   // human modified and approved
  | 'revoked'             // previously approved, now revoked
  | 'blocked';            // blocked by a decision rule (cannot proceed)

export type DecisionMethod =
  | 'auto'          // fully automatic (high confidence, low risk)
  | 'human-review'  // required human review
  | 'forced-manual' // rule forced human review regardless of confidence
  | 'bulk-approval' // approved as part of bulk action;

// ─── Decision Rules ───────────────────────────────────────────────────────

/**
 * Decision rules control whether a recommendation requires human review.
 * Default rules: destructive changes always require human review.
 */
export interface DecisionRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly priority: number;

  /**
   * Evaluate whether this rule applies and what it requires
   */
  evaluate(recommendation: AIRecommendation): DecisionRuleResult;
}

export interface DecisionRuleResult {
  readonly applies: boolean;
  readonly action: 'allow' | 'require-review' | 'block';
  readonly reason?: string;
  readonly overridesConfidence?: boolean;
}

export interface DecisionRuleViolation {
  readonly ruleId: string;
  readonly ruleName: string;
  readonly action: 'require-review' | 'block';
  readonly reason: string;
}

export const DECISION_RULE_IDS = {
  // Always require human for destructive changes
  REQUIRE_REVIEW_FOR_DESTRUCTIVE:   'rule-require-review-destructive',
  // Block decisions with insufficient confidence
  MIN_CONFIDENCE_THRESHOLD:         'rule-min-confidence',
  // Require review for entity removals
  REQUIRE_REVIEW_FOR_ENTITY_REMOVAL: 'rule-require-entity-removal',
  // Block changes to confirmed mappings without reasoning chain
  REQUIRE_REASONING_FOR_CONFIRMED:  'rule-require-reasoning-confirmed',
  // Require review for security classification changes
  REQUIRE_REVIEW_FOR_SECURITY:      'rule-require-review-security',
  // Block expired recommendations
  REJECT_EXPIRED:                   'rule-reject-expired',
} as const;

// ─── Decision Thresholds ──────────────────────────────────────────────────

export interface DecisionThresholds {
  readonly autoApprove: AIConfidenceValue;
  readonly requiresReview: AIConfidenceValue;
  readonly block: AIConfidenceValue;
}

export const DEFAULT_DECISION_THRESHOLDS: DecisionThresholds = {
  autoApprove: 0.92,
  requiresReview: 0.55,
  block: 0.20,
};

// ─── Human Review ─────────────────────────────────────────────────────────

export interface DecisionReviewEntry {
  readonly decisionId: DecisionId;
  readonly reason: string;
  readonly priority: RecommendationPriority;
  readonly assignedTo?: string;
  readonly deadline?: Date;
  readonly submittedAt: Date;
}

export interface DecisionReview {
  readonly decisionId: DecisionId;
  readonly reviewer: string;
  readonly action: 'approve' | 'reject' | 'modify';
  readonly note?: string;
  readonly reviewedAt: Date;
}

export interface DecisionApproval {
  readonly reviewer: string;
  readonly note?: string;
}

export interface DecisionRejection {
  readonly reviewer: string;
  readonly reason: string;
  readonly feedback?: string;
}

export interface DecisionModification {
  readonly reviewer: string;
  readonly correctedPayload: Record<string, unknown>;
  readonly note?: string;
}

// ─── Bulk Operations ──────────────────────────────────────────────────────

export interface BulkDecisionResult {
  readonly approvedCount: number;
  readonly skippedCount: number;
  readonly totalProcessed: number;
  readonly approvedDecisionIds: DecisionId[];
  readonly skippedDecisionIds: DecisionId[];
}

// ─── Filter / Stats ───────────────────────────────────────────────────────

export interface DecisionFilter {
  readonly outcomes?: DecisionOutcome[];
  readonly agentIds?: AgentId[];
  readonly kinds?: RecommendationKind[];
  readonly sessionId?: SessionId;
  readonly createdAfter?: Date;
  readonly createdBefore?: Date;
  readonly isActionable?: boolean;
}

export interface DecisionStats {
  readonly totalDecisions: number;
  readonly byOutcome: Readonly<Record<DecisionOutcome, number>>;
  readonly pendingReviewCount: number;
  readonly autoApprovalRate: number;
  readonly humanApprovalRate: number;
  readonly rejectionRate: number;
  readonly averageConfidenceAtAutoApproval: number;
}

// ─── Decision Store ───────────────────────────────────────────────────────

export interface DecisionStore {
  save(record: DecisionRecord): Promise<void>;
  getById(id: DecisionId): Promise<DecisionRecord | null>;
  findPending(limit?: number): Promise<DecisionRecord[]>;
  findByRecommendation(recommendationId: RecommendationId): Promise<DecisionRecord | null>;
  findBySession(sessionId: SessionId): Promise<DecisionRecord[]>;
  update(record: DecisionRecord): Promise<void>;
  count(filter?: DecisionFilter): Promise<number>;
}

// ─── Decision Notifier ────────────────────────────────────────────────────

export interface DecisionNotifier {
  onDecisionCreated(record: DecisionRecord): void;
  onDecisionReviewed(record: DecisionRecord): void;
  onDecisionRevoked(record: DecisionRecord): void;
  onReviewRequired(entry: DecisionReviewEntry): void;
}

// ─── Decision Report ──────────────────────────────────────────────────────

export interface DecisionReport {
  readonly sessionId?: SessionId;
  readonly period?: { from: Date; to: Date };
  readonly totalDecisions: number;
  readonly approved: number;
  readonly rejected: number;
  readonly pending: number;
  readonly blocked: number;
  readonly autoApprovalRate: number;
  readonly averageReviewTimeMs?: number;
  readonly topRuleViolations: Array<{ ruleId: string; count: number }>;
  readonly decisions: DecisionRecord[];
}
