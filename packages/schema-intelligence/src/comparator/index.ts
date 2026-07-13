/**
 * @seltriva/schema-intelligence/comparator
 * Schema Comparator — structural diff between two CanonicalSchema versions
 *
 * Compares field presence, type changes, constraint changes, and relationship
 * changes. Classifies each change as breaking or non-breaking.
 * Includes probabilistic rename detection (field disappeared + similar field appeared).
 */

import type { EntityId, FieldId, ChangeSeverity, ConfidenceScore } from '../models/index';
import type { SIEResult } from '../core/index';
import type {
  CanonicalSchema,
  CanonicalEntity,
  CanonicalField,
  CanonicalType,
  CanonicalRelationship,
} from '../canonical/index';

// ─── Schema Comparator ────────────────────────────────────────────────────

/**
 * Primary comparator interface.
 */
export interface SchemaComparator {
  /**
   * Compare two full schemas and return a comprehensive diff report
   */
  compare(before: CanonicalSchema, after: CanonicalSchema): SIEResult<SchemaDiff>;

  /**
   * Compare only a single entity across two schema versions
   */
  compareEntity(before: CanonicalEntity, after: CanonicalEntity): SIEResult<EntityDiff>;

  /**
   * Compare two field definitions
   */
  compareField(before: CanonicalField, after: CanonicalField): FieldDiff;

  /**
   * Return only the breaking changes from a diff
   */
  extractBreakingChanges(diff: SchemaDiff): BreakingChange[];
}

// ─── Schema Diff ──────────────────────────────────────────────────────────

export interface SchemaDiff {
  readonly beforeId: string;
  readonly afterId: string;
  readonly beforeName: string;
  readonly afterName: string;

  readonly addedEntities: CanonicalEntity[];
  readonly removedEntities: CanonicalEntity[];
  readonly modifiedEntities: EntityDiff[];
  readonly renamedEntities: RenameDetection[];

  readonly addedRelationships: CanonicalRelationship[];
  readonly removedRelationships: CanonicalRelationship[];

  readonly summary: DiffSummary;
  readonly breakingChanges: BreakingChange[];
  readonly comparedAt: Date;
  readonly durationMs: number;
}

export interface DiffSummary {
  readonly hasChanges: boolean;
  readonly hasBreakingChanges: boolean;
  readonly addedEntityCount: number;
  readonly removedEntityCount: number;
  readonly modifiedEntityCount: number;
  readonly renamedEntityCount: number;
  readonly addedFieldCount: number;
  readonly removedFieldCount: number;
  readonly modifiedFieldCount: number;
  readonly renamedFieldCount: number;
  readonly breakingChangeCount: number;
  readonly nonBreakingChangeCount: number;
}

// ─── Entity Diff ──────────────────────────────────────────────────────────

export interface EntityDiff {
  readonly entityId: EntityId;
  readonly entityName: string;

  readonly addedFields: CanonicalField[];
  readonly removedFields: CanonicalField[];
  readonly modifiedFields: FieldDiff[];
  readonly renamedFields: RenameDetection[];

  readonly constraintChanges: ConstraintDiff[];
  readonly indexChanges: IndexDiff[];

  readonly hasBreakingChanges: boolean;
  readonly severity: ChangeSeverity;
}

// ─── Field Diff ───────────────────────────────────────────────────────────

export interface FieldDiff {
  readonly fieldId: FieldId;
  readonly fieldName: string;
  readonly entityName: string;

  readonly typeChange?: TypeChange;
  readonly nullabilityChange?: NullabilityChange;
  readonly defaultValueChange?: DefaultValueChange;
  readonly requiredChange?: RequiredChange;
  readonly roleChange?: RoleChange;
  readonly descriptionChange?: StringChange;

  readonly severity: ChangeSeverity;
  readonly breakingReasons: string[];
}

export interface TypeChange {
  readonly before: CanonicalType;
  readonly after: CanonicalType;
  readonly isBreaking: boolean;
  readonly reason: string;
}

export interface NullabilityChange {
  readonly before: boolean;
  readonly after: boolean;
  readonly isBreaking: boolean;
}

export interface DefaultValueChange {
  readonly before: unknown;
  readonly after: unknown;
  readonly isBreaking: boolean;
}

export interface RequiredChange {
  readonly before: boolean;
  readonly after: boolean;
  readonly isBreaking: boolean;
}

export interface RoleChange {
  readonly before: string;
  readonly after: string;
}

export interface StringChange {
  readonly before?: string;
  readonly after?: string;
}

// ─── Constraint / Index Diff ──────────────────────────────────────────────

export interface ConstraintDiff {
  readonly action: 'added' | 'removed' | 'modified';
  readonly constraintName?: string;
  readonly constraintKind: string;
  readonly isBreaking: boolean;
  readonly details?: Record<string, unknown>;
}

export interface IndexDiff {
  readonly action: 'added' | 'removed' | 'modified';
  readonly indexName: string;
  readonly isBreaking: boolean;
  readonly details?: Record<string, unknown>;
}

// ─── Rename Detection ─────────────────────────────────────────────────────

/**
 * Probabilistic rename: a field/entity disappeared AND a structurally similar
 * one appeared. Confidence is derived from name similarity + type similarity.
 */
export interface RenameDetection {
  readonly beforeName: string;
  readonly afterName: string;
  readonly confidence: ConfidenceScore;
  readonly evidence: RenameEvidence[];
  readonly isAutoAccepted: boolean;
}

export interface RenameEvidence {
  readonly type: 'name-similarity' | 'type-match' | 'position' | 'fingerprint-match' | 'role-match';
  readonly contribution: number;
  readonly detail: string;
}

// ─── Breaking Change Classifier ───────────────────────────────────────────

/**
 * Classifies a diff into breaking and non-breaking changes.
 * Rules are independently configurable.
 */
export interface BreakingChangeClassifier {
  classify(diff: SchemaDiff): BreakingChange[];
  classifyFieldDiff(diff: FieldDiff): BreakingChange[];
  addRule(rule: BreakingChangeRule): void;
  removeRule(ruleId: string): void;
  getRules(): BreakingChangeRule[];
}

export interface BreakingChange {
  readonly id: string;
  readonly category: BreakingChangeCategory;
  readonly severity: 'critical' | 'major' | 'minor';
  readonly entityName?: string;
  readonly fieldName?: string;
  readonly description: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly migrationHint?: string;
}

export type BreakingChangeCategory =
  | 'entity-removed'
  | 'field-removed'
  | 'field-type-narrowed'
  | 'field-type-changed'
  | 'field-made-required'
  | 'field-made-non-nullable'
  | 'primary-key-changed'
  | 'foreign-key-removed'
  | 'unique-constraint-removed'
  | 'check-constraint-added'
  | 'relationship-removed'
  | 'enum-value-removed';

export interface BreakingChangeRule {
  readonly id: string;
  readonly category: BreakingChangeCategory;
  readonly description: string;
  evaluate(diff: SchemaDiff | FieldDiff | EntityDiff): BreakingChange[];
}

// ─── Rename Detector ──────────────────────────────────────────────────────

/**
 * Standalone rename detection — decoupled from the main comparator
 * so it can use different similarity thresholds or algorithms.
 */
export interface RenameDetector {
  detectEntityRenames(
    removed: CanonicalEntity[],
    added: CanonicalEntity[],
    options?: RenameDetectionOptions
  ): RenameDetection[];

  detectFieldRenames(
    removed: CanonicalField[],
    added: CanonicalField[],
    entityName: string,
    options?: RenameDetectionOptions
  ): RenameDetection[];
}

export interface RenameDetectionOptions {
  readonly minConfidence?: number;
  readonly autoAcceptThreshold?: number;
  readonly maxCandidatesPerSource?: number;
  readonly weights?: RenameWeights;
}

export interface RenameWeights {
  readonly nameSimilarity: number;
  readonly typeMatch: number;
  readonly positionProximity: number;
  readonly roleMatch: number;
}
