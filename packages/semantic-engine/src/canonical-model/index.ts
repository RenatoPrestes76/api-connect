/**
 * @seltriva/semantic-engine/canonical-model
 * Canonical Business Model (CBM) — the universal business schema expressed in CBL
 *
 * The CBM is what the USME produces as output: a schema where every entity
 * and field is labeled with a CBL term, giving it universally understood meaning.
 *
 * Think of it as a "business-annotated CanonicalSchema":
 * each CanonicalEntity gets mapped to a CBLEntityTerm,
 * each CanonicalField gets mapped to a CBLFieldTerm.
 */

import type {
  CBLEntityTerm,
  CBLFieldTerm,
  CBLRelationshipTerm,
  CBLEntityKind,
  CBLFieldKind,
  CBLDomainKind,
  SemanticResult,
} from '../business-language/index';

// ─── Canonical Business Model ─────────────────────────────────────────────

/**
 * The root output of the USME.
 * A fully annotated schema where every structural element has a CBL meaning.
 */
export interface CanonicalBusinessModel {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly version: string;
  readonly entities: CBMEntity[];
  readonly relationships: CBMRelationship[];
  readonly domain: CBLDomainKind;
  readonly statistics: CBMStatistics;
  readonly confidence: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly metadata?: Record<string, unknown>;
}

export interface CBMStatistics {
  readonly totalEntities: number;
  readonly mappedEntities: number;
  readonly unmappedEntities: number;
  readonly totalFields: number;
  readonly mappedFields: number;
  readonly unmappedFields: number;
  readonly averageConfidence: number;
  readonly pendingValidationCount: number;
}

// ─── CBM Entity ───────────────────────────────────────────────────────────

/**
 * A business entity with its semantic label and all mapped fields.
 */
export interface CBMEntity {
  readonly id: string;
  readonly cblTerm: CBLEntityTerm;
  readonly entityKind: CBLEntityKind;
  readonly domain: CBLDomainKind;

  /** Original name from the source (table name, collection name, etc.) */
  readonly sourceName: string;
  readonly sourceEntityId?: string;

  readonly fields: CBMField[];
  readonly primaryKeyFields: string[];
  readonly confidence: number;
  readonly mappingStatus: MappingStatus;
  readonly description?: string;
  readonly isDeprecated?: boolean;
  readonly metadata?: Record<string, unknown>;
}

// ─── CBM Field ────────────────────────────────────────────────────────────

/**
 * A business field with its semantic label.
 */
export interface CBMField {
  readonly id: string;
  readonly cblTerm: CBLFieldTerm;
  readonly fieldKind: CBLFieldKind;

  /** Original field name from the source */
  readonly sourceName: string;
  readonly sourceFieldId?: string;

  readonly nativeType?: string;
  readonly canonicalType?: string;
  readonly nullable: boolean;
  readonly confidence: number;
  readonly mappingStatus: MappingStatus;
  readonly description?: string;
  readonly examples?: string[];
  readonly businessRules?: string[];
  readonly metadata?: Record<string, unknown>;
}

// ─── CBM Relationship ─────────────────────────────────────────────────────

/**
 * A semantic relationship between two CBM entities.
 */
export interface CBMRelationship {
  readonly id: string;
  readonly cblTerm: CBLRelationshipTerm;
  readonly sourceEntity: string;
  readonly targetEntity: string;
  readonly cardinality: CBMCardinality;
  readonly confidence: number;
  readonly mappingStatus: MappingStatus;
  readonly isInferred: boolean;
  readonly description?: string;
}

export type CBMCardinality = '1:1' | '1:N' | 'N:1' | 'N:M';

// ─── Mapping Status ───────────────────────────────────────────────────────

export type MappingStatus =
  | 'confirmed'
  | 'pending-validation'
  | 'auto-approved'
  | 'rejected'
  | 'unmapped'
  | 'ambiguous';

// ─── CBM Builder ─────────────────────────────────────────────────────────

/**
 * Constructs a CanonicalBusinessModel from semantic mapping results.
 */
export interface CBMBuilder {
  /**
   * Start a new CBM build session
   */
  begin(name: string): CBMBuildSession;
}

export interface CBMBuildSession {
  addEntity(entity: Omit<CBMEntity, 'id'>): CBMBuildSession;
  addRelationship(relationship: Omit<CBMRelationship, 'id'>): CBMBuildSession;
  setDomain(domain: CBLDomainKind): CBMBuildSession;
  build(): SemanticResult<CanonicalBusinessModel>;
}

// ─── CBM Store ────────────────────────────────────────────────────────────

/**
 * Persistence interface for canonical business models.
 */
export interface CBMStore {
  save(model: CanonicalBusinessModel): Promise<SemanticResult<string>>;
  get(modelId: string): Promise<SemanticResult<CanonicalBusinessModel>>;
  getLatest(name: string): Promise<SemanticResult<CanonicalBusinessModel | null>>;
  list(options?: CBMListOptions): Promise<SemanticResult<CBMSummary[]>>;
  delete(modelId: string): Promise<SemanticResult<void>>;
  exists(modelId: string): Promise<boolean>;
}

export interface CBMListOptions {
  readonly domain?: CBLDomainKind;
  readonly minConfidence?: number;
  readonly limit?: number;
  readonly offset?: number;
}

export interface CBMSummary {
  readonly id: string;
  readonly name: string;
  readonly domain: CBLDomainKind;
  readonly entityCount: number;
  readonly averageConfidence: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// ─── CBM Snapshot / Versioning ────────────────────────────────────────────

/**
 * An immutable snapshot of a CBM at a point in time.
 * Allows detecting when semantic mappings change.
 */
export interface CBMSnapshot {
  readonly snapshotId: string;
  readonly modelId: string;
  readonly version: string;
  readonly checksum: string;
  readonly takenAt: Date;
  readonly statistics: CBMStatistics;
}

export interface CBMSnapshotStore {
  take(model: CanonicalBusinessModel): SemanticResult<CBMSnapshot>;
  get(snapshotId: string): Promise<SemanticResult<CBMSnapshot>>;
  listForModel(modelId: string): Promise<SemanticResult<CBMSnapshot[]>>;
  diff(snapshotA: CBMSnapshot, snapshotB: CBMSnapshot): CBMDiff;
}

export interface CBMDiff {
  readonly addedEntities: CBMEntity[];
  readonly removedEntities: CBMEntity[];
  readonly remappedEntities: Array<{ entity: string; from: CBLEntityTerm; to: CBLEntityTerm }>;
  readonly addedFields: Array<{ entity: string; field: CBMField }>;
  readonly removedFields: Array<{ entity: string; fieldName: string }>;
  readonly remappedFields: Array<{ entity: string; field: string; from: CBLFieldTerm; to: CBLFieldTerm }>;
  readonly hasChanges: boolean;
}
