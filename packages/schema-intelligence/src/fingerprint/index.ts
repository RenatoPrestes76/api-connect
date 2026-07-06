/**
 * @seltriva/schema-intelligence/fingerprint
 * Structural Fingerprint Engine — generates deterministic hashes from schema structure
 *
 * A fingerprint captures the structural essence of a schema, entity, or field.
 * It is computed from structure only (names + types + constraints),
 * never from data values. Two schemas with identical structure yield
 * the same fingerprint regardless of which connector produced them.
 *
 * Used by:
 * - Registry (duplicate detection)
 * - Similarity engine (structural distance)
 * - Versioning (change detection — has the checksum changed?)
 */

import type { SchemaId, EntityId, FieldId, FingerprintId } from '../models/index';
import type { SIEResult } from '../core/index';
import type { CanonicalSchema, CanonicalEntity, CanonicalField, CanonicalType } from '../canonical/index';

// ─── Fingerprint Engine ───────────────────────────────────────────────────

export interface FingerprintEngine {
  /**
   * Generate a fingerprint for an entire schema
   */
  fingerprintSchema(schema: CanonicalSchema, options?: FingerprintOptions): SIEResult<SchemaFingerprint>;

  /**
   * Generate a fingerprint for a single entity
   */
  fingerprintEntity(entity: CanonicalEntity, options?: FingerprintOptions): SIEResult<EntityFingerprint>;

  /**
   * Generate a fingerprint for a single field
   */
  fingerprintField(field: CanonicalField, options?: FingerprintOptions): SIEResult<FieldFingerprint>;

  /**
   * Generate a type signature string (normalized type representation)
   */
  typeSignature(type: CanonicalType): string;

  /**
   * Compare two fingerprints — returns similarity 0–1
   */
  compare(a: SchemaFingerprint, b: SchemaFingerprint): number;
  compareEntities(a: EntityFingerprint, b: EntityFingerprint): number;

  /**
   * Check if two fingerprints are identical
   */
  isIdentical(a: SchemaFingerprint, b: SchemaFingerprint): boolean;

  /**
   * Describe what changed between two fingerprints (lightweight diff)
   */
  delta(a: SchemaFingerprint, b: SchemaFingerprint): FingerprintDelta;
}

export interface FingerprintOptions {
  readonly algorithm?: FingerprintAlgorithm;
  readonly includeFieldNames?: boolean;
  readonly includeConstraintNames?: boolean;
  readonly includeDescriptions?: boolean;
  readonly normalizeNames?: boolean;
  readonly caseSensitive?: boolean;
  readonly sortFields?: boolean;
}

// ─── Schema Fingerprint ───────────────────────────────────────────────────

export interface SchemaFingerprint {
  readonly id: FingerprintId;
  readonly schemaId: SchemaId;
  readonly hash: string;
  readonly structureHash: string;
  readonly nameHash: string;
  readonly entityFingerprints: EntityFingerprint[];
  readonly entityCount: number;
  readonly fieldCount: number;
  readonly algorithm: FingerprintAlgorithm;
  readonly version: string;
  readonly generatedAt: Date;
}

// ─── Entity Fingerprint ───────────────────────────────────────────────────

export interface EntityFingerprint {
  readonly entityId: EntityId;
  readonly entityName: string;
  readonly hash: string;
  readonly structureHash: string;
  readonly nameHash: string;
  readonly fieldFingerprints: FieldFingerprint[];
  readonly fieldCount: number;
  readonly fieldTypeSignature: string;
  readonly constraintSignature: string;
}

// ─── Field Fingerprint ────────────────────────────────────────────────────

export interface FieldFingerprint {
  readonly fieldId: FieldId;
  readonly fieldName: string;
  readonly hash: string;
  readonly typeHash: string;
  readonly typeSignature: string;
  readonly role: string;
  readonly position: number;
  readonly nullable: boolean;
  readonly required: boolean;
}

// ─── Fingerprint Algorithm ────────────────────────────────────────────────

/**
 * Pluggable fingerprint algorithm.
 * Default is structural-sha256 — sorts fields canonically then SHA-256s the result.
 */
export interface FingerprintAlgorithm {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;

  hashSchema(schema: CanonicalSchema, options: FingerprintOptions): string;
  hashEntity(entity: CanonicalEntity, options: FingerprintOptions): string;
  hashField(field: CanonicalField, options: FingerprintOptions): string;
  hashType(type: CanonicalType): string;
  hashString(input: string): string;
}

// ─── Fingerprint Delta ────────────────────────────────────────────────────

/**
 * A lightweight description of what structural aspects changed between fingerprints.
 * Not as detailed as SchemaDiff — used for quick "has anything changed?" checks.
 */
export interface FingerprintDelta {
  readonly isIdentical: boolean;
  readonly structureChanged: boolean;
  readonly namesChanged: boolean;
  readonly addedEntityHashes: string[];
  readonly removedEntityHashes: string[];
  readonly modifiedEntityHashes: string[];
  readonly similarityScore: number;
}

// ─── Fingerprint Store ────────────────────────────────────────────────────

/**
 * Persistent store for schema fingerprints.
 * The registry uses this to detect when a new submission is identical to a known schema.
 */
export interface FingerprintStore {
  save(fingerprint: SchemaFingerprint): Promise<SIEResult<void>>;
  get(schemaId: SchemaId): Promise<SIEResult<SchemaFingerprint | null>>;
  findByHash(hash: string): Promise<SIEResult<SchemaFingerprint[]>>;
  findByStructureHash(structureHash: string): Promise<SIEResult<SchemaFingerprint[]>>;
  exists(hash: string): Promise<boolean>;
  delete(schemaId: SchemaId): Promise<SIEResult<void>>;
}

// ─── Fingerprint Registry ─────────────────────────────────────────────────

/**
 * Manages pluggable fingerprint algorithm implementations.
 */
export interface FingerprintAlgorithmRegistry {
  register(algorithm: FingerprintAlgorithm): void;
  get(id: string): FingerprintAlgorithm | null;
  getDefault(): FingerprintAlgorithm;
  setDefault(id: string): void;
  getSupportedAlgorithms(): FingerprintAlgorithm[];
}
