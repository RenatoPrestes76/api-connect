/**
 * @seltriva/schema-intelligence/core
 * SIE base interfaces — result wrapper, source descriptor, parse and normalization contexts
 */

import type { SchemaSourceType, SchemaCategory } from '../models/index';

// ─── Result Wrapper ───────────────────────────────────────────────────────

/**
 * Every SIE operation returns this instead of throwing.
 * Mirrors ConnectorResult<T> from @seltriva/connectors for consistency.
 */
export interface SIEResult<TData = void> {
  readonly success: boolean;
  readonly data?: TData;
  readonly error?: SIEError;
  readonly durationMs?: number;
  readonly timestamp: Date;
}

export interface SIEError {
  readonly code: SIEErrorCode;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly source?: string;
  readonly line?: number;
  readonly column?: number;
}

export type SIEErrorCode =
  | 'PARSE_FAILED'
  | 'NORMALIZE_FAILED'
  | 'COMPARE_FAILED'
  | 'VERSION_NOT_FOUND'
  | 'FINGERPRINT_FAILED'
  | 'VALIDATION_FAILED'
  | 'UNSUPPORTED_FORMAT'
  | 'SCHEMA_TOO_LARGE'
  | 'INVALID_INPUT'
  | 'REGISTRY_ERROR'
  | 'LEARNING_ERROR'
  | 'CIRCULAR_REFERENCE'
  | 'UNKNOWN';

// ─── Schema Source ────────────────────────────────────────────────────────

/**
 * Identifies where a schema came from.
 * Passed through the entire pipeline and stored with results.
 */
export interface SchemaSource {
  readonly id: string;
  readonly name: string;
  readonly type: SchemaSourceType;
  readonly category: SchemaCategory;
  readonly connectorId?: string;
  readonly connectorSubtype?: string;
  readonly dialect?: string;
  readonly raw: string | Record<string, unknown>;
  readonly encoding?: string;
  readonly retrievedAt: Date;
  readonly metadata?: Record<string, unknown>;
}

// ─── Parse Context ────────────────────────────────────────────────────────

/**
 * Context given to every parser.
 * Carries format hints that cannot be inferred from the raw input alone.
 */
export interface ParseContext {
  readonly sourceType: SchemaSourceType;
  readonly dialect?: string;
  readonly version?: string;
  readonly encoding?: string;
  readonly strictMode?: boolean;
  readonly maxDepth?: number;
  readonly options?: Record<string, unknown>;
}

// ─── Normalization Context ────────────────────────────────────────────────

/**
 * Context given to every normalizer.
 * Controls what inferences are allowed.
 */
export interface NormalizationContext {
  readonly sourceType: SchemaSourceType;
  readonly dialect?: string;
  readonly options?: NormalizationOptions;
}

export interface NormalizationOptions {
  readonly inferFieldRoles?: boolean;
  readonly inferRelationships?: boolean;
  readonly normalizeNames?: boolean;
  readonly resolveReferences?: boolean;
  readonly mergeInheritance?: boolean;
  readonly stripSystemObjects?: boolean;
  readonly flattenNestedObjects?: boolean;
}

// ─── Raw Schema (pre-normalization) ───────────────────────────────────────

/**
 * Intermediate representation produced by a parser.
 * Not yet normalized — still contains source-format artifacts.
 */
export interface RawSchema {
  readonly sourceType: SchemaSourceType;
  readonly source: SchemaSource;
  readonly entities: RawEntity[];
  readonly references?: RawReference[];
  readonly enumerations?: RawEnumeration[];
  readonly parsedAt: Date;
  readonly parserVersion: string;
  readonly warnings: ParseWarning[];
}

export interface RawEntity {
  readonly name: string;
  readonly originalName: string;
  readonly kind: string;
  readonly namespace?: string;
  readonly fields: RawField[];
  readonly constraints?: RawConstraint[];
  readonly description?: string;
  readonly raw?: Record<string, unknown>;
}

export interface RawField {
  readonly name: string;
  readonly originalName: string;
  readonly nativeType: string;
  readonly nullable?: boolean;
  readonly required?: boolean;
  readonly position: number;
  readonly defaultValue?: unknown;
  readonly isPrimaryKey?: boolean;
  readonly isForeignKey?: boolean;
  readonly isUnique?: boolean;
  readonly referencedEntity?: string;
  readonly referencedField?: string;
  readonly description?: string;
  readonly raw?: Record<string, unknown>;
}

export interface RawConstraint {
  readonly name?: string;
  readonly type: string;
  readonly fields: string[];
  readonly expression?: string;
  readonly referencedEntity?: string;
  readonly referencedFields?: string[];
}

export interface RawReference {
  readonly fromEntity: string;
  readonly fromField: string;
  readonly toEntity: string;
  readonly toField: string;
  readonly name?: string;
}

export interface RawEnumeration {
  readonly name: string;
  readonly values: string[];
  readonly description?: string;
}

export interface ParseWarning {
  readonly code: string;
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
  readonly entity?: string;
  readonly field?: string;
}

// ─── SIE Engine (orchestration surface) ──────────────────────────────────

/**
 * Top-level facade — wires parser → normalizer → comparator → registry.
 * Callers should depend on this interface, not individual subsystems.
 */
export interface SchemaIntelligenceEngine {
  /**
   * Parse raw input into a normalized CanonicalSchema in one step
   */
  process(source: SchemaSource, context?: ParseContext): Promise<SIEResult<ProcessedSchema>>;

  /**
   * Compare two canonical schemas and return a full diff report
   */
  compare(a: string, b: string): Promise<SIEResult<ComparisonSummary>>;

  /**
   * Retrieve a schema version by id
   */
  getVersion(versionId: string): Promise<SIEResult<SchemaVersionRef>>;

  /**
   * Get the full evolution timeline for a schema
   */
  getTimeline(schemaId: string): Promise<SIEResult<SchemaTimelineSummary>>;
}

/** Lightweight summary types to avoid circular imports in core */
export interface ProcessedSchema {
  readonly schemaId: string;
  readonly versionId: string;
  readonly entityCount: number;
  readonly fieldCount: number;
  readonly relationshipCount: number;
  readonly fingerprintHash: string;
  readonly processedAt: Date;
}

export interface ComparisonSummary {
  readonly addedEntities: number;
  readonly removedEntities: number;
  readonly modifiedEntities: number;
  readonly addedFields: number;
  readonly removedFields: number;
  readonly renamedFields: number;
  readonly breakingChanges: number;
  readonly comparedAt: Date;
}

export interface SchemaVersionRef {
  readonly versionId: string;
  readonly schemaId: string;
  readonly label?: string;
  readonly createdAt: Date;
}

export interface SchemaTimelineSummary {
  readonly schemaId: string;
  readonly totalVersions: number;
  readonly firstVersion: Date;
  readonly latestVersion: Date;
}
