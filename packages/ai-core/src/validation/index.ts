/**
 * @seltriva/ai-core/validation
 * AI Validation Layer — validates both AI outputs and integration structures
 *
 * Two roles:
 *   1. Validate AI outputs before they leave ATHENA
 *      (are recommendations coherent? complete? safe to present?)
 *   2. AI-assisted integration validation
 *      (detect anomalies, suggest rules, flag suspicious patterns)
 *
 * The ValidationAnalystAgent uses this module to power its analysis.
 */

import type {
  AIResult, AgentId, AITaskType,
} from '../providers/index';
import type { AIRecommendation } from '../recommendations/index';
import type { Explanation } from '../explainability/index';

// ─── AI Validation Engine ─────────────────────────────────────────────────

export interface AIValidationEngine {
  /**
   * Validate an AI recommendation before it is presented to the user
   */
  validateRecommendation(recommendation: AIRecommendation): AIRecommendationValidation;

  /**
   * Validate a batch of recommendations
   */
  validateBatch(recommendations: AIRecommendation[]): AIRecommendationValidation[];

  /**
   * Validate that an explanation is complete and coherent
   */
  validateExplanation(explanation: Explanation<unknown>): ExplanationValidation;

  /**
   * Run AI-assisted anomaly detection on an integration structure
   */
  detectAnomalies(input: AnomalyDetectionInput): Promise<AIResult<AnomalyDetectionResult>>;

  /**
   * Suggest validation rules based on observed schema patterns
   */
  suggestRules(input: RuleSuggestionInput): Promise<AIResult<AIValidationRule[]>>;

  /**
   * Register a custom AI output validator
   */
  registerOutputValidator(validator: AIOutputValidator): void;
}

// ─── AI Recommendation Validation ────────────────────────────────────────

export interface AIRecommendationValidation {
  readonly recommendationId: string;
  readonly isValid: boolean;
  readonly issues: AIValidationIssue[];
  readonly hasReasoning: boolean;
  readonly hasExplanation: boolean;
  readonly hasAlternatives: boolean;
  readonly confidenceIsCalibrated: boolean;
  readonly qualityScore: number;
}

export interface ExplanationValidation {
  readonly isValid: boolean;
  readonly hasReason: boolean;
  readonly hasEvidence: boolean;
  readonly evidenceCount: number;
  readonly hasAlternatives: boolean;
  readonly issues: string[];
}

// ─── AI Validation Issues ─────────────────────────────────────────────────

export interface AIValidationIssue {
  readonly code: AIValidationIssueCode;
  readonly severity: 'blocking' | 'warning' | 'info';
  readonly message: string;
  readonly field?: string;
}

export type AIValidationIssueCode =
  | 'MISSING_EXPLANATION'
  | 'MISSING_EVIDENCE'
  | 'MISSING_ALTERNATIVES'
  | 'CONFIDENCE_OUT_OF_RANGE'
  | 'EXPIRED_RECOMMENDATION'
  | 'UNKNOWN_AGENT'
  | 'MALFORMED_PAYLOAD'
  | 'REASONING_CHAIN_MISSING'
  | 'INCOHERENT_REASONING'
  | 'DUPLICATE_RECOMMENDATION';

// ─── Anomaly Detection ────────────────────────────────────────────────────

export interface AnomalyDetectionInput {
  readonly entityName: string;
  readonly fieldNames: string[];
  readonly fieldTypes: string[];
  readonly expectedEntityKind?: string;
  readonly expectedFieldKinds?: string[];
  readonly erpProfileId?: string;
}

export interface AnomalyDetectionResult {
  readonly entityName: string;
  readonly anomalies: DetectedAnomaly[];
  readonly overallSeverity: 'critical' | 'high' | 'medium' | 'low' | 'none';
  readonly summary: string;
}

export interface DetectedAnomaly {
  readonly id: string;
  readonly kind: AnomalyKind;
  readonly severity: 'critical' | 'high' | 'medium' | 'low';
  readonly description: string;
  readonly affectedField?: string;
  readonly evidence: string[];
  readonly suggestedFix?: string;
}

export type AnomalyKind =
  | 'unexpected-field-type'      // field type inconsistent with CBL kind
  | 'missing-expected-field'     // entity kind expects a field that's absent
  | 'duplicate-semantic-role'    // two fields appear to serve the same role
  | 'naming-inconsistency'       // naming convention breaks mid-entity
  | 'suspicious-nullable'        // required field marked nullable
  | 'orphaned-foreign-key'       // FK has no matching entity in context
  | 'unusual-field-count'        // entity has unusual number of fields
  | 'conflicting-field-roles'    // fields with conflicting inferred roles
  | 'missing-audit-fields';      // entity lacks standard audit fields

// ─── Rule Suggestion ──────────────────────────────────────────────────────

export interface RuleSuggestionInput {
  readonly entityKind?: string;
  readonly fieldKinds?: string[];
  readonly observedPatterns?: string[];
  readonly existingRuleIds?: string[];
  readonly domain?: string;
}

export interface AIValidationRule {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly scope: 'entity' | 'field' | 'relationship' | 'schema';
  readonly appliesTo: { entityKinds?: string[]; fieldKinds?: string[] };
  readonly condition: string;
  readonly rationale: string;
  readonly confidence: number;
  readonly isAIGenerated: true;
}

// ─── Custom Output Validator ──────────────────────────────────────────────

export interface AIOutputValidator {
  readonly id: string;
  readonly name: string;
  appliesTo(recommendation: AIRecommendation): boolean;
  validate(recommendation: AIRecommendation): AIValidationIssue[];
}

// ─── Integration Validation (AI-assisted) ────────────────────────────────

export interface IntegrationValidationEngine {
  /**
   * Validate a complete integration configuration for structural issues
   */
  validateIntegration(input: IntegrationValidationInput): Promise<AIResult<IntegrationValidationResult>>;

  /**
   * Check if a mapping transformation is safe and semantically correct
   */
  validateTransformation(transformation: TransformationValidationInput): Promise<AIResult<TransformationValidationResult>>;
}

export interface IntegrationValidationInput {
  readonly connectorId: string;
  readonly entityMappings: Array<{
    sourceEntity: string;
    targetEntity: string;
    fieldMappings: Array<{ sourceField: string; targetField: string; transformation?: string }>;
  }>;
  readonly options?: { strict?: boolean };
}

export interface IntegrationValidationResult {
  readonly isValid: boolean;
  readonly issues: AIValidationIssue[];
  readonly warnings: string[];
  readonly suggestions: string[];
  readonly entityResults: Array<{
    entityName: string;
    isValid: boolean;
    issues: AIValidationIssue[];
  }>;
}

export interface TransformationValidationInput {
  readonly sourceField: string;
  readonly targetField: string;
  readonly transformation: string;
  readonly sourceType: string;
  readonly targetType: string;
  readonly sourceCBLTerm?: string;
  readonly targetCBLTerm?: string;
}

export interface TransformationValidationResult {
  readonly isValid: boolean;
  readonly isSemanticallySound: boolean;
  readonly typeCompatible: boolean;
  readonly issues: AIValidationIssue[];
  readonly warnings: string[];
}
