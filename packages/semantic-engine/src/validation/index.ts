/**
 * @seltriva/semantic-engine/validation
 * Human Validation Workflow — administrator approval of semantic suggestions
 *
 * The USME never learns without human confirmation.
 * All suggestions go through the validation workflow:
 *
 *   SuggestionEngine → ValidationQueue → Administrator decision
 *                                         ├── Confirm  → LearningEngine.learn()
 *                                         ├── Reject   → RejectionStore + feedback
 *                                         └── Modify   → New mapping + LearningEngine.learn()
 *
 * Auto-approved suggestions (confidence >= autoApproveThreshold) skip the queue
 * but are still recorded and can be revoked.
 */

import type { SemanticResult } from '../business-language/index';
import type { CBLEntityTerm, CBLFieldTerm } from '../business-language/index';
import type { ConfidenceValue } from '../confidence-engine/index';
import type { SemanticSuggestion, SuggestionBundle, RejectionFeedback } from '../suggestions/index';

// ─── Validation Workflow ──────────────────────────────────────────────────

export interface ValidationWorkflow {
  /**
   * Submit a suggestion bundle to the validation queue
   */
  submit(bundle: SuggestionBundle): Promise<SemanticResult<ValidationRequest>>;

  /**
   * Submit a single suggestion
   */
  submitSuggestion(suggestion: SemanticSuggestion): Promise<SemanticResult<ValidationRequest>>;

  /**
   * Record an administrator decision for a validation request
   */
  decide(
    requestId: string,
    decision: ValidationDecision
  ): Promise<SemanticResult<ValidationOutcome>>;

  /**
   * Bulk decide — confirm all high-confidence suggestions in a bundle
   */
  confirmAllAboveThreshold(
    bundleId: string,
    threshold: ConfidenceValue,
    reviewer: string
  ): Promise<SemanticResult<BulkDecisionResult>>;

  /**
   * Reject an entire bundle
   */
  rejectBundle(
    bundleId: string,
    reviewer: string,
    feedback?: RejectionFeedback
  ): Promise<SemanticResult<void>>;

  /**
   * Get the validation queue (pending requests)
   */
  getQueue(filter?: ValidationQueueFilter): Promise<SemanticResult<ValidationRequest[]>>;

  /**
   * Get the history of decisions
   */
  getHistory(filter?: ValidationHistoryFilter): Promise<SemanticResult<ValidationRecord[]>>;

  /**
   * Revoke a previously confirmed mapping
   */
  revoke(mappingId: string, revokedBy: string, reason?: string): Promise<SemanticResult<void>>;
}

// ─── Validation Request ───────────────────────────────────────────────────

export interface ValidationRequest {
  readonly id: string;
  readonly kind: 'entity' | 'field' | 'bundle';
  readonly suggestion: SemanticSuggestion | null;
  readonly bundle: SuggestionBundle | null;
  readonly status: ValidationStatus;
  readonly priority: number;
  readonly assignedTo?: string;
  readonly submittedAt: Date;
  readonly deadline?: Date;
  readonly contextNotes?: string;
}

export type ValidationStatus =
  | 'queued'
  | 'in-review'
  | 'confirmed'
  | 'rejected'
  | 'modified'
  | 'auto-approved'
  | 'expired'
  | 'revoked';

// ─── Validation Decision ──────────────────────────────────────────────────

export type ValidationDecision = ConfirmDecision | RejectDecision | ModifyDecision;

export interface ConfirmDecision {
  readonly action: 'confirm';
  readonly requestId: string;
  readonly reviewer: string;
  readonly note?: string;
}

export interface RejectDecision {
  readonly action: 'reject';
  readonly requestId: string;
  readonly reviewer: string;
  readonly feedback: RejectionFeedback;
}

export interface ModifyDecision {
  readonly action: 'modify';
  readonly requestId: string;
  readonly reviewer: string;
  readonly correctedTerm: CBLEntityTerm | CBLFieldTerm;
  readonly note?: string;
}

// ─── Validation Outcome ───────────────────────────────────────────────────

export interface ValidationOutcome {
  readonly requestId: string;
  readonly decision: ValidationDecision;
  readonly resultingMappingId?: string;
  readonly learningTriggered: boolean;
  readonly decidedAt: Date;
}

export interface BulkDecisionResult {
  readonly bundleId: string;
  readonly confirmedCount: number;
  readonly skippedCount: number;
  readonly failedCount: number;
  readonly learningTriggered: boolean;
}

// ─── Validation Record ────────────────────────────────────────────────────

export interface ValidationRecord {
  readonly id: string;
  readonly requestId: string;
  readonly suggestionId?: string;
  readonly bundleId?: string;
  readonly action: 'confirm' | 'reject' | 'modify' | 'auto-approve' | 'revoke';
  readonly reviewer?: string;
  readonly originalTerm?: string;
  readonly confirmedTerm?: string;
  readonly feedback?: RejectionFeedback;
  readonly note?: string;
  readonly createdAt: Date;
}

// ─── Queue Filters ────────────────────────────────────────────────────────

export interface ValidationQueueFilter {
  readonly status?: ValidationStatus;
  readonly kind?: 'entity' | 'field' | 'bundle';
  readonly assignedTo?: string;
  readonly minConfidence?: ConfidenceValue;
  readonly maxConfidence?: ConfidenceValue;
  readonly overdueOnly?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ValidationHistoryFilter {
  readonly reviewer?: string;
  readonly action?: 'confirm' | 'reject' | 'modify' | 'auto-approve' | 'revoke';
  readonly from?: Date;
  readonly to?: Date;
  readonly limit?: number;
}

// ─── Validation Queue ─────────────────────────────────────────────────────

export interface ValidationQueue {
  enqueue(request: ValidationRequest): Promise<SemanticResult<void>>;
  dequeue(): Promise<SemanticResult<ValidationRequest | null>>;
  peek(n?: number): Promise<SemanticResult<ValidationRequest[]>>;
  remove(requestId: string): Promise<SemanticResult<void>>;
  size(): Promise<number>;
  clear(): Promise<SemanticResult<void>>;
}

// ─── Validation Statistics ────────────────────────────────────────────────

export interface ValidationStatistics {
  readonly totalRequests: number;
  readonly pendingRequests: number;
  readonly confirmedCount: number;
  readonly rejectedCount: number;
  readonly modifiedCount: number;
  readonly autoApprovedCount: number;
  readonly averageReviewTimeMs?: number;
  readonly byReviewer: Record<string, number>;
}

export interface ValidationStatisticsProvider {
  getStatistics(): Promise<ValidationStatistics>;
  getStatisticsForPeriod(from: Date, to: Date): Promise<ValidationStatistics>;
}

// ─── Validation Notifier ──────────────────────────────────────────────────

/**
 * Interface for notifying administrators when new requests arrive.
 * Implementations may send emails, webhooks, or in-app notifications.
 */
export interface ValidationNotifier {
  notifyNewRequest(request: ValidationRequest): Promise<void>;
  notifyBundleReady(bundle: SuggestionBundle): Promise<void>;
  notifyQueueThreshold(pendingCount: number, threshold: number): Promise<void>;
}
