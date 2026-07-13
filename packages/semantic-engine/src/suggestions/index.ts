/**
 * @seltriva/semantic-engine/suggestions
 * Suggestion System — packages semantic analysis results for human review
 *
 * After the SemanticAnalyzer produces candidates and the ConfidenceEngine
 * scores them, the Suggestion System assembles them into human-reviewable
 * suggestion objects. These go to the ValidationQueue or are auto-approved.
 *
 * A suggestion is not a mapping — it is a proposal. A mapping is a confirmed
 * suggestion.
 */

import type {
  CBLEntityTerm,
  CBLFieldTerm,
  CBLEntityKind,
  CBLFieldKind,
  CBLDomainKind,
  SemanticResult,
} from '../business-language/index';
import type { ConfidenceValue, ConfidenceTier } from '../confidence-engine/index';
import type { EntitySemanticCandidate, FieldSemanticCandidate } from '../semantic-analyzer/index';

// ─── Suggestion Engine ────────────────────────────────────────────────────

export interface SuggestionEngine {
  /**
   * Generate a suggestion bundle for an entity (entity + all its fields)
   */
  generateEntityBundle(
    entityName: string,
    candidates: EntitySemanticCandidate[],
    fieldCandidates: Record<string, FieldSemanticCandidate[]>,
    options?: SuggestionOptions
  ): SemanticResult<SuggestionBundle>;

  /**
   * Generate a single field suggestion
   */
  generateFieldSuggestion(
    fieldName: string,
    entityName: string,
    candidates: FieldSemanticCandidate[],
    options?: SuggestionOptions
  ): SemanticResult<FieldSuggestion>;

  /**
   * Re-generate suggestions for a previously rejected mapping
   */
  regenerate(
    suggestionId: string,
    feedback?: RejectionFeedback
  ): SemanticResult<SemanticSuggestion>;

  /**
   * Prioritize a list of bundles by urgency and confidence
   */
  prioritize(bundles: SuggestionBundle[]): SuggestionBundle[];
}

export interface SuggestionOptions {
  readonly maxAlternatives?: number;
  readonly includeAlternatives?: boolean;
  readonly erpProfileId?: string;
  readonly autoApproveThreshold?: ConfidenceValue;
}

// ─── Suggestion Bundle ────────────────────────────────────────────────────

/**
 * A bundle contains the entity suggestion and all field suggestions for that entity.
 * This is the unit of work presented to a human administrator for review.
 */
export interface SuggestionBundle {
  readonly id: string;
  readonly entitySuggestion: EntitySuggestion;
  readonly fieldSuggestions: FieldSuggestion[];
  readonly overallConfidence: ConfidenceValue;
  readonly overallTier: ConfidenceTier;
  readonly status: BundleStatus;
  readonly pendingCount: number;
  readonly autoApprovedCount: number;
  readonly rejectedCount: number;
  readonly createdAt: Date;
  readonly expiresAt?: Date;
}

export type BundleStatus = 'pending' | 'partial' | 'complete' | 'rejected' | 'expired';

// ─── Semantic Suggestion ──────────────────────────────────────────────────

export type SemanticSuggestion = EntitySuggestion | FieldSuggestion;

// ─── Entity Suggestion ────────────────────────────────────────────────────

export interface EntitySuggestion {
  readonly kind: 'entity';
  readonly id: string;
  readonly entityName: string;
  readonly proposedTerm: CBLEntityTerm;
  readonly proposedKind: CBLEntityKind;
  readonly domain: CBLDomainKind;
  readonly confidence: ConfidenceValue;
  readonly confidenceTier: ConfidenceTier;
  readonly confidencePercentage: number;
  readonly alternatives: EntityAlternative[];
  readonly status: SuggestionStatus;
  readonly isAutoApproved: boolean;
  readonly explanation: string;
  readonly evidenceSummary: string[];
  readonly dictionaryPreview?: EntityDefinitionPreview;
  readonly bundleId?: string;
  readonly createdAt: Date;
  readonly reviewedAt?: Date;
  readonly reviewedBy?: string;
}

export interface EntityAlternative {
  readonly rank: number;
  readonly term: CBLEntityTerm;
  readonly entityKind: CBLEntityKind;
  readonly confidence: ConfidenceValue;
  readonly reason: string;
}

export interface EntityDefinitionPreview {
  readonly name: string;
  readonly description: string;
  readonly examples: string[];
}

// ─── Field Suggestion ─────────────────────────────────────────────────────

export interface FieldSuggestion {
  readonly kind: 'field';
  readonly id: string;
  readonly fieldName: string;
  readonly entityName: string;
  readonly entityTerm?: CBLEntityTerm;
  readonly proposedTerm: CBLFieldTerm;
  readonly proposedKind: CBLFieldKind;
  readonly domain: CBLDomainKind;
  readonly confidence: ConfidenceValue;
  readonly confidenceTier: ConfidenceTier;
  readonly confidencePercentage: number;
  readonly alternatives: FieldAlternative[];
  readonly status: SuggestionStatus;
  readonly isAutoApproved: boolean;
  readonly explanation: string;
  readonly evidenceSummary: string[];
  readonly dictionaryPreview?: FieldDefinitionPreview;
  readonly bundleId?: string;
  readonly createdAt: Date;
  readonly reviewedAt?: Date;
  readonly reviewedBy?: string;
}

export interface FieldAlternative {
  readonly rank: number;
  readonly term: CBLFieldTerm;
  readonly fieldKind: CBLFieldKind;
  readonly confidence: ConfidenceValue;
  readonly reason: string;
}

export interface FieldDefinitionPreview {
  readonly name: string;
  readonly description: string;
  readonly typicalTypes: string[];
  readonly examples: string[];
}

// ─── Suggestion Status ────────────────────────────────────────────────────

export type SuggestionStatus =
  | 'pending-review'
  | 'auto-approved'
  | 'confirmed'
  | 'rejected'
  | 'modified'
  | 'superseded';

// ─── Rejection Feedback ───────────────────────────────────────────────────

export interface RejectionFeedback {
  readonly reason?: RejectionReason;
  readonly note?: string;
  readonly suggestedTerm?: CBLEntityTerm | CBLFieldTerm;
}

export type RejectionReason =
  | 'wrong-concept'
  | 'wrong-domain'
  | 'ambiguous'
  | 'not-a-business-field'
  | 'technical-field-only'
  | 'other';

// ─── Suggestion Store ─────────────────────────────────────────────────────

export interface SuggestionStore {
  save(suggestion: SemanticSuggestion): Promise<SemanticResult<string>>;
  getById(id: string): Promise<SemanticResult<SemanticSuggestion | null>>;
  getBundle(bundleId: string): Promise<SemanticResult<SuggestionBundle | null>>;
  listPending(options?: SuggestionListOptions): Promise<SemanticResult<SemanticSuggestion[]>>;
  updateStatus(
    id: string,
    status: SuggestionStatus,
    reviewedBy?: string
  ): Promise<SemanticResult<void>>;
  delete(id: string): Promise<SemanticResult<void>>;
}

export interface SuggestionListOptions {
  readonly entityName?: string;
  readonly status?: SuggestionStatus;
  readonly minConfidence?: ConfidenceValue;
  readonly kind?: 'entity' | 'field';
  readonly limit?: number;
  readonly offset?: number;
}

// ─── Suggestion Prioritizer ───────────────────────────────────────────────

/**
 * Determines the order in which suggestions are presented for review.
 * Higher priority = shown first to the administrator.
 */
export interface SuggestionPrioritizer {
  /**
   * Assign a priority score to a suggestion bundle
   */
  priorityScore(bundle: SuggestionBundle): number;

  /**
   * Sort bundles by priority (highest first)
   */
  sort(bundles: SuggestionBundle[]): SuggestionBundle[];
}

// ─── Suggestion Formatter ────────────────────────────────────────────────

/**
 * Formats a suggestion for human consumption in various presentation contexts.
 */
export interface SuggestionFormatter {
  formatEntitySuggestion(suggestion: EntitySuggestion): FormattedSuggestion;
  formatFieldSuggestion(suggestion: FieldSuggestion): FormattedSuggestion;
  formatBundle(bundle: SuggestionBundle): FormattedBundle;
}

export interface FormattedSuggestion {
  readonly title: string;
  readonly summary: string;
  readonly confidenceLabel: string;
  readonly evidenceBullets: string[];
  readonly alternativesList: string[];
  readonly dictionaryExcerpt?: string;
}

export interface FormattedBundle {
  readonly title: string;
  readonly entitySuggestion: FormattedSuggestion;
  readonly fieldSuggestions: FormattedSuggestion[];
  readonly overallSummary: string;
}
