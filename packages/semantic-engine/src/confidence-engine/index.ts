/**
 * @seltriva/semantic-engine/confidence-engine
 * Confidence Engine — scores every semantic suggestion
 *
 * Every mapping suggestion in the USME carries a confidence score.
 * This module defines how that score is computed, combined, and thresholded.
 *
 * Confidence is computed from multiple signals (evidence):
 * - Name similarity to known CBL aliases
 * - Structural match (field type, nullable, role)
 * - Positional context (entity neighborhood)
 * - ERP profile match (known naming for this ERP)
 * - Learning history (previously confirmed mappings)
 * - Knowledge graph coherence (graph says this entity should have this field)
 *
 * The final score is a weighted aggregate of all active signals.
 */

import type {
  CBLTerm,
  CBLEntityTerm,
  CBLFieldTerm,
  CBLEntityKind,
  CBLFieldKind,
} from '../business-language/index';

// ─── Confidence Score ─────────────────────────────────────────────────────

/** A confidence value from 0.0 (none) to 1.0 (certain) */
export type ConfidenceValue = number;

/** Human-readable confidence tier */
export type ConfidenceTier =
  | 'certain' // 0.97 – 1.00
  | 'very-high' // 0.90 – 0.96
  | 'high' // 0.80 – 0.89
  | 'medium' // 0.65 – 0.79
  | 'low' // 0.45 – 0.64
  | 'very-low' // 0.20 – 0.44
  | 'insufficient'; // < 0.20

// ─── Confidence Engine ────────────────────────────────────────────────────

export interface ConfidenceEngine {
  /**
   * Compute a confidence score for mapping a source name to a CBL term
   */
  score(input: ConfidenceInput): ConfidenceScore;

  /**
   * Compute scores for all candidates and return them ranked
   */
  rank(input: ConfidenceRankingInput): RankedConfidenceScore[];

  /**
   * Compute the confidence that a set of field mappings for an entity is coherent
   */
  scoreEntityCoherence(entityName: string, fieldMappings: FieldMappingCandidate[]): ConfidenceScore;

  /**
   * Returns the tier for a given confidence value
   */
  tier(value: ConfidenceValue): ConfidenceTier;

  /**
   * Register a custom signal provider
   */
  registerSignal(signal: ConfidenceSignalProvider): void;

  /**
   * Retrieve the active signal providers
   */
  getSignals(): ConfidenceSignalProvider[];
}

// ─── Confidence Input ─────────────────────────────────────────────────────

export interface ConfidenceInput {
  /** The source identifier to evaluate (field name or entity name) */
  readonly sourceName: string;
  readonly originalName?: string;

  /** The CBL candidate term being evaluated */
  readonly candidateTerm: CBLTerm;
  readonly candidateKind: 'entity' | 'field';

  /** Available signals / context */
  readonly signals: ConfidenceSignal[];

  /** Override weights (otherwise the engine uses defaults) */
  readonly weights?: Partial<ConfidenceWeights>;
}

export interface ConfidenceRankingInput {
  readonly sourceName: string;
  readonly originalName?: string;
  readonly candidates: Array<{ term: CBLTerm; kind: 'entity' | 'field' }>;
  readonly signals: ConfidenceSignal[];
  readonly weights?: Partial<ConfidenceWeights>;
  readonly maxResults?: number;
}

export interface FieldMappingCandidate {
  readonly sourceName: string;
  readonly candidateTerm: CBLFieldTerm;
}

// ─── Confidence Score ─────────────────────────────────────────────────────

export interface ConfidenceScore {
  readonly value: ConfidenceValue;
  readonly tier: ConfidenceTier;
  readonly percentage: number;
  readonly signals: ScoredSignal[];
  readonly explanation: string;
  readonly isAutoApprovable: boolean;
  readonly requiresReview: boolean;
}

export interface RankedConfidenceScore extends ConfidenceScore {
  readonly rank: number;
  readonly term: CBLTerm;
}

export interface ScoredSignal {
  readonly signalId: string;
  readonly signalName: string;
  readonly contribution: ConfidenceValue;
  readonly weight: ConfidenceValue;
  readonly detail: string;
}

// ─── Confidence Signals ───────────────────────────────────────────────────

/**
 * A pluggable signal that contributes to confidence scoring.
 * Each signal evaluates one dimension of evidence.
 */
export interface ConfidenceSignalProvider {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly defaultWeight: ConfidenceValue;

  /**
   * Evaluate the signal for the given input.
   * Returns a contribution value 0–1 and an explanation.
   */
  evaluate(input: ConfidenceInput): ConfidenceSignal;
}

export interface ConfidenceSignal {
  readonly providerId: string;
  readonly value: ConfidenceValue;
  readonly detail: string;
  readonly evidence?: string[];
}

// ─── Built-in Signal IDs ─────────────────────────────────────────────────

export const SIGNAL_IDS = {
  NAME_SIMILARITY: 'signal-name-similarity',
  ALIAS_MATCH: 'signal-alias-match',
  TYPE_MATCH: 'signal-type-match',
  ROLE_MATCH: 'signal-role-match',
  STRUCTURAL_MATCH: 'signal-structural-match',
  ERP_PROFILE: 'signal-erp-profile',
  LEARNING_HISTORY: 'signal-learning-history',
  GRAPH_COHERENCE: 'signal-graph-coherence',
  POSITION_CONTEXT: 'signal-position-context',
  SYNONYM_MATCH: 'signal-synonym-match',
  PATTERN_FREQUENCY: 'signal-pattern-frequency',
} as const;

export type SignalId = (typeof SIGNAL_IDS)[keyof typeof SIGNAL_IDS];

// ─── Confidence Weights ───────────────────────────────────────────────────

export interface ConfidenceWeights {
  readonly nameSimilarity: ConfidenceValue;
  readonly aliasMatch: ConfidenceValue;
  readonly typeMatch: ConfidenceValue;
  readonly roleMatch: ConfidenceValue;
  readonly structuralMatch: ConfidenceValue;
  readonly erpProfile: ConfidenceValue;
  readonly learningHistory: ConfidenceValue;
  readonly graphCoherence: ConfidenceValue;
  readonly positionContext: ConfidenceValue;
  readonly synonymMatch: ConfidenceValue;
}

export const DEFAULT_CONFIDENCE_WEIGHTS: ConfidenceWeights = {
  nameSimilarity: 0.3,
  aliasMatch: 0.2,
  typeMatch: 0.1,
  roleMatch: 0.1,
  structuralMatch: 0.1,
  erpProfile: 0.08,
  learningHistory: 0.05,
  graphCoherence: 0.04,
  positionContext: 0.02,
  synonymMatch: 0.01,
};

// ─── Confidence Thresholds ────────────────────────────────────────────────

/**
 * Configurable thresholds that determine auto-approval vs. review requirements.
 */
export interface ConfidenceThresholds {
  /** >= this → auto-approved, no human review needed */
  readonly autoApprove: ConfidenceValue;

  /** >= this → presented to human as a "high confidence suggestion" */
  readonly highConfidence: ConfidenceValue;

  /** >= this → presented to human as a "normal suggestion" */
  readonly suggest: ConfidenceValue;

  /** < this → suppressed (too low to show) */
  readonly suppress: ConfidenceValue;
}

export const DEFAULT_CONFIDENCE_THRESHOLDS: ConfidenceThresholds = {
  autoApprove: 0.97,
  highConfidence: 0.8,
  suggest: 0.45,
  suppress: 0.2,
};

// ─── Confidence Aggregator ────────────────────────────────────────────────

/**
 * Aggregates multiple signals into a final score using weighted average.
 */
export interface ConfidenceAggregator {
  aggregate(
    signals: ConfidenceSignal[],
    weights: ConfidenceWeights,
    providers: ConfidenceSignalProvider[]
  ): ConfidenceValue;
}

// ─── Entity-level Confidence ──────────────────────────────────────────────

export interface EntityConfidenceReport {
  readonly entityName: string;
  readonly candidateTerm: CBLEntityTerm;
  readonly entityKind: CBLEntityKind;
  readonly score: ConfidenceScore;
  readonly fieldScores: FieldConfidenceScore[];
  readonly coherenceScore: ConfidenceValue;
  readonly overallScore: ConfidenceValue;
  readonly tier: ConfidenceTier;
}

export interface FieldConfidenceScore {
  readonly fieldName: string;
  readonly candidateTerm: CBLFieldTerm;
  readonly fieldKind: CBLFieldKind;
  readonly score: ConfidenceScore;
}
