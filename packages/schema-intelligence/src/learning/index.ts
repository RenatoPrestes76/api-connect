/**
 * @seltriva/schema-intelligence/learning
 * Learning Layer — discovers structural patterns from schema metadata
 *
 * CONSTRAINT: This layer operates on schema metadata ONLY.
 * It never touches business data, row values, or actual records.
 *
 * What it learns:
 * - Common field naming conventions per domain (ERP, e-commerce, SaaS)
 * - Type evolution patterns (INT → BIGINT, VARCHAR → TEXT)
 * - Recurring entity structures (address, audit, money amount)
 * - Relationship topologies (star schema, normalized, flat)
 */

import type { SchemaId, PatternId, ConfidenceScore, FieldRole, EntityKind } from '../models/index';
import type { SIEResult } from '../core/index';
import type { CanonicalSchema, CanonicalEntity, CanonicalField } from '../canonical/index';

// ─── Schema Learner ───────────────────────────────────────────────────────

export interface SchemaLearner {
  /**
   * Submit a schema for pattern learning.
   * The learner extracts structural patterns without inspecting data.
   */
  learn(schema: CanonicalSchema, session?: LearningSession): Promise<SIEResult<LearningResult>>;

  /**
   * Submit multiple schemas in a batch learning session
   */
  learnBatch(
    schemas: CanonicalSchema[],
    session?: LearningSession
  ): Promise<SIEResult<BatchLearningResult>>;

  /**
   * Query learned patterns matching criteria
   */
  queryPatterns(criteria: PatternSearchCriteria): Promise<SIEResult<LearnedPattern[]>>;

  /**
   * Get all patterns learned from a specific schema
   */
  getPatterns(schemaId: SchemaId): Promise<SIEResult<LearnedPattern[]>>;

  /**
   * Get statistics about the learned knowledge base
   */
  getStats(): LearningStats;

  /**
   * Reset the knowledge base (typically for testing)
   */
  reset(): Promise<void>;
}

// ─── Learning Session ─────────────────────────────────────────────────────

/**
 * Context for a learning run — controls what the learner focuses on.
 */
export interface LearningSession {
  readonly id: string;
  readonly name?: string;
  readonly domain?: string;
  readonly learnFieldRoles?: boolean;
  readonly learnEntityStructures?: boolean;
  readonly learnRelationshipPatterns?: boolean;
  readonly learnTypeEvolutionPatterns?: boolean;
  readonly learnNamingConventions?: boolean;
  readonly minPatternFrequency?: number;
  readonly minConfidence?: number;
  readonly metadata?: Record<string, unknown>;
}

// ─── Learning Result ──────────────────────────────────────────────────────

export interface LearningResult {
  readonly schemaId: SchemaId;
  readonly sessionId: string;
  readonly newPatterns: LearnedPattern[];
  readonly reinforcedPatterns: LearnedPattern[];
  readonly conflictingPatterns: PatternConflict[];
  readonly durationMs: number;
}

export interface BatchLearningResult {
  readonly sessionId: string;
  readonly processedSchemas: number;
  readonly newPatterns: LearnedPattern[];
  readonly reinforcedPatterns: LearnedPattern[];
  readonly totalPatternsInBase: number;
  readonly durationMs: number;
}

// ─── Learned Patterns ─────────────────────────────────────────────────────

/**
 * A structural pattern inferred from observed schemas.
 * Has no knowledge of what the data means — only what the structure looks like.
 */
export interface LearnedPattern {
  readonly id: PatternId;
  readonly kind: LearnedPatternKind;
  readonly name: string;
  readonly description: string;
  readonly frequency: number;
  readonly confidence: ConfidenceScore;
  readonly domain?: string;
  readonly payload: LearnedPatternPayload;
  readonly sourceSchemas: SchemaId[];
  readonly firstObservedAt: Date;
  readonly lastObservedAt: Date;
  readonly metadata?: Record<string, unknown>;
}

export type LearnedPatternKind =
  | 'field-naming-convention'
  | 'field-role-indicator'
  | 'entity-structure'
  | 'relationship-topology'
  | 'type-evolution'
  | 'audit-fields'
  | 'soft-delete-fields'
  | 'multi-tenancy-fields'
  | 'pagination-fields'
  | 'versioning-fields'
  | 'naming-prefix-suffix';

export type LearnedPatternPayload =
  | FieldNamingPattern
  | FieldRoleIndicatorPattern
  | EntityStructurePattern
  | RelationshipTopologyPattern
  | TypeEvolutionPattern
  | AuditFieldPattern
  | NamingAffix;

// ─── Pattern Payloads ─────────────────────────────────────────────────────

export interface FieldNamingPattern {
  readonly kind: 'field-naming-convention';
  readonly convention: string;
  readonly examples: string[];
  readonly prefixes?: string[];
  readonly suffixes?: string[];
}

export interface FieldRoleIndicatorPattern {
  readonly kind: 'field-role-indicator';
  readonly role: FieldRole;
  readonly namePatterns: string[];
  readonly typePatterns: string[];
  readonly constraintTypes: string[];
  readonly coOccursWith?: string[];
}

export interface EntityStructurePattern {
  readonly kind: 'entity-structure';
  readonly entityKind: EntityKind;
  readonly commonFields: CommonFieldDescriptor[];
  readonly optionalFields: CommonFieldDescriptor[];
  readonly typicalFieldCount: number;
  readonly typicalRelationshipCount: number;
}

export interface CommonFieldDescriptor {
  readonly nameCandidates: string[];
  readonly typeCandidates: string[];
  readonly role: FieldRole;
  readonly frequency: number;
}

export interface RelationshipTopologyPattern {
  readonly kind: 'relationship-topology';
  readonly topology: 'star' | 'snowflake' | 'flat' | 'hierarchical' | 'mesh' | 'unknown';
  readonly hubEntityPatterns?: string[];
  readonly averageRelationshipsPerEntity: number;
  readonly maxDepth?: number;
}

export interface TypeEvolutionPattern {
  readonly kind: 'type-evolution';
  readonly fromType: string;
  readonly toType: string;
  readonly frequency: number;
  readonly context?: string;
  readonly isBreaking: boolean;
}

export interface AuditFieldPattern {
  readonly kind: 'audit-fields';
  readonly fields: Array<{
    role: 'created-at' | 'updated-at' | 'deleted-at' | 'created-by' | 'updated-by';
    nameCandidates: string[];
  }>;
  readonly isSoftDelete: boolean;
  readonly hasUserTracking: boolean;
}

export interface NamingAffix {
  readonly kind: 'naming-prefix-suffix';
  readonly position: 'prefix' | 'suffix';
  readonly value: string;
  readonly scope: 'entity' | 'field' | 'both';
  readonly frequency: number;
}

// ─── Pattern Conflict ─────────────────────────────────────────────────────

export interface PatternConflict {
  readonly existingPatternId: PatternId;
  readonly newPatternId: PatternId;
  readonly reason: string;
  readonly resolution: 'kept-existing' | 'replaced' | 'merged' | 'flagged';
}

// ─── Pattern Search ───────────────────────────────────────────────────────

export interface PatternSearchCriteria {
  readonly kind?: LearnedPatternKind;
  readonly domain?: string;
  readonly minFrequency?: number;
  readonly minConfidence?: number;
  readonly namePattern?: string;
  readonly fieldRole?: FieldRole;
  readonly limit?: number;
}

// ─── Pattern Applicator ───────────────────────────────────────────────────

/**
 * Applies learned patterns to enrich a CanonicalSchema:
 * - fills in inferred field roles
 * - suggests missing audit fields
 * - detects missing relationships
 * - identifies naming inconsistencies
 */
export interface PatternApplicator {
  enrich(schema: CanonicalSchema, patterns: LearnedPattern[]): SIEResult<SchemaEnrichmentResult>;
}

export interface SchemaEnrichmentResult {
  readonly schema: CanonicalSchema;
  readonly enrichments: SchemaEnrichment[];
  readonly appliedPatternIds: PatternId[];
}

export interface SchemaEnrichment {
  readonly kind:
    | 'role-inferred'
    | 'audit-detected'
    | 'relationship-suggested'
    | 'naming-issue'
    | 'structure-match';
  readonly entityName?: string;
  readonly fieldName?: string;
  readonly description: string;
  readonly confidence: ConfidenceScore;
  readonly patternId: PatternId;
}

// ─── Learning Stats ───────────────────────────────────────────────────────

export interface LearningStats {
  readonly totalPatterns: number;
  readonly patternsByKind: Record<LearnedPatternKind, number>;
  readonly totalSchemasProcessed: number;
  readonly averageConfidence: number;
  readonly lastLearningAt?: Date;
}
