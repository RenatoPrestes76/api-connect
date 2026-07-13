/**
 * @seltriva/schema-intelligence/versioning
 * Schema Versioning System — full immutable version history for any schema
 *
 * Each CanonicalSchema that enters the system gets stamped with a VersionId.
 * Versions are stored as full snapshots + delta patches.
 * The system supports branching (parallel evolution) and tagging.
 */

import type { SchemaId, VersionId } from '../models/index';
import type { SIEResult } from '../core/index';
import type { CanonicalSchema, SchemaPatch } from '../canonical/index';
import type { SchemaDiff } from '../comparator/index';

// ─── Schema Version ───────────────────────────────────────────────────────

/**
 * An immutable, point-in-time snapshot of a schema.
 */
export interface SchemaVersion {
  readonly id: VersionId;
  readonly schemaId: SchemaId;
  readonly schema: CanonicalSchema;
  readonly parentVersionId: VersionId | null;
  readonly label?: string;
  readonly tags: string[];
  readonly message?: string;
  readonly author?: string;
  readonly patch?: SchemaPatch;
  readonly checksum: string;
  readonly createdAt: Date;
  readonly metadata?: Record<string, unknown>;
}

// ─── Schema Version Store ─────────────────────────────────────────────────

/**
 * Primary storage and retrieval interface for schema versions.
 */
export interface SchemaVersionStore {
  /**
   * Store a new version (immutable once stored)
   */
  save(version: SchemaVersion): Promise<SIEResult<VersionId>>;

  /**
   * Retrieve a specific version by id
   */
  get(versionId: VersionId): Promise<SIEResult<SchemaVersion>>;

  /**
   * Get the latest version for a schema
   */
  getLatest(schemaId: SchemaId): Promise<SIEResult<SchemaVersion>>;

  /**
   * Get the version immediately before this one
   */
  getPrevious(versionId: VersionId): Promise<SIEResult<SchemaVersion | null>>;

  /**
   * Get the direct ancestor chain (oldest → newest)
   */
  getAncestors(versionId: VersionId, limit?: number): Promise<SIEResult<SchemaVersion[]>>;

  /**
   * List all versions for a schema (newest first)
   */
  list(
    schemaId: SchemaId,
    options?: VersionListOptions
  ): Promise<SIEResult<SchemaVersionSummary[]>>;

  /**
   * Check if a version exists
   */
  exists(versionId: VersionId): Promise<boolean>;

  /**
   * Delete a version (only allowed for non-referenced versions)
   */
  delete(versionId: VersionId): Promise<SIEResult<void>>;

  /**
   * Count versions for a schema
   */
  count(schemaId: SchemaId): Promise<number>;
}

export interface VersionListOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly fromDate?: Date;
  readonly toDate?: Date;
  readonly tags?: string[];
  readonly labelPattern?: string;
  readonly author?: string;
}

export interface SchemaVersionSummary {
  readonly id: VersionId;
  readonly schemaId: SchemaId;
  readonly label?: string;
  readonly tags: string[];
  readonly message?: string;
  readonly author?: string;
  readonly checksum: string;
  readonly entityCount: number;
  readonly fieldCount: number;
  readonly createdAt: Date;
}

// ─── Schema Version History ───────────────────────────────────────────────

/**
 * Ordered list of versions with navigation helpers.
 */
export interface SchemaVersionHistory {
  readonly schemaId: SchemaId;
  readonly versions: SchemaVersionSummary[];
  readonly totalCount: number;
  readonly firstVersion: SchemaVersionSummary | null;
  readonly latestVersion: SchemaVersionSummary | null;

  /**
   * Get the diff between any two versions in this history
   */
  diffVersions(fromVersionId: VersionId, toVersionId: VersionId): Promise<SIEResult<SchemaDiff>>;

  /**
   * Navigate to a specific version index
   */
  at(index: number): SchemaVersionSummary | null;

  /**
   * Find a version by label or tag
   */
  find(labelOrTag: string): SchemaVersionSummary | null;
}

// ─── Schema Timeline ──────────────────────────────────────────────────────

/**
 * Visual/analytical timeline of schema evolution.
 */
export interface SchemaTimeline {
  readonly schemaId: SchemaId;
  readonly events: TimelineEvent[];
  readonly branches: TimelineBranch[];
  readonly startDate: Date;
  readonly endDate: Date;

  /**
   * Return all events within a date range
   */
  getRange(from: Date, to: Date): TimelineEvent[];

  /**
   * Return events of a specific kind
   */
  getByKind(kind: TimelineEventKind): TimelineEvent[];
}

export interface TimelineEvent {
  readonly versionId: VersionId;
  readonly kind: TimelineEventKind;
  readonly timestamp: Date;
  readonly label?: string;
  readonly description?: string;
  readonly isBreaking: boolean;
  readonly entityName?: string;
  readonly fieldName?: string;
}

export type TimelineEventKind =
  | 'schema-created'
  | 'schema-imported'
  | 'entity-added'
  | 'entity-removed'
  | 'entity-renamed'
  | 'field-added'
  | 'field-removed'
  | 'field-type-changed'
  | 'field-renamed'
  | 'constraint-changed'
  | 'relationship-changed'
  | 'tagged'
  | 'branched'
  | 'merged';

export interface TimelineBranch {
  readonly name: string;
  readonly rootVersionId: VersionId;
  readonly latestVersionId: VersionId;
  readonly divergedFrom?: VersionId;
  readonly createdAt: Date;
}

// ─── Version Tagger ───────────────────────────────────────────────────────

/**
 * Adds human-readable tags and labels to versions.
 */
export interface VersionTagger {
  tag(versionId: VersionId, tag: string): Promise<SIEResult<void>>;
  untag(versionId: VersionId, tag: string): Promise<SIEResult<void>>;
  setLabel(versionId: VersionId, label: string): Promise<SIEResult<void>>;
  findByTag(schemaId: SchemaId, tag: string): Promise<SIEResult<SchemaVersionSummary[]>>;
  findByLabel(schemaId: SchemaId, label: string): Promise<SIEResult<SchemaVersionSummary | null>>;
}

// ─── Schema Snapshot Reconstructor ───────────────────────────────────────

/**
 * Rebuilds any historical schema version from a base snapshot + patch chain.
 * Allows storing only deltas rather than full schemas for older versions.
 */
export interface SnapshotReconstructor {
  reconstruct(versionId: VersionId, store: SchemaVersionStore): Promise<SIEResult<CanonicalSchema>>;
  applyPatch(base: CanonicalSchema, patch: SchemaPatch): SIEResult<CanonicalSchema>;
}

// ─── Version Comparator ───────────────────────────────────────────────────

/**
 * Version-aware comparator that uses the version store.
 */
export interface VersionComparator {
  compare(
    fromVersionId: VersionId,
    toVersionId: VersionId,
    store: SchemaVersionStore
  ): Promise<SIEResult<SchemaDiff>>;

  compareLatestWithPrevious(
    schemaId: SchemaId,
    store: SchemaVersionStore
  ): Promise<SIEResult<SchemaDiff | null>>;
}
