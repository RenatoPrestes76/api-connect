/**
 * @seltriva/schema-intelligence/normalizer
 * Schema Normalizer — converts RawSchema → CanonicalSchema
 *
 * Normalization is a pipeline of composable rules. Each rule transforms
 * one aspect: entity naming, field typing, role inference, relationship mapping.
 * Rules are applied in order and are independently replaceable.
 */

import type { NamingConvention, FieldRole, CanonicalDataKind } from '../models/index';
import type { RawSchema, RawEntity, RawField, NormalizationContext, SIEResult } from '../core/index';
import type { CanonicalSchema, CanonicalEntity, CanonicalField, CanonicalType } from '../canonical/index';

// ─── Schema Normalizer ────────────────────────────────────────────────────

/**
 * Top-level normalizer: converts a complete RawSchema → CanonicalSchema.
 */
export interface SchemaNormalizer {
  normalize(raw: RawSchema, context: NormalizationContext): Promise<SIEResult<CanonicalSchema>>;

  /**
   * Normalize a single entity in isolation (used by streaming/incremental flows)
   */
  normalizeEntity(raw: RawEntity, context: NormalizationContext): SIEResult<CanonicalEntity>;

  /**
   * Return the active normalization pipeline
   */
  getPipeline(): NormalizationPipeline;
}

// ─── Normalization Pipeline ───────────────────────────────────────────────

/**
 * Ordered chain of normalization steps applied to every schema.
 * Steps are executed in sequence; each step receives the output of the previous.
 */
export interface NormalizationPipeline {
  addStep(step: NormalizationStep): NormalizationPipeline;
  removeStep(stepId: string): NormalizationPipeline;
  getSteps(): NormalizationStep[];
  clear(): NormalizationPipeline;

  /**
   * Execute the pipeline on a raw schema
   */
  execute(raw: RawSchema, context: NormalizationContext): Promise<SIEResult<CanonicalSchema>>;
}

// ─── Normalization Step ───────────────────────────────────────────────────

/**
 * A single composable unit of normalization logic.
 * Steps are pure: they receive a state and return a new state.
 */
export interface NormalizationStep {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly description?: string;

  apply(state: NormalizationState, context: NormalizationContext): Promise<NormalizationState>;

  /**
   * Whether this step can be skipped if the context says so
   */
  isOptional(): boolean;
  shouldApply(context: NormalizationContext): boolean;
}

export interface NormalizationState {
  readonly raw: RawSchema;
  readonly entities: CanonicalEntity[];
  readonly relationships: unknown[];
  readonly enumerations: unknown[];
  readonly warnings: NormalizationWarning[];
  readonly metadata: Record<string, unknown>;
}

export interface NormalizationWarning {
  readonly step: string;
  readonly message: string;
  readonly entity?: string;
  readonly field?: string;
  readonly code: string;
}

// ─── Entity Normalizer ────────────────────────────────────────────────────

/**
 * Responsible for mapping a RawEntity → CanonicalEntity.
 * Handles name normalization, kind mapping, and metadata extraction.
 */
export interface EntityNormalizer {
  normalize(raw: RawEntity, context: NormalizationContext): SIEResult<CanonicalEntity>;
  normalizeKind(rawKind: string): import('../models/index').EntityKind;
  normalizeName(name: string, convention: NamingConvention): string;
}

// ─── Field Normalizer ─────────────────────────────────────────────────────

/**
 * Maps a RawField → CanonicalField.
 * Delegates type mapping to TypeNormalizer.
 */
export interface FieldNormalizer {
  normalize(raw: RawField, entityName: string, context: NormalizationContext): SIEResult<CanonicalField>;
  inferRole(field: RawField): FieldRole;
  normalizeName(name: string, convention: NamingConvention): string;
}

// ─── Type Normalizer ──────────────────────────────────────────────────────

/**
 * Maps a native type string (e.g. "VARCHAR(255)", "xs:decimal", "String!")
 * to a CanonicalType. Every dialect/format needs its own TypeNormalizer.
 */
export interface TypeNormalizer {
  readonly dialect: string;
  normalize(nativeType: string, constraints?: TypeConstraints): CanonicalType;
  inferKind(nativeType: string): CanonicalDataKind;
  extractLength(nativeType: string): number | undefined;
  extractPrecision(nativeType: string): number | undefined;
  extractScale(nativeType: string): number | undefined;
  extractEnumValues(nativeType: string): string[] | undefined;
}

export interface TypeConstraints {
  readonly nullable?: boolean;
  readonly maxLength?: number;
  readonly precision?: number;
  readonly scale?: number;
  readonly enumValues?: string[];
}

// ─── Naming Convention Detector ───────────────────────────────────────────

/**
 * Detects the naming convention of a schema by sampling field and entity names.
 */
export interface NamingConventionDetector {
  detect(names: string[]): NamingConvention;
  detectField(name: string): NamingConvention;
  convert(name: string, from: NamingConvention, to: NamingConvention): string;
  toCanonical(name: string, source: NamingConvention): string;
}

// ─── Role Inference Engine ────────────────────────────────────────────────

/**
 * Infers semantic roles for fields based on:
 * - name patterns (created_at, updated_at, tenant_id, etc.)
 * - type (UUID → likely PK, BOOLEAN → flag, TIMESTAMP → audit)
 * - constraints (PRIMARY KEY → primary-key, FOREIGN KEY → foreign-key)
 */
export interface FieldRoleInferenceEngine {
  infer(field: RawField, entityName: string): FieldRoleInferenceResult;
  definePattern(pattern: FieldRolePattern): void;
  getPatterns(): FieldRolePattern[];
}

export interface FieldRoleInferenceResult {
  readonly role: FieldRole;
  readonly confidence: number;
  readonly evidence: string[];
}

export interface FieldRolePattern {
  readonly id: string;
  readonly role: FieldRole;
  readonly namePatterns?: RegExp[];
  readonly typePatterns?: RegExp[];
  readonly constraintTypes?: string[];
  readonly priority: number;
}

// ─── Relationship Inferrer ────────────────────────────────────────────────

/**
 * Infers relationships between entities when no explicit FK is declared.
 * Uses naming conventions (e.g., customer_id → customers.id) and
 * foreign key constraints defined in DDL.
 */
export interface RelationshipInferrer {
  infer(entities: CanonicalEntity[]): InferredRelationship[];
  inferFromName(fieldName: string, entities: CanonicalEntity[]): InferredRelationshipCandidate[];
  inferFromConstraints(entity: CanonicalEntity): InferredRelationship[];
}

export interface InferredRelationship {
  readonly fromEntity: string;
  readonly fromField: string;
  readonly toEntity: string;
  readonly toField: string;
  readonly confidence: number;
  readonly basis: RelationshipInferenceBasis;
}

export interface InferredRelationshipCandidate {
  readonly targetEntity: string;
  readonly targetField: string;
  readonly confidence: number;
}

export type RelationshipInferenceBasis =
  | 'explicit-fk'
  | 'field-name-convention'
  | 'type-match'
  | 'known-pattern'
  | 'heuristic';

// ─── Normalizer Registry ──────────────────────────────────────────────────

/**
 * Map-based registry for TypeNormalizer instances by dialect.
 */
export interface TypeNormalizerRegistry {
  register(normalizer: TypeNormalizer): void;
  get(dialect: string): TypeNormalizer | null;
  getDefault(): TypeNormalizer;
  has(dialect: string): boolean;
  getSupportedDialects(): string[];
}
