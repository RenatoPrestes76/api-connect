/**
 * @seltriva/ai-core/security
 * AI Security Layer — data sensitivity classification and risk assessment
 *
 * The SecurityAnalystAgent uses this module to power its analysis.
 * This module handles:
 *   - Data sensitivity classification (public/internal/confidential/restricted/critical)
 *   - Field-level PII detection by structural metadata (never reads values)
 *   - Regulatory framework mapping (LGPD, GDPR, CCPA, PCI-DSS, HIPAA)
 *   - Risk assessment for integration configurations
 *   - Security rule enforcement for AI recommendations
 *
 * INVARIANT: Classification is based on field names, types, and CBL context.
 * Business data values are NEVER inspected.
 */

import type {
  AIResult, AgentId,
} from '../providers/index';
import type { AIRecommendation } from '../recommendations/index';

// ─── AI Security Engine ───────────────────────────────────────────────────

export interface AISecurityEngine {
  /**
   * Classify data sensitivity for a set of fields
   */
  classifyFields(input: FieldClassificationInput): Promise<AIResult<FieldClassificationResult>>;

  /**
   * Assess security risk for an integration configuration
   */
  assessRisk(input: SecurityRiskInput): Promise<AIResult<SecurityRiskAssessment>>;

  /**
   * Validate that a recommendation does not violate security policies
   */
  validateRecommendation(recommendation: AIRecommendation): SecurityPolicyValidation;

  /**
   * Get sensitivity classification for a known CBL field kind
   */
  getFieldKindClassification(fieldKind: string): SensitivityClassification | null;

  /**
   * Register a custom security policy
   */
  registerPolicy(policy: SecurityPolicy): void;
}

// ─── Sensitivity Classification ───────────────────────────────────────────

export type SensitivityLevel =
  | 'public'        // freely sharable
  | 'internal'      // internal use only
  | 'confidential'  // restricted distribution
  | 'restricted'    // need-to-know only
  | 'critical';     // highest sensitivity (financial, health, credentials)

export interface SensitivityClassification {
  readonly level: SensitivityLevel;
  readonly categories: DataCategory[];
  readonly requiresEncryption: boolean;
  readonly requiresMasking: boolean;
  readonly requiresAuditLog: boolean;
  readonly retentionPolicy?: DataRetentionPolicy;
  readonly regulatoryFrameworks: RegulatoryFramework[];
  readonly rationale: string;
}

// ─── Data Categories ──────────────────────────────────────────────────────

export type DataCategory =
  | 'personal-identity'     // name, document numbers
  | 'contact-information'   // email, phone, address
  | 'financial'             // prices, amounts, account numbers
  | 'health'                // medical information
  | 'credentials'           // passwords, tokens, keys
  | 'location'              // geographic coordinates, addresses
  | 'behavioral'            // usage patterns, preferences
  | 'tax-fiscal'            // tax IDs, fiscal documents
  | 'corporate-confidential' // internal pricing, margins
  | 'none';                 // not sensitive

// ─── Regulatory Frameworks ────────────────────────────────────────────────

export type RegulatoryFramework =
  | 'LGPD'     // Brazil
  | 'GDPR'     // European Union
  | 'CCPA'     // California
  | 'PCI-DSS'  // Payment card
  | 'HIPAA'    // Healthcare (US)
  | 'SOX'      // Financial reporting (US)
  | 'BACEN';   // Brazilian central bank

// ─── Data Retention ───────────────────────────────────────────────────────

export interface DataRetentionPolicy {
  readonly minRetentionDays: number;
  readonly maxRetentionDays?: number;
  readonly requiresExplicitDeletion: boolean;
  readonly basis: string;
}

// ─── Field Classification ─────────────────────────────────────────────────

export interface FieldClassificationInput {
  readonly fields: FieldSecurityInput[];
  readonly entityKind?: string;
  readonly erpProfileId?: string;
  readonly jurisdiction?: string;
}

export interface FieldSecurityInput {
  readonly fieldName: string;
  readonly nativeType: string;
  readonly cblTerm?: string;
  readonly fieldKind?: string;
}

export interface FieldClassificationResult {
  readonly classifications: FieldSensitivityRecord[];
  readonly highestSensitivityLevel: SensitivityLevel;
  readonly piiFieldCount: number;
  readonly encryptionRequired: boolean;
  readonly summary: string;
  readonly recommendations: string[];
}

export interface FieldSensitivityRecord {
  readonly fieldName: string;
  readonly cblTerm?: string;
  readonly classification: SensitivityClassification;
  readonly isPII: boolean;
  readonly confidence: number;
  readonly rationale: string;
}

// ─── Risk Assessment ──────────────────────────────────────────────────────

export interface SecurityRiskInput {
  readonly sourceConnectorId: string;
  readonly targetConnectorId: string;
  readonly transferredFields: FieldSecurityInput[];
  readonly syncDirection: 'source-to-target' | 'target-to-source' | 'bidirectional';
  readonly networkLocation: 'internal' | 'cloud' | 'cross-cloud' | 'on-premise-to-cloud';
  readonly authMechanism?: string;
}

export interface SecurityRiskAssessment {
  readonly overallRisk: SecurityRiskLevel;
  readonly risks: SecurityRisk[];
  readonly mitigations: SecurityMitigation[];
  readonly complianceIssues: ComplianceIssue[];
  readonly score: number;
  readonly summary: string;
}

export type SecurityRiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'minimal';

export interface SecurityRisk {
  readonly id: string;
  readonly category: SecurityRiskCategory;
  readonly level: SecurityRiskLevel;
  readonly description: string;
  readonly affectedFields?: string[];
  readonly recommendation: string;
}

export type SecurityRiskCategory =
  | 'data-exposure'
  | 'insufficient-encryption'
  | 'inadequate-masking'
  | 'missing-audit-trail'
  | 'excessive-data-transfer'
  | 'cross-boundary-pii'
  | 'credential-exposure'
  | 'regulatory-violation';

export interface SecurityMitigation {
  readonly riskId: string;
  readonly action: string;
  readonly priority: 'immediate' | 'high' | 'medium' | 'low';
  readonly effort: 'minimal' | 'moderate' | 'significant';
}

export interface ComplianceIssue {
  readonly framework: RegulatoryFramework;
  readonly article?: string;
  readonly description: string;
  readonly severity: 'blocking' | 'warning';
}

// ─── Security Policy ──────────────────────────────────────────────────────

export interface SecurityPolicy {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly applies(recommendation: AIRecommendation): boolean;
  readonly validate(recommendation: AIRecommendation): SecurityPolicyValidation;
}

export interface SecurityPolicyValidation {
  readonly isCompliant: boolean;
  readonly violations: SecurityPolicyViolation[];
  readonly warnings: string[];
}

export interface SecurityPolicyViolation {
  readonly policyId: string;
  readonly policyName: string;
  readonly severity: 'blocking' | 'warning';
  readonly description: string;
}

// ─── Known Sensitive CBL Field Kinds ──────────────────────────────────────

export const SENSITIVE_FIELD_KINDS: Readonly<Record<string, SensitivityLevel>> = {
  TAX_ID:               'restricted',
  COMPANY_REGISTRATION: 'restricted',
  BANK_ACCOUNT:         'critical',
  CREDIT_CARD:          'critical',
  PASSWORD:             'critical',
  API_KEY:              'critical',
  EMAIL:                'confidential',
  PHONE:                'confidential',
  ADDRESS_STREET:       'confidential',
  COST_PRICE:           'confidential',
  MARGIN:               'confidential',
  MARKUP:               'confidential',
  SALARY:               'restricted',
} as const;
