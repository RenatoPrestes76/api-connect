/**
 * @seltriva/schema-intelligence/registry
 * Schema Registry — stores known schemas and ERP structural patterns
 *
 * Two concerns:
 * 1. A registry of all processed schemas (with their versions and fingerprints)
 * 2. A pattern library of known ERP / domain schemas (SAP, TOTVS, Oracle EBS, etc.)
 *    used by the similarity engine and learning layer to classify unknown schemas.
 */

import type { SchemaId, PatternId, SchemaCategory, ConfidenceScore } from '../models/index';
import type { SIEResult } from '../core/index';
import type { CanonicalSchema, CanonicalEntity } from '../canonical/index';
import type { SchemaVersionSummary } from '../versioning/index';

// ─── Schema Registry ──────────────────────────────────────────────────────

/**
 * Central store for all registered schemas.
 * A schema is registered once; each update creates a new version.
 */
export interface SchemaRegistry {
  /**
   * Register a new schema — returns its assigned SchemaId
   */
  register(schema: CanonicalSchema, options?: RegistrationOptions): Promise<SIEResult<SchemaId>>;

  /**
   * Submit a new version of an existing schema
   */
  update(schemaId: SchemaId, schema: CanonicalSchema, message?: string): Promise<SIEResult<void>>;

  /**
   * Retrieve the latest canonical schema for a schema id
   */
  get(schemaId: SchemaId): Promise<SIEResult<CanonicalSchema>>;

  /**
   * Check if a schema id is registered
   */
  has(schemaId: SchemaId): boolean;

  /**
   * Remove a schema and all its versions (irreversible)
   */
  delete(schemaId: SchemaId): Promise<SIEResult<void>>;

  /**
   * Search schemas by criteria
   */
  search(criteria: SchemaSearchCriteria): Promise<SIEResult<SchemaRegistryEntry[]>>;

  /**
   * Get a summary list of all registered schemas
   */
  list(options?: SchemaListOptions): Promise<SIEResult<SchemaRegistryEntry[]>>;

  /**
   * Find schemas by structural fingerprint (detect duplicates / near-duplicates)
   */
  findByFingerprint(fingerprint: string): Promise<SIEResult<SchemaRegistryEntry[]>>;

  /**
   * Get all versions for a schema
   */
  getVersions(schemaId: SchemaId): Promise<SIEResult<SchemaVersionSummary[]>>;

  /**
   * Count registered schemas
   */
  count(): number;
}

export interface RegistrationOptions {
  readonly schemaId?: SchemaId;
  readonly label?: string;
  readonly tags?: string[];
  readonly message?: string;
  readonly author?: string;
  readonly replace?: boolean;
}

export interface SchemaRegistryEntry {
  readonly schemaId: SchemaId;
  readonly name: string;
  readonly category: SchemaCategory;
  readonly sourceType: string;
  readonly connectorId?: string;
  readonly entityCount: number;
  readonly fieldCount: number;
  readonly latestVersionId: string;
  readonly latestChecksum: string;
  readonly versionCount: number;
  readonly tags: string[];
  readonly registeredAt: Date;
  readonly lastUpdatedAt: Date;
  readonly metadata?: Record<string, unknown>;
}

export interface SchemaSearchCriteria {
  readonly name?: string;
  readonly namePattern?: RegExp;
  readonly category?: SchemaCategory;
  readonly sourceType?: string;
  readonly connectorId?: string;
  readonly tags?: string[];
  readonly registeredAfter?: Date;
  readonly registeredBefore?: Date;
  readonly minEntityCount?: number;
  readonly maxEntityCount?: number;
}

export interface SchemaListOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly orderBy?: 'name' | 'registeredAt' | 'lastUpdatedAt' | 'entityCount';
  readonly orderDirection?: 'asc' | 'desc';
}

// ─── ERP Pattern Registry ─────────────────────────────────────────────────

/**
 * Library of known ERP and domain schema patterns.
 * Used by the similarity and learning engines to classify unknown schemas.
 * Stores metadata only — no business data.
 */
export interface ERPPatternRegistry {
  /**
   * Register a known ERP schema pattern
   */
  registerPattern(pattern: ERPSchemaPattern): void;

  /**
   * Find the best matching ERP pattern for an unknown schema
   */
  matchSchema(schema: CanonicalSchema): Promise<SIEResult<ERPPatternMatch[]>>;

  /**
   * Find the best matching pattern for a single entity
   */
  matchEntity(entity: CanonicalEntity): Promise<SIEResult<ERPEntityPatternMatch[]>>;

  /**
   * Get all registered patterns
   */
  getPatterns(): ERPSchemaPattern[];

  /**
   * Get patterns by vendor / ERP system
   */
  getByVendor(vendor: string): ERPSchemaPattern[];

  /**
   * Get all known ERP vendors
   */
  getVendors(): string[];
}

export interface ERPSchemaPattern {
  readonly id: PatternId;
  readonly vendor: string;
  readonly product: string;
  readonly version?: string;
  readonly module?: string;
  readonly description: string;
  readonly entityPatterns: ERPEntityPattern[];
  readonly knownNamespaces?: string[];
  readonly typicalFieldCount?: number;
  readonly typicalEntityCount?: number;
  readonly structuralHints?: string[];
  readonly metadata?: Record<string, unknown>;
}

export interface ERPEntityPattern {
  readonly name: string;
  readonly aliases?: string[];
  readonly module?: string;
  readonly typicalFields: ERPFieldPattern[];
  readonly requiredFields?: string[];
  readonly description?: string;
}

export interface ERPFieldPattern {
  readonly name: string;
  readonly aliases?: string[];
  readonly canonicalRole?: string;
  readonly typicalType?: string;
  readonly isCommon: boolean;
}

export interface ERPPatternMatch {
  readonly pattern: ERPSchemaPattern;
  readonly confidence: ConfidenceScore;
  readonly matchedEntities: ERPEntityPatternMatch[];
  readonly unmatchedEntityCount: number;
  readonly evidence: string[];
}

export interface ERPEntityPatternMatch {
  readonly entityName: string;
  readonly patternEntityName: string;
  readonly confidence: ConfidenceScore;
  readonly matchedFields: number;
  readonly totalPatternFields: number;
  readonly fieldMatches: ERPFieldMatch[];
}

export interface ERPFieldMatch {
  readonly fieldName: string;
  readonly patternFieldName: string;
  readonly confidence: ConfidenceScore;
  readonly matchType: 'exact' | 'alias' | 'role' | 'type' | 'heuristic';
}

// ─── Schema Registry Events ───────────────────────────────────────────────

export interface SchemaRegistryEvent {
  readonly type: 'registered' | 'updated' | 'deleted';
  readonly schemaId: SchemaId;
  readonly timestamp: Date;
  readonly author?: string;
}

export interface SchemaRegistryObserver {
  onChange(handler: (event: SchemaRegistryEvent) => void): string;
  offChange(subscriptionId: string): void;
}
