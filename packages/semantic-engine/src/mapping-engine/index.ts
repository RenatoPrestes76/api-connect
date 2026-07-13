/**
 * @seltriva/semantic-engine/mapping-engine
 * Mapping Engine — orchestrates the full semantic mapping pipeline
 *
 * This is the primary entry point of the USME. It wires together:
 *   SemanticAnalyzer → ConfidenceEngine → SuggestionSystem →
 *   ValidationQueue → LearningEngine → MappingRegistry
 *
 * A mapping session processes one CanonicalSchema at a time.
 * It produces a CanonicalBusinessModel (CBM) — the schema with every
 * entity and field annotated with their CBL meaning.
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
import type {
  CanonicalBusinessModel,
  CBMEntity,
  CBMField,
  MappingStatus,
} from '../canonical-model/index';
import type { SuggestionBundle, EntitySuggestion, FieldSuggestion } from '../suggestions/index';

// ─── Mapping Engine ───────────────────────────────────────────────────────

export interface SemanticMappingEngine {
  /**
   * Begin a mapping session for a schema.
   * Accepts the raw schema description (entity/field names + types).
   */
  beginSession(input: MappingSessionInput): SemanticResult<MappingSession>;

  /**
   * Process a session fully (analyze → suggest → auto-approve → pending queue)
   */
  process(sessionId: string): Promise<SemanticResult<MappingSessionResult>>;

  /**
   * Resume a previously created session
   */
  getSession(sessionId: string): MappingSession | null;

  /**
   * Manually map an entity to a CBL term
   */
  mapEntity(
    sessionId: string,
    entityName: string,
    term: CBLEntityTerm,
    confirmedBy: string
  ): SemanticResult<CBMEntity>;

  /**
   * Manually map a field to a CBL term
   */
  mapField(
    sessionId: string,
    entityName: string,
    fieldName: string,
    term: CBLFieldTerm,
    confirmedBy: string
  ): SemanticResult<CBMField>;

  /**
   * Get the current state of a model being built
   */
  getCurrentModel(sessionId: string): SemanticResult<CanonicalBusinessModel>;

  /**
   * Finalize and commit the model
   */
  finalizeModel(
    sessionId: string,
    options?: FinalizeOptions
  ): Promise<SemanticResult<CanonicalBusinessModel>>;
}

// ─── Mapping Session Input ────────────────────────────────────────────────

export interface MappingSessionInput {
  readonly schemaName: string;
  readonly connectorId?: string;
  readonly erpProfileId?: string;
  readonly entities: EntityMappingInput[];
  readonly options?: MappingOptions;
  readonly requestedBy?: string;
}

export interface EntityMappingInput {
  readonly name: string;
  readonly originalName?: string;
  readonly fields: FieldMappingInput[];
  readonly foreignKeyTargets?: string[];
  readonly namespace?: string;
}

export interface FieldMappingInput {
  readonly name: string;
  readonly originalName?: string;
  readonly nativeType?: string;
  readonly canonicalType?: string;
  readonly nullable?: boolean;
  readonly isPrimaryKey?: boolean;
  readonly isForeignKey?: boolean;
  readonly isUnique?: boolean;
  readonly position?: number;
}

export interface MappingOptions {
  readonly autoApproveThreshold?: ConfidenceValue;
  readonly maxCandidatesPerField?: number;
  readonly useGraphCoherence?: boolean;
  readonly domains?: CBLDomainKind[];
  readonly strictMode?: boolean;
}

// ─── Mapping Session ──────────────────────────────────────────────────────

export interface MappingSession {
  readonly id: string;
  readonly schemaName: string;
  readonly status: MappingSessionStatus;
  readonly erpProfileId?: string;
  readonly requestedBy?: string;
  readonly createdAt: Date;
  readonly processedAt?: Date;
  readonly finalizedAt?: Date;
  readonly statistics: MappingSessionStatistics;
}

export type MappingSessionStatus =
  | 'created'
  | 'analyzing'
  | 'pending-validation'
  | 'finalized'
  | 'failed';

export interface MappingSessionStatistics {
  readonly totalEntities: number;
  readonly totalFields: number;
  readonly autoApproved: number;
  readonly pendingReview: number;
  readonly confirmed: number;
  readonly rejected: number;
  readonly unmapped: number;
  readonly averageConfidence: ConfidenceValue;
}

// ─── Mapping Session Result ───────────────────────────────────────────────

export interface MappingSessionResult {
  readonly sessionId: string;
  readonly model: CanonicalBusinessModel;
  readonly suggestionBundles: SuggestionBundle[];
  readonly autoApprovedCount: number;
  readonly pendingValidationCount: number;
  readonly statistics: MappingSessionStatistics;
  readonly processedAt: Date;
  readonly durationMs: number;
}

// ─── Finalize Options ─────────────────────────────────────────────────────

export interface FinalizeOptions {
  readonly allowUnmapped?: boolean;
  readonly requireMinConfidence?: ConfidenceValue;
  readonly allowPendingValidation?: boolean;
}

// ─── Semantic Mapping (confirmed) ─────────────────────────────────────────

/**
 * A confirmed, persisted semantic mapping — the result of a validated suggestion.
 */
export interface SemanticMapping {
  readonly id: string;
  readonly kind: 'entity' | 'field';
  readonly sourceName: string;
  readonly cblTerm: CBLEntityTerm | CBLFieldTerm;
  readonly entityKind?: CBLEntityKind;
  readonly fieldKind?: CBLFieldKind;
  readonly entityName?: string;
  readonly confidence: ConfidenceValue;
  readonly status: MappingStatus;
  readonly erpProfileId?: string;
  readonly schemaId?: string;
  readonly confirmedBy?: string;
  readonly confirmedAt?: Date;
  readonly learnedAt?: Date;
  readonly metadata?: Record<string, unknown>;
}

// ─── Mapping Store ────────────────────────────────────────────────────────

export interface SemanticMappingStore {
  save(mapping: SemanticMapping): Promise<SemanticResult<string>>;
  getById(id: string): Promise<SemanticResult<SemanticMapping | null>>;

  findBySourceName(
    sourceName: string,
    entityName?: string
  ): Promise<SemanticResult<SemanticMapping[]>>;

  findByCBLTerm(term: CBLEntityTerm | CBLFieldTerm): Promise<SemanticResult<SemanticMapping[]>>;

  findBySchema(schemaId: string): Promise<SemanticResult<SemanticMapping[]>>;
  findByProfile(erpProfileId: string): Promise<SemanticResult<SemanticMapping[]>>;
  delete(id: string): Promise<SemanticResult<void>>;
  count(): Promise<number>;
}

// ─── Mapping Event ────────────────────────────────────────────────────────

export interface MappingEvent {
  readonly id: string;
  readonly kind: MappingEventKind;
  readonly mappingId: string;
  readonly sessionId?: string;
  readonly timestamp: Date;
  readonly actor?: string;
  readonly details?: Record<string, unknown>;
}

export type MappingEventKind =
  | 'suggested'
  | 'auto-approved'
  | 'submitted-for-review'
  | 'confirmed'
  | 'rejected'
  | 'modified'
  | 'learned'
  | 'revoked';

export interface MappingEventStore {
  record(event: MappingEvent): Promise<void>;
  getHistory(mappingId: string): Promise<MappingEvent[]>;
  getSessionEvents(sessionId: string): Promise<MappingEvent[]>;
}

// ─── Batch Mapper ─────────────────────────────────────────────────────────

/**
 * Processes multiple schemas in batch, sharing a common ERP profile context.
 */
export interface BatchMappingEngine {
  submitBatch(inputs: MappingSessionInput[]): Promise<SemanticResult<BatchMappingResult>>;
  getBatchProgress(batchId: string): BatchProgress;
}

export interface BatchMappingResult {
  readonly batchId: string;
  readonly sessions: MappingSession[];
  readonly totalSessions: number;
  readonly completedSessions: number;
  readonly failedSessions: number;
  readonly startedAt: Date;
  readonly completedAt?: Date;
}

export interface BatchProgress {
  readonly batchId: string;
  readonly total: number;
  readonly completed: number;
  readonly failed: number;
  readonly percentComplete: number;
}
