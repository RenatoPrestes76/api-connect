/**
 * @seltriva/ai-core/mapping-analysis
 * Mapping Analysis — AI-powered field mapping optimization and conflict resolution
 *
 * The MappingAnalystAgent uses this module to:
 *   - Suggest optimal field mappings between source and target schemas
 *   - Detect and resolve mapping conflicts
 *   - Recommend transformation functions
 *   - Validate transformation correctness
 *   - Identify semantic mismatches before they cause data problems
 *
 * Works on top of the semantic-engine mapping contracts —
 * adds an AI reasoning layer for complex ambiguous cases.
 */

import type { AIResult, AIConfidenceValue } from '../providers/index';
import type { AIRecommendation } from '../recommendations/index';

// ─── Mapping Analysis Engine ──────────────────────────────────────────────

export interface MappingAnalysisEngine {
  /**
   * Analyze all fields in a source entity and suggest mappings to a target entity
   */
  analyzeMappings(input: MappingAnalysisInput): Promise<AIResult<MappingAnalysisReport>>;

  /**
   * Resolve a specific mapping conflict with AI reasoning
   */
  resolveConflict(
    input: MappingConflictResolutionInput
  ): Promise<AIResult<MappingConflictResolution>>;

  /**
   * Suggest a transformation function between two semantically different fields
   */
  suggestTransformation(
    input: TransformationSuggestionInput
  ): Promise<AIResult<TransformationSuggestion>>;

  /**
   * Validate that a mapping configuration is semantically sound
   */
  validateMapping(input: MappingValidationInput): Promise<AIResult<MappingValidationResult>>;

  /**
   * Detect semantic drift between two versions of a mapping
   */
  detectDrift(input: MappingDriftInput): Promise<AIResult<MappingDriftReport>>;
}

// ─── Mapping Analysis Input ───────────────────────────────────────────────

export interface MappingAnalysisInput {
  readonly connectorId: string;
  readonly sourceEntityName: string;
  readonly targetEntityName: string;
  readonly sourceFields: MappingFieldInput[];
  readonly targetFields: MappingFieldInput[];
  readonly erpProfileId?: string;
  readonly existingMappings?: ExistingMappingHint[];
  readonly options?: MappingAnalysisOptions;
}

export interface MappingFieldInput {
  readonly fieldId: string;
  readonly fieldName: string;
  readonly nativeType: string;
  readonly cblTerm?: string;
  readonly fieldKind?: string;
  readonly nullable?: boolean;
  readonly isPrimaryKey?: boolean;
  readonly isForeignKey?: boolean;
}

export interface MappingAnalysisOptions {
  readonly requireSemanticMatch?: boolean;
  readonly allowTransformations?: boolean;
  readonly strictTypeCheck?: boolean;
  readonly minConfidence?: number;
}

export interface ExistingMappingHint {
  readonly sourceFieldName: string;
  readonly targetFieldName: string;
  readonly isConfirmed: boolean;
  readonly confidence?: number;
}

// ─── Mapping Analysis Report ──────────────────────────────────────────────

export interface MappingAnalysisReport {
  readonly connectorId: string;
  readonly sourceEntityName: string;
  readonly targetEntityName: string;
  readonly mappings: FieldMappingAnalysis[];
  readonly unmappedSourceFields: string[];
  readonly unmappedTargetFields: string[];
  readonly conflicts: MappingConflict[];
  readonly statistics: MappingAnalysisStatistics;
  readonly recommendations: AIRecommendation[];
  readonly overallConfidence: AIConfidenceValue;
  readonly summary: string;
  readonly generatedAt: Date;
}

export interface MappingAnalysisStatistics {
  readonly totalSourceFields: number;
  readonly totalTargetFields: number;
  readonly mappedFieldCount: number;
  readonly conflictCount: number;
  readonly transformationRequiredCount: number;
  readonly autoMappedCount: number;
  readonly pendingReviewCount: number;
  readonly coveragePercent: number;
}

// ─── Field Mapping Analysis ───────────────────────────────────────────────

export interface FieldMappingAnalysis {
  readonly sourceFieldName: string;
  readonly targetFieldName: string;
  readonly sourceCBLTerm?: string;
  readonly targetCBLTerm?: string;
  readonly confidence: AIConfidenceValue;
  readonly matchType: MappingMatchType;
  readonly requiresTransformation: boolean;
  readonly transformation?: TransformationSuggestion;
  readonly semanticCompatibility: SemanticCompatibility;
  readonly issues: MappingIssue[];
  readonly explanation: string;
  readonly recommendation: AIRecommendation;
}

export type MappingMatchType =
  | 'exact-term' // same CBL term
  | 'compatible-term' // different but compatible CBL terms
  | 'name-similarity' // high name similarity
  | 'type-match' // same type, ambiguous name
  | 'structural-match' // structural position match
  | 'fuzzy' // low-confidence fuzzy match
  | 'no-match'; // could not find a mapping

export interface SemanticCompatibility {
  readonly level: 'identical' | 'compatible' | 'lossy' | 'incompatible';
  readonly description: string;
  readonly dataLossRisk: 'none' | 'low' | 'medium' | 'high';
}

// ─── Conflicts ────────────────────────────────────────────────────────────

export interface MappingConflict {
  readonly id: string;
  readonly kind: MappingConflictKind;
  readonly sourceFieldName: string;
  readonly conflictingTargets?: string[];
  readonly description: string;
  readonly severity: 'blocking' | 'warning';
  readonly suggestedResolution?: string;
}

export type MappingConflictKind =
  | 'multiple-candidates' // source field matches multiple target fields
  | 'type-mismatch' // types are semantically incompatible
  | 'semantic-mismatch' // CBL terms suggest different meanings
  | 'precision-loss' // mapping would lose data precision
  | 'nullability-conflict' // source nullable, target required
  | 'ambiguous-target' // target field could serve multiple roles
  | 'missing-required-target'; // a required target field has no source match

// ─── Conflict Resolution ──────────────────────────────────────────────────

export interface MappingConflictResolutionInput {
  readonly conflict: MappingConflict;
  readonly sourceFieldContext: MappingFieldInput;
  readonly targetFieldCandidates: MappingFieldInput[];
  readonly erpProfileId?: string;
  readonly priorResolutions?: string[];
}

export interface MappingConflictResolution {
  readonly conflictId: string;
  readonly resolution:
    | 'map-to-first'
    | 'map-to-transformed'
    | 'split'
    | 'exclude'
    | 'manual-review';
  readonly recommendedTarget?: string;
  readonly transformation?: TransformationSuggestion;
  readonly confidence: AIConfidenceValue;
  readonly rationale: string;
  readonly recommendation: AIRecommendation;
}

// ─── Transformation Suggestions ───────────────────────────────────────────

export interface TransformationSuggestionInput {
  readonly sourceFieldName: string;
  readonly sourceType: string;
  readonly sourceCBLTerm?: string;
  readonly targetFieldName: string;
  readonly targetType: string;
  readonly targetCBLTerm?: string;
  readonly examples?: TransformationExample[];
}

export interface TransformationSuggestion {
  readonly id: string;
  readonly kind: TransformationKind;
  readonly description: string;
  readonly expression?: string;
  readonly pseudoCode?: string;
  readonly isLossy: boolean;
  readonly confidence: AIConfidenceValue;
  readonly risks: string[];
  readonly examples: TransformationExample[];
}

export type TransformationKind =
  | 'type-cast'
  | 'format-conversion'
  | 'unit-conversion'
  | 'enum-mapping'
  | 'null-coalesce'
  | 'string-split'
  | 'string-concat'
  | 'date-format'
  | 'decimal-scale'
  | 'boolean-inversion'
  | 'conditional'
  | 'lookup'
  | 'identity';

export interface TransformationExample {
  readonly sourceValue: string;
  readonly expectedTargetValue: string;
  readonly description?: string;
}

// ─── Mapping Validation ───────────────────────────────────────────────────

export interface MappingValidationInput {
  readonly connectorId: string;
  readonly fieldMappings: Array<{
    sourceField: string;
    targetField: string;
    transformation?: string;
    sourceCBLTerm?: string;
    targetCBLTerm?: string;
    sourceType: string;
    targetType: string;
  }>;
  readonly options?: { strict?: boolean };
}

export interface MappingValidationResult {
  readonly isValid: boolean;
  readonly issues: MappingIssue[];
  readonly warnings: string[];
  readonly semanticIssues: string[];
  readonly fieldResults: Array<{ mapping: string; isValid: boolean; issues: MappingIssue[] }>;
}

export interface MappingIssue {
  readonly code: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly message: string;
  readonly sourceField?: string;
  readonly targetField?: string;
}

// ─── Drift Detection ──────────────────────────────────────────────────────

export interface MappingDriftInput {
  readonly previousMappings: ExistingMappingHint[];
  readonly currentMappings: ExistingMappingHint[];
  readonly entityKind?: string;
}

export interface MappingDriftReport {
  readonly hasDrift: boolean;
  readonly addedMappings: string[];
  readonly removedMappings: string[];
  readonly changedMappings: Array<{ field: string; previous: string; current: string }>;
  readonly confidenceChanges: Array<{ field: string; change: number }>;
  readonly riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'none';
  readonly summary: string;
  readonly recommendations: AIRecommendation[];
}
