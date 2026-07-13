/**
 * @seltriva/schema-intelligence/similarity
 * Similarity Engine — structural similarity between schemas, entities, and fields
 *
 * Answers questions like:
 * - "Is this CSV the same structure as this database table?"
 * - "Which API resource corresponds to this database entity?"
 * - "These two tables from different ERPs might be the same concept."
 *
 * Based on structural properties only (field names, types, constraints, roles).
 * Does NOT use sample data or business semantics.
 */

import type { SchemaId, EntityId, SimilarityScore, ConfidenceScore } from '../models/index';
import type { SIEResult } from '../core/index';
import type { CanonicalSchema, CanonicalEntity, CanonicalField } from '../canonical/index';
import type { EntityFingerprint, FieldFingerprint } from '../fingerprint/index';

// ─── Similarity Engine ────────────────────────────────────────────────────

export interface SimilarityEngine {
  /**
   * Compare two schemas and return a full similarity report
   */
  compareSchemas(
    a: CanonicalSchema,
    b: CanonicalSchema,
    options?: SimilarityOptions
  ): SIEResult<SchemaSimilarityReport>;

  /**
   * Find the most similar entities across two schemas
   */
  compareEntities(
    a: CanonicalEntity,
    b: CanonicalEntity,
    options?: SimilarityOptions
  ): SIEResult<EntitySimilarityScore>;

  /**
   * Compare a single entity against all entities in a schema
   */
  findSimilarEntities(
    entity: CanonicalEntity,
    schema: CanonicalSchema,
    options?: SimilaritySearchOptions
  ): SIEResult<EntitySimilarityResult[]>;

  /**
   * Compare two fields
   */
  compareFields(a: CanonicalField, b: CanonicalField): SIEResult<FieldSimilarityScore>;

  /**
   * Find the most similar field in a target entity for each field in the source
   */
  mapFields(
    source: CanonicalEntity,
    target: CanonicalEntity,
    options?: FieldMappingOptions
  ): SIEResult<FieldMappingResult>;

  /**
   * Batch: find similar schemas in a list
   */
  rankSchemas(
    query: CanonicalSchema,
    candidates: CanonicalSchema[],
    options?: SimilaritySearchOptions
  ): SIEResult<SchemaSimilarityRanking[]>;
}

export interface SimilarityOptions {
  readonly strategy?: SimilarityStrategyId;
  readonly weights?: SimilarityWeights;
  readonly normalizeNames?: boolean;
  readonly ignoreDeprecated?: boolean;
}

export interface SimilaritySearchOptions extends SimilarityOptions {
  readonly minScore?: number;
  readonly maxResults?: number;
}

export interface FieldMappingOptions extends SimilarityOptions {
  readonly minFieldScore?: number;
  readonly allowManyToOne?: boolean;
}

// ─── Similarity Reports ───────────────────────────────────────────────────

export interface SchemaSimilarityReport {
  readonly schemaIdA: SchemaId;
  readonly schemaIdB: SchemaId;
  readonly overallScore: SimilarityScore;
  readonly structureScore: SimilarityScore;
  readonly nameScore: SimilarityScore;
  readonly typeScore: SimilarityScore;
  readonly entityMatches: EntityMatchResult[];
  readonly unmatchedFromA: string[];
  readonly unmatchedFromB: string[];
  readonly verdict: SimilarityVerdict;
  readonly computedAt: Date;
}

export interface EntityMatchResult {
  readonly entityNameA: string;
  readonly entityNameB: string;
  readonly score: SimilarityScore;
  readonly fieldMatches: FieldMatchResult[];
  readonly unmatchedFieldsA: string[];
  readonly unmatchedFieldsB: string[];
}

export interface SchemaSimilarityRanking {
  readonly schemaId: SchemaId;
  readonly schemaName: string;
  readonly score: SimilarityScore;
  readonly entityMatchCount: number;
  readonly verdict: SimilarityVerdict;
}

// ─── Entity Similarity ────────────────────────────────────────────────────

export interface EntitySimilarityScore {
  readonly entityIdA: EntityId;
  readonly entityIdB: EntityId;
  readonly overallScore: SimilarityScore;
  readonly nameScore: SimilarityScore;
  readonly structureScore: SimilarityScore;
  readonly fieldCoverageScore: SimilarityScore;
  readonly typeSimilarityScore: SimilarityScore;
  readonly roleSimilarityScore: SimilarityScore;
  readonly verdict: SimilarityVerdict;
}

export interface EntitySimilarityResult {
  readonly entity: CanonicalEntity;
  readonly score: EntitySimilarityScore;
}

// ─── Field Similarity ─────────────────────────────────────────────────────

export interface FieldSimilarityScore {
  readonly nameScore: SimilarityScore;
  readonly typeScore: SimilarityScore;
  readonly roleScore: SimilarityScore;
  readonly constraintScore: SimilarityScore;
  readonly overallScore: SimilarityScore;
  readonly verdict: SimilarityVerdict;
}

export interface FieldMatchResult {
  readonly fieldNameA: string;
  readonly fieldNameB: string;
  readonly score: FieldSimilarityScore;
}

// ─── Field Mapping ────────────────────────────────────────────────────────

/**
 * Output of `mapFields()` — suggests how fields in source map to fields in target.
 */
export interface FieldMappingResult {
  readonly sourceEntityName: string;
  readonly targetEntityName: string;
  readonly mappings: FieldMapping[];
  readonly unmappedSourceFields: string[];
  readonly unmappedTargetFields: string[];
  readonly overallCoverage: number;
}

export interface FieldMapping {
  readonly sourceField: string;
  readonly targetField: string;
  readonly score: FieldSimilarityScore;
  readonly confidence: ConfidenceScore;
  readonly requiresTransformation: boolean;
  readonly transformationHint?: string;
  readonly isInferred: boolean;
}

// ─── Similarity Verdict ───────────────────────────────────────────────────

export type SimilarityVerdict =
  | 'identical'
  | 'very-similar'
  | 'similar'
  | 'partially-similar'
  | 'different'
  | 'unrelated';

// ─── Similarity Strategies ────────────────────────────────────────────────

export type SimilarityStrategyId =
  | 'structural'
  | 'name-based'
  | 'type-based'
  | 'fingerprint-based'
  | 'role-based'
  | 'combined';

/**
 * Pluggable similarity strategy interface.
 */
export interface SimilarityStrategy {
  readonly id: SimilarityStrategyId;
  readonly name: string;
  readonly description: string;

  scoreEntities(a: EntityFingerprint, b: EntityFingerprint): SimilarityScore;
  scoreFields(a: FieldFingerprint, b: FieldFingerprint): SimilarityScore;
}

// ─── Similarity Weights ───────────────────────────────────────────────────

export interface SimilarityWeights {
  readonly nameSimilarity: number;
  readonly typeSimilarity: number;
  readonly fieldCoverage: number;
  readonly roleSimilarity: number;
  readonly constraintSimilarity: number;
  readonly positionSimilarity: number;
}

export const DEFAULT_SIMILARITY_WEIGHTS: SimilarityWeights = {
  nameSimilarity: 0.35,
  typeSimilarity: 0.25,
  fieldCoverage: 0.2,
  roleSimilarity: 0.1,
  constraintSimilarity: 0.05,
  positionSimilarity: 0.05,
};

// ─── Similarity Strategy Registry ────────────────────────────────────────

export interface SimilarityStrategyRegistry {
  register(strategy: SimilarityStrategy): void;
  get(id: SimilarityStrategyId): SimilarityStrategy | null;
  getDefault(): SimilarityStrategy;
  setDefault(id: SimilarityStrategyId): void;
  getAll(): SimilarityStrategy[];
}

// ─── Name Similarity Scorer ───────────────────────────────────────────────

/**
 * Specialized name comparison — handles snake_case vs camelCase,
 * abbreviations (cust → customer), and known synonyms.
 */
export interface NameSimilarityScorer {
  score(a: string, b: string): SimilarityScore;
  normalize(name: string): string;
  registerSynonyms(synonymGroup: string[]): void;
  getSynonyms(name: string): string[];
}
