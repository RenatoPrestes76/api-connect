/**
 * @seltriva/semantic-engine/learning
 * Semantic Learning Engine — learns semantic mappings from confirmed decisions
 *
 * INVARIANT: The learning engine NEVER processes or stores business data.
 * It only learns from structural metadata:
 *   - "The column named CODPROD in a table named B1_SB1 maps to FIELD_PRODUCT_CODE"
 *   - "The entity named B1_SB1 maps to ENTITY_PRODUCT"
 *   - "In SAP B1 contexts, column ITMSGRP maps to FIELD_CATEGORY"
 *
 * Learning happens only after a ValidationWorkflow.decide() confirms a mapping.
 * The engine extracts patterns from confirmed mappings and stores them in the
 * LearningMemory, which feeds back into the ConfidenceEngine on future analyses.
 */

import type {
  CBLEntityTerm,
  CBLFieldTerm,
  CBLEntityKind,
  CBLFieldKind,
  CBLDomainKind,
  SemanticResult,
} from '../business-language/index';
import type { ConfidenceValue } from '../confidence-engine/index';
import type { SemanticMapping } from '../mapping-engine/index';

// ─── Semantic Learner ─────────────────────────────────────────────────────

export interface SemanticLearner {
  /**
   * Record a confirmed mapping and extract learnable patterns
   */
  learn(
    mapping: SemanticMapping,
    session?: LearningSession
  ): Promise<SemanticResult<LearningOutcome>>;

  /**
   * Batch-learn from a set of confirmed mappings (e.g., after bulk approval)
   */
  learnBatch(
    mappings: SemanticMapping[],
    session?: LearningSession
  ): Promise<SemanticResult<BatchLearningOutcome>>;

  /**
   * Query patterns that match a given source name
   */
  queryPatterns(sourceName: string, options?: PatternQueryOptions): Promise<SemanticResult<LearningPattern[]>>;

  /**
   * Retrieve all patterns in the memory
   */
  getAllPatterns(filter?: PatternFilter): Promise<SemanticResult<LearningPattern[]>>;

  /**
   * Remove a pattern (e.g., if the confirmed mapping was later revoked)
   */
  forgetPattern(patternId: string): Promise<SemanticResult<void>>;

  /**
   * Get the learning memory statistics
   */
  getStats(): LearningMemoryStats;
}

// ─── Learning Session ─────────────────────────────────────────────────────

export interface LearningSession {
  readonly id: string;
  readonly erpProfileId?: string;
  readonly domain?: CBLDomainKind;
  readonly learnNamePatterns?: boolean;
  readonly learnStructurePatterns?: boolean;
  readonly learnRelationshipPatterns?: boolean;
  readonly propagateToProfile?: boolean;
  readonly metadata?: Record<string, unknown>;
}

// ─── Learning Outcome ─────────────────────────────────────────────────────

export interface LearningOutcome {
  readonly mappingId: string;
  readonly newPatterns: LearningPattern[];
  readonly reinforcedPatterns: LearningPattern[];
  readonly profileUpdated: boolean;
  readonly durationMs: number;
}

export interface BatchLearningOutcome {
  readonly sessionId: string;
  readonly processedMappings: number;
  readonly newPatterns: LearningPattern[];
  readonly reinforcedPatterns: LearningPattern[];
  readonly profilesUpdated: string[];
  readonly durationMs: number;
}

// ─── Learning Patterns ────────────────────────────────────────────────────

export interface LearningPattern {
  readonly id: string;
  readonly kind: LearningPatternKind;
  readonly payload: LearningPatternPayload;
  readonly cblTerm: CBLEntityTerm | CBLFieldTerm;
  readonly confidence: ConfidenceValue;
  readonly frequency: number;
  readonly erpProfileId?: string;
  readonly domain?: CBLDomainKind;
  readonly firstLearnedAt: Date;
  readonly lastConfirmedAt: Date;
  readonly metadata?: Record<string, unknown>;
}

export type LearningPatternKind =
  | 'exact-name-match'
  | 'name-prefix-match'
  | 'name-suffix-match'
  | 'name-contains-match'
  | 'abbreviation-expansion'
  | 'multilingual-synonym'
  | 'structural-signature'
  | 'erp-convention'
  | 'field-cooccurrence';

export type LearningPatternPayload =
  | ExactNamePattern
  | NamePrefixPattern
  | NameSuffixPattern
  | NameContainsPattern
  | AbbreviationPattern
  | MultilingualSynonymPattern
  | StructuralSignaturePattern
  | ERPConventionPattern
  | FieldCooccurrencePattern;

export interface ExactNamePattern {
  readonly kind: 'exact-name-match';
  readonly sourceName: string;
}

export interface NamePrefixPattern {
  readonly kind: 'name-prefix-match';
  readonly prefix: string;
  readonly remainderContains?: string;
}

export interface NameSuffixPattern {
  readonly kind: 'name-suffix-match';
  readonly suffix: string;
}

export interface NameContainsPattern {
  readonly kind: 'name-contains-match';
  readonly substring: string;
  readonly minNameLength?: number;
}

export interface AbbreviationPattern {
  readonly kind: 'abbreviation-expansion';
  readonly abbreviation: string;
  readonly expansion: string;
  readonly language?: string;
}

export interface MultilingualSynonymPattern {
  readonly kind: 'multilingual-synonym';
  readonly foreignTerm: string;
  readonly language: string;
  readonly cblAlias: string;
}

export interface StructuralSignaturePattern {
  readonly kind: 'structural-signature';
  readonly entityKind: CBLEntityKind;
  readonly requiredFieldPatterns: string[];
  readonly optionalFieldPatterns: string[];
  readonly minMatchCount: number;
}

export interface ERPConventionPattern {
  readonly kind: 'erp-convention';
  readonly erpProfileId: string;
  readonly conventionType: 'prefix' | 'suffix' | 'exact' | 'format';
  readonly pattern: string;
}

export interface FieldCooccurrencePattern {
  readonly kind: 'field-cooccurrence';
  readonly anchorFieldKind: CBLFieldKind;
  readonly cooccurringFieldKind: CBLFieldKind;
  readonly entityKind?: CBLEntityKind;
  readonly cooccurrenceFrequency: number;
}

// ─── Learning Memory ──────────────────────────────────────────────────────

export interface LearningMemory {
  save(pattern: LearningPattern): Promise<SemanticResult<void>>;
  get(patternId: string): Promise<SemanticResult<LearningPattern | null>>;
  findBySourceName(name: string, erpProfileId?: string): Promise<SemanticResult<LearningPattern[]>>;
  findByCBLTerm(term: CBLEntityTerm | CBLFieldTerm): Promise<SemanticResult<LearningPattern[]>>;
  findByKind(kind: LearningPatternKind): Promise<SemanticResult<LearningPattern[]>>;
  reinforce(patternId: string): Promise<SemanticResult<void>>;
  delete(patternId: string): Promise<SemanticResult<void>>;
  purge(olderThan?: Date, minFrequency?: number): Promise<SemanticResult<number>>;
  count(): Promise<number>;
}

// ─── Pattern Query ────────────────────────────────────────────────────────

export interface PatternQueryOptions {
  readonly erpProfileId?: string;
  readonly domain?: CBLDomainKind;
  readonly kinds?: LearningPatternKind[];
  readonly minConfidence?: ConfidenceValue;
  readonly limit?: number;
}

export interface PatternFilter {
  readonly kind?: LearningPatternKind;
  readonly erpProfileId?: string;
  readonly domain?: CBLDomainKind;
  readonly minFrequency?: number;
  readonly minConfidence?: ConfidenceValue;
}

// ─── Learning Memory Stats ────────────────────────────────────────────────

export interface LearningMemoryStats {
  readonly totalPatterns: number;
  readonly patternsByKind: Record<LearningPatternKind, number>;
  readonly totalMappingsLearned: number;
  readonly profilesWithPatterns: string[];
  readonly averageConfidence: ConfidenceValue;
  readonly lastLearnedAt?: Date;
}

// ─── Pattern Extractor ────────────────────────────────────────────────────

/**
 * Extracts learnable patterns from a confirmed mapping.
 * One mapping may produce multiple patterns.
 */
export interface PatternExtractor {
  extract(mapping: SemanticMapping): LearningPattern[];
}
