/**
 * @seltriva/ai-core/schema-analysis
 * Schema Analysis — AI-powered understanding of database and API schemas
 *
 * The SchemaAnalystAgent uses this module to:
 *   - Classify entities against CBL entity kinds
 *   - Map fields to CBL field kinds
 *   - Detect schema anomalies and structural issues
 *   - Assess impact of schema changes
 *
 * This module works at the boundary between raw schema metadata
 * (from schema-intelligence) and semantic meaning (from semantic-engine).
 * ATHENA adds a reasoning layer on top.
 */

import type { AIResult, AgentId, AIConfidenceValue } from '../providers/index';
import type { AIRecommendation } from '../recommendations/index';

// ─── Schema Analysis Engine ───────────────────────────────────────────────

export interface SchemaAnalysisEngine {
  /**
   * Analyze an entire schema and produce entity + field recommendations
   */
  analyzeSchema(input: SchemaAnalysisInput): Promise<AIResult<SchemaAnalysisReport>>;

  /**
   * Analyze a single entity
   */
  analyzeEntity(input: EntityAnalysisInput): Promise<AIResult<EntityAnalysisReport>>;

  /**
   * Analyze a single field within context
   */
  analyzeField(input: FieldAnalysisInput): Promise<AIResult<FieldAnalysisReport>>;

  /**
   * Detect anomalies across the schema
   */
  detectAnomalies(input: SchemaAnalysisInput): Promise<AIResult<SchemaAnomalyReport>>;

  /**
   * Assess impact of a schema change on existing mappings
   */
  assessChange(input: SchemaChangeAssessmentInput): Promise<AIResult<SchemaChangeReport>>;
}

// ─── Schema Analysis Input ────────────────────────────────────────────────

export interface SchemaAnalysisInput {
  readonly schemaId: string;
  readonly schemaName: string;
  readonly connectorId: string;
  readonly erpProfileId?: string;
  readonly entities: EntityInput[];
  readonly options?: SchemaAnalysisOptions;
}

export interface SchemaAnalysisOptions {
  readonly detectAnomalies?: boolean;
  readonly includeChangeImpact?: boolean;
  readonly minConfidenceToSuggest?: number;
  readonly maxEntitiesPerBatch?: number;
}

export interface EntityInput {
  readonly entityId: string;
  readonly entityName: string;
  readonly fields: FieldInput[];
  readonly foreignKeyTargets?: string[];
  readonly namespace?: string;
  readonly existingCBLTerm?: string;
}

export interface FieldInput {
  readonly fieldId: string;
  readonly fieldName: string;
  readonly nativeType: string;
  readonly nullable?: boolean;
  readonly isPrimaryKey?: boolean;
  readonly isForeignKey?: boolean;
  readonly referencedEntity?: string;
  readonly existingCBLTerm?: string;
}

// ─── Analysis Inputs (single entity / field) ──────────────────────────────

export interface EntityAnalysisInput {
  readonly entityId: string;
  readonly entityName: string;
  readonly fields: FieldInput[];
  readonly foreignKeyTargets?: string[];
  readonly namespace?: string;
  readonly erpProfileId?: string;
  readonly contextEntityNames?: string[];
}

export interface FieldAnalysisInput {
  readonly fieldId: string;
  readonly fieldName: string;
  readonly nativeType: string;
  readonly entityName: string;
  readonly entityCBLTerm?: string;
  readonly entityKind?: string;
  readonly isPrimaryKey?: boolean;
  readonly isForeignKey?: boolean;
  readonly position?: number;
  readonly erpProfileId?: string;
}

// ─── Schema Analysis Report ───────────────────────────────────────────────

export interface SchemaAnalysisReport {
  readonly schemaId: string;
  readonly schemaName: string;
  readonly entityReports: EntityAnalysisReport[];
  readonly anomalyReport?: SchemaAnomalyReport;
  readonly statistics: SchemaAnalysisStatistics;
  readonly recommendations: AIRecommendation[];
  readonly overallConfidence: AIConfidenceValue;
  readonly summary: string;
  readonly generatedAt: Date;
}

export interface SchemaAnalysisStatistics {
  readonly totalEntities: number;
  readonly analyzedEntities: number;
  readonly totalFields: number;
  readonly analyzedFields: number;
  readonly autoClassifiedEntities: number;
  readonly pendingReviewEntities: number;
  readonly anomalyCount: number;
  readonly averageEntityConfidence: number;
  readonly averageFieldConfidence: number;
}

// ─── Entity Analysis Report ───────────────────────────────────────────────

export interface EntityAnalysisReport {
  readonly entityId: string;
  readonly entityName: string;

  /** Top recommended CBL term */
  readonly proposedCBLTerm: string;
  readonly proposedEntityKind: string;
  readonly domain: string;
  readonly confidence: AIConfidenceValue;
  readonly isAutoClassified: boolean;

  /** Alternative candidates ranked by confidence */
  readonly alternatives: EntityCandidateResult[];

  /** Field analysis results */
  readonly fieldReports: FieldAnalysisReport[];

  /** Detected issues specific to this entity */
  readonly issues: SchemaAnalysisIssue[];

  readonly evidenceSummary: string;
  readonly recommendation: AIRecommendation;
}

export interface EntityCandidateResult {
  readonly rank: number;
  readonly cblTerm: string;
  readonly entityKind: string;
  readonly confidence: AIConfidenceValue;
  readonly whyRankedLower?: string;
}

// ─── Field Analysis Report ────────────────────────────────────────────────

export interface FieldAnalysisReport {
  readonly fieldId: string;
  readonly fieldName: string;

  readonly proposedCBLTerm: string;
  readonly proposedFieldKind: string;
  readonly confidence: AIConfidenceValue;
  readonly isAutoClassified: boolean;

  readonly alternatives: FieldCandidateResult[];

  readonly issues: SchemaAnalysisIssue[];
  readonly recommendation: AIRecommendation;
}

export interface FieldCandidateResult {
  readonly rank: number;
  readonly cblTerm: string;
  readonly fieldKind: string;
  readonly confidence: AIConfidenceValue;
  readonly whyRankedLower?: string;
}

// ─── Anomaly Report ───────────────────────────────────────────────────────

export interface SchemaAnomalyReport {
  readonly schemaId: string;
  readonly anomalies: SchemaAnomaly[];
  readonly criticalCount: number;
  readonly highCount: number;
  readonly summary: string;
}

export interface SchemaAnomaly {
  readonly id: string;
  readonly entityId?: string;
  readonly fieldId?: string;
  readonly kind: SchemaAnomalyKind;
  readonly severity: 'critical' | 'high' | 'medium' | 'low';
  readonly description: string;
  readonly evidence: string[];
  readonly suggestedFix?: string;
}

export type SchemaAnomalyKind =
  | 'missing-primary-key'
  | 'unexpected-field-type'
  | 'duplicate-field-role'
  | 'missing-required-field'
  | 'orphaned-foreign-key'
  | 'naming-inconsistency'
  | 'oversized-entity'
  | 'suspicious-nullable'
  | 'missing-audit-fields'
  | 'ambiguous-entity-kind';

// ─── Schema Change Assessment ─────────────────────────────────────────────

export interface SchemaChangeAssessmentInput {
  readonly schemaId: string;
  readonly changes: SchemaChange[];
  readonly affectedMappings?: string[];
}

export interface SchemaChange {
  readonly changeId: string;
  readonly type:
    | 'add-entity'
    | 'remove-entity'
    | 'add-field'
    | 'remove-field'
    | 'rename-field'
    | 'change-type'
    | 'change-nullable';
  readonly entityName: string;
  readonly fieldName?: string;
  readonly previousValue?: string;
  readonly newValue?: string;
}

export interface SchemaChangeReport {
  readonly schemaId: string;
  readonly changes: SchemaChangeImpact[];
  readonly breakingChanges: SchemaChange[];
  readonly migrationRequired: boolean;
  readonly overallRisk: 'critical' | 'high' | 'medium' | 'low';
  readonly summary: string;
  readonly recommendations: AIRecommendation[];
}

export interface SchemaChangeImpact {
  readonly change: SchemaChange;
  readonly isBreaking: boolean;
  readonly affectedMappingIds: string[];
  readonly affectedEntityCount: number;
  readonly riskLevel: 'critical' | 'high' | 'medium' | 'low';
  readonly description: string;
  readonly suggestedAction: string;
}

// ─── Analysis Issues ──────────────────────────────────────────────────────

export interface SchemaAnalysisIssue {
  readonly code: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly message: string;
  readonly hint?: string;
}
