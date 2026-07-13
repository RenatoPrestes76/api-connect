/**
 * @seltriva/schema-intelligence/detector
 * Change Detection Engine — tracks schema evolution over time
 *
 * Distinct from the comparator (which does a point-in-time diff).
 * The detector maintains temporal awareness: it knows the current version,
 * the previous version, and what changed. It classifies breaking changes
 * and suggests field mappings for consumers impacted by the change.
 */

import type { VersionId, SchemaId, ChangeSeverity, ConfidenceScore } from '../models/index';
import type { SIEResult } from '../core/index';
import type { CanonicalSchema, CanonicalField } from '../canonical/index';
import type { SchemaDiff, BreakingChange } from '../comparator/index';

// ─── Change Detection Engine ──────────────────────────────────────────────

export interface ChangeDetectionEngine {
  /**
   * Process a new schema version — detect what changed from the previous version
   */
  detect(
    schemaId: SchemaId,
    newSchema: CanonicalSchema,
    options?: DetectionOptions
  ): Promise<SIEResult<ChangeDetectionReport>>;

  /**
   * Compare two specific versions directly
   */
  detectBetween(
    schemaId: SchemaId,
    fromVersionId: VersionId,
    toVersionId: VersionId
  ): Promise<SIEResult<ChangeDetectionReport>>;

  /**
   * Get the accumulated change history for a schema
   */
  getHistory(schemaId: SchemaId, limit?: number): Promise<SIEResult<ChangeDetectionReport[]>>;

  /**
   * Subscribe to change events for a schema
   */
  onDetected(schemaId: SchemaId, handler: (report: ChangeDetectionReport) => void): string;

  offDetected(subscriptionId: string): void;
}

export interface DetectionOptions {
  readonly compareWithVersionId?: VersionId;
  readonly detectRenames?: boolean;
  readonly classifyBreaking?: boolean;
  readonly generateMappingSuggestions?: boolean;
  readonly minRenameConfidence?: number;
}

// ─── Change Detection Report ──────────────────────────────────────────────

/**
 * The output of a detection run — the "what changed and what should I do" document.
 */
export interface ChangeDetectionReport {
  readonly id: string;
  readonly schemaId: SchemaId;
  readonly fromVersionId: VersionId | null;
  readonly toVersionId: VersionId;
  readonly detectedAt: Date;

  readonly diff: SchemaDiff;
  readonly breakingChanges: BreakingChange[];
  readonly evolutionEvents: EvolutionEvent[];
  readonly mappingSuggestions: MappingSuggestion[];

  readonly summary: ChangeDetectionSummary;
  readonly impactAssessment: ImpactAssessment;
}

export interface ChangeDetectionSummary {
  readonly hasChanges: boolean;
  readonly hasBreakingChanges: boolean;
  readonly totalEvents: number;
  readonly breakingEventCount: number;
  readonly addedFields: number;
  readonly removedFields: number;
  readonly renamedFields: number;
  readonly typeChanges: number;
  readonly evolutionScore: number;
}

// ─── Evolution Events ─────────────────────────────────────────────────────

/**
 * A discrete, classified change event.
 * More granular than BreakingChange — covers all changes, not just breaking ones.
 */
export interface EvolutionEvent {
  readonly id: string;
  readonly kind: EvolutionEventKind;
  readonly severity: ChangeSeverity;
  readonly entityName: string;
  readonly fieldName?: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly description: string;
  readonly isBreaking: boolean;
  readonly migrationRequired: boolean;
  readonly migrationHint?: string;
}

export type EvolutionEventKind =
  | 'entity-added'
  | 'entity-removed'
  | 'entity-renamed'
  | 'field-added'
  | 'field-added-required'
  | 'field-removed'
  | 'field-renamed'
  | 'field-type-changed'
  | 'field-type-widened'
  | 'field-type-narrowed'
  | 'field-made-nullable'
  | 'field-made-non-nullable'
  | 'field-made-required'
  | 'field-made-optional'
  | 'field-default-added'
  | 'field-default-removed'
  | 'field-default-changed'
  | 'constraint-added'
  | 'constraint-removed'
  | 'index-added'
  | 'index-removed'
  | 'relationship-added'
  | 'relationship-removed'
  | 'enum-value-added'
  | 'enum-value-removed';

// ─── Mapping Suggestions ──────────────────────────────────────────────────

/**
 * Suggests how consumers should update their field references after a schema change.
 * Generated when fields are removed, renamed, or their type changed.
 */
export interface MappingSuggestion {
  readonly id: string;
  readonly kind: MappingSuggestionKind;
  readonly entityName: string;
  readonly sourceField: string;
  readonly targetField?: string;
  readonly confidence: ConfidenceScore;
  readonly transformationRequired: boolean;
  readonly transformationHint?: string;
  readonly evidence: string[];
  readonly autoApplicable: boolean;
}

export type MappingSuggestionKind =
  | 'field-rename'
  | 'field-merge'
  | 'field-split'
  | 'type-cast'
  | 'use-default'
  | 'compute-from'
  | 'use-null'
  | 'manual-required';

// ─── Impact Assessment ────────────────────────────────────────────────────

/**
 * High-level impact assessment for consumers of the schema.
 */
export interface ImpactAssessment {
  readonly riskLevel: RiskLevel;
  readonly requiresMigration: boolean;
  readonly migrationComplexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'unknown';
  readonly affectedEntities: string[];
  readonly affectedFields: Array<{ entity: string; field: string }>;
  readonly automaticMigrationPossible: boolean;
  readonly reviewRequired: boolean;
  readonly notes: string[];
}

export type RiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

// ─── Schema Evolution Tracker ─────────────────────────────────────────────

/**
 * Monitors a schema over time and accumulates change history.
 */
export interface SchemaEvolutionTracker {
  readonly schemaId: SchemaId;

  submit(schema: CanonicalSchema): Promise<SIEResult<ChangeDetectionReport>>;
  getLatestReport(): ChangeDetectionReport | null;
  getHistory(): ChangeDetectionReport[];

  isTracking(): boolean;
  reset(): void;
}

// ─── Breaking Change Advisor ──────────────────────────────────────────────

/**
 * Given a set of breaking changes, produces human-readable migration advice.
 */
export interface BreakingChangeAdvisor {
  advise(breakingChanges: BreakingChange[]): BreakingChangeAdvice[];
  prioritize(changes: BreakingChange[]): BreakingChange[];
}

export interface BreakingChangeAdvice {
  readonly change: BreakingChange;
  readonly action: 'migrate' | 'deprecate' | 'coordinate' | 'inform' | 'test';
  readonly steps: string[];
  readonly effort: 'low' | 'medium' | 'high';
  readonly automatable: boolean;
}

// ─── Field Evolution Pattern ──────────────────────────────────────────────

/**
 * Captures recurring field evolution patterns for learning.
 */
export interface FieldEvolutionPattern {
  readonly patternId: string;
  readonly name: string;
  readonly fromType: string;
  readonly toType: string;
  readonly frequency: number;
  readonly firstObservedAt: Date;
  readonly lastObservedAt: Date;
  readonly examples: Array<{ entity: string; field: string }>;
}
