/**
 * @seltriva/schema-intelligence/transformers
 * Schema Transformers — type mapping, naming conversion, field-level transforms
 *
 * Transformers are stateless functions expressed as interfaces.
 * Each transformer takes an input and returns an output without side effects.
 * They compose through the TransformationPipeline.
 */

import type { CanonicalDataKind, NamingConvention, FieldRole } from '../models/index';
import type { SIEResult } from '../core/index';
import type { CanonicalType, CanonicalField, CanonicalEntity } from '../canonical/index';

// ─── Type Transformer ─────────────────────────────────────────────────────

/**
 * Maps a native type string to a CanonicalType.
 * One implementation per dialect/format (PostgreSQL, MySQL, OpenAPI, GraphQL, etc.)
 */
export interface TypeTransformer {
  readonly id: string;
  readonly dialect: string;
  readonly version: string;

  /**
   * Transform a native type string to CanonicalType
   */
  transform(nativeType: string, context?: TypeTransformContext): SIEResult<CanonicalType>;

  /**
   * Reverse: from CanonicalType back to native type string for this dialect
   */
  reverse(canonicalType: CanonicalType): string;

  /**
   * Check whether this transformer can handle the given type string
   */
  canTransform(nativeType: string): boolean;

  /**
   * Infer the CanonicalDataKind for a native type string
   */
  inferKind(nativeType: string): CanonicalDataKind;
}

export interface TypeTransformContext {
  readonly nullable?: boolean;
  readonly length?: number;
  readonly precision?: number;
  readonly scale?: number;
  readonly enumValues?: string[];
  readonly arrayDimensions?: number;
}

// ─── Type Mapping Table ───────────────────────────────────────────────────

/**
 * A declarative mapping table used by TypeTransformer implementations.
 * Maps native type name patterns → CanonicalDataKind.
 */
export interface TypeMappingTable {
  readonly dialect: string;
  readonly mappings: TypeMapping[];
  readonly defaultKind: CanonicalDataKind;
}

export interface TypeMapping {
  /** Exact match or RegExp pattern for the native type name */
  readonly pattern: string | RegExp;
  readonly kind: CanonicalDataKind;
  readonly aliases?: string[];
  readonly notes?: string;
}

// ─── Type Transformer Registry ────────────────────────────────────────────

export interface TypeTransformerRegistry {
  register(transformer: TypeTransformer): void;
  get(dialect: string): TypeTransformer | null;
  getDefault(): TypeTransformer;
  setDefault(id: string): void;
  getSupportedDialects(): string[];
  has(dialect: string): boolean;
}

// ─── Naming Convention Transformer ───────────────────────────────────────

/**
 * Converts identifiers between naming conventions.
 */
export interface NamingConventionTransformer {
  /**
   * Detect the naming convention of an identifier
   */
  detect(identifier: string): NamingConvention;

  /**
   * Detect the dominant convention across a list of identifiers
   */
  detectDominant(identifiers: string[]): NamingConvention;

  /**
   * Convert an identifier from one convention to another
   */
  convert(identifier: string, from: NamingConvention, to: NamingConvention): string;

  /**
   * Normalize: convert to a canonical intermediate form (array of tokens)
   */
  tokenize(identifier: string): string[];

  /**
   * Assemble tokens into a target convention
   */
  assemble(tokens: string[], convention: NamingConvention): string;

  /**
   * Convert camelCase → snake_case
   */
  toSnakeCase(identifier: string): string;

  /**
   * Convert snake_case → camelCase
   */
  toCamelCase(identifier: string): string;

  /**
   * Convert any → PascalCase
   */
  toPascalCase(identifier: string): string;
}

// ─── Field Transformer ────────────────────────────────────────────────────

/**
 * Transforms a CanonicalField — may rename, retype, or enrich metadata.
 * Used in the normalization pipeline to apply transformations declaratively.
 */
export interface FieldTransformer {
  readonly id: string;
  readonly name: string;
  readonly description?: string;

  /**
   * Apply the transformation to a single field
   */
  transform(field: CanonicalField, context: FieldTransformContext): SIEResult<CanonicalField>;

  /**
   * Check whether this transformer applies to the given field
   */
  appliesTo(field: CanonicalField): boolean;
}

export interface FieldTransformContext {
  readonly entity: CanonicalEntity;
  readonly namingConvention?: NamingConvention;
  readonly targetConvention?: NamingConvention;
  readonly dialect?: string;
  readonly options?: Record<string, unknown>;
}

// ─── Entity Transformer ───────────────────────────────────────────────────

export interface EntityTransformer {
  readonly id: string;
  readonly name: string;

  transform(entity: CanonicalEntity, context: EntityTransformContext): SIEResult<CanonicalEntity>;
  appliesTo(entity: CanonicalEntity): boolean;
}

export interface EntityTransformContext {
  readonly namingConvention?: NamingConvention;
  readonly targetConvention?: NamingConvention;
  readonly options?: Record<string, unknown>;
}

// ─── Transformation Pipeline ──────────────────────────────────────────────

/**
 * An ordered, composable chain of FieldTransformer or EntityTransformer steps.
 */
export interface TransformationPipeline<TInput, TContext> {
  addTransformer(transformer: {
    transform(input: TInput, ctx: TContext): SIEResult<TInput>;
    appliesTo(input: TInput): boolean;
  }): TransformationPipeline<TInput, TContext>;
  removeTransformer(id: string): TransformationPipeline<TInput, TContext>;
  getTransformers(): Array<{ readonly id: string }>;

  /**
   * Execute all transformers in order
   */
  execute(input: TInput, context: TContext): SIEResult<TInput>;
}

// ─── Role Inferrer ────────────────────────────────────────────────────────

/**
 * Infers the semantic role of a field from its name, type, and constraints.
 * Standalone transformer — also used by the normalizer.
 */
export interface FieldRoleInferrer {
  infer(field: CanonicalField): FieldRoleInferrerResult;
  registerHeuristic(heuristic: FieldRoleHeuristic): void;
  getHeuristics(): FieldRoleHeuristic[];
}

export interface FieldRoleInferrerResult {
  readonly role: FieldRole;
  readonly confidence: number;
  readonly matchedHeuristics: string[];
}

export interface FieldRoleHeuristic {
  readonly id: string;
  readonly role: FieldRole;
  readonly priority: number;
  readonly namePatterns?: RegExp[];
  readonly typeKinds?: CanonicalDataKind[];
  readonly requiresPrimaryKey?: boolean;
  readonly requiresForeignKey?: boolean;
}

// ─── Type Widening / Narrowing Rules ─────────────────────────────────────

/**
 * Defines which type transitions are widening (non-breaking) vs narrowing (breaking).
 * Used by the comparator to classify TypeChange severity.
 */
export interface TypeCompatibilityMatrix {
  /**
   * Returns true if assigning a value of `from` type to `to` type is safe (widening)
   */
  isCompatible(from: CanonicalDataKind, to: CanonicalDataKind): boolean;

  /**
   * Returns true if the change is a lossless widening (e.g. INT → BIGINT)
   */
  isWidening(from: CanonicalDataKind, to: CanonicalDataKind): boolean;

  /**
   * Returns true if the change could lose data (e.g. BIGINT → INT)
   */
  isNarrowing(from: CanonicalDataKind, to: CanonicalDataKind): boolean;

  /**
   * Returns the "common supertype" of two types if one exists
   */
  commonSupertype(a: CanonicalDataKind, b: CanonicalDataKind): CanonicalDataKind | null;
}
