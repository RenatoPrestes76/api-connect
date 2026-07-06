/**
 * @seltriva/governance — compliance
 *
 * Multi-framework compliance architecture:
 *   - LGPD  (Lei Geral de Proteção de Dados — Brazil)
 *   - ISO 27001 (Information Security Management System)
 *   - SOC 2  (Trust Service Criteria)
 *   - NIST   (Cybersecurity Framework)
 *
 * Compliance is evidence-based. Each control maps to:
 *   - Policy requirements
 *   - Technical controls
 *   - Audit evidence
 *   - Assessment procedures
 */

import type { GovernanceResult, PolicyId } from '../policies/index';
import type { AuditPeriod } from '../audit/index';

declare const brand: unique symbol;
type Branded<T, B> = T & { readonly [brand]: B };
export type ComplianceControlId    = Branded<string, 'ComplianceControlId'>;
export type ComplianceAssessmentId = Branded<string, 'ComplianceAssessmentId'>;
export type ComplianceProgramId    = Branded<string, 'ComplianceProgramId'>;

// ─── Compliance Framework ────────────────────────────────────────────────────

export type ComplianceFramework = 'LGPD' | 'ISO27001' | 'SOC2' | 'NIST-CSF';
export type ControlStatus       = 'compliant' | 'non-compliant' | 'partial' | 'not-applicable' | 'not-assessed';
export type RiskLevel           = 'low' | 'medium' | 'high' | 'critical';

// ─── Compliance Control ──────────────────────────────────────────────────────

export interface ComplianceControl {
  readonly id: ComplianceControlId;
  readonly framework: ComplianceFramework;
  readonly controlId: string;               // e.g. "ISO27001:A.9.1.1", "SOC2:CC6.1"
  readonly category: string;               // e.g. "Access Control", "Incident Management"
  readonly subcategory?: string;
  readonly title: string;
  readonly description: string;
  readonly objective: string;
  readonly type: ControlType;
  readonly priority: RiskLevel;
  readonly requiredPolicies?: PolicyId[];
  readonly technicalRequirements: TechnicalRequirement[];
  readonly evidenceTypes: EvidenceType[];
  readonly assessmentProcedure: string;
  readonly applicability: ControlApplicability;
}

export type ControlType        = 'preventive' | 'detective' | 'corrective' | 'compensating';
export type EvidenceType       = 'audit-log' | 'policy-document' | 'screenshot' | 'test-result' | 'certificate' | 'interview' | 'system-config';
export type ControlApplicability = 'all' | 'enterprise' | 'cloud-hosted' | 'on-premises';

export interface TechnicalRequirement {
  readonly id: string;
  readonly description: string;
  readonly automated: boolean;
  readonly verificationQuery?: string;
}

// ─── LGPD Specific Types ─────────────────────────────────────────────────────

export interface LGPDProcessingRecord {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly purpose: string;
  readonly legalBasis: LGPDLegalBasis;
  readonly dataCategories: LGPDDataCategory[];
  readonly dataSubjectTypes: string[];
  readonly retentionPeriodDays: number;
  readonly transfersToThirdParties: boolean;
  readonly internationalTransfers: boolean;
  readonly processorName?: string;
  readonly dpoReviewed: boolean;
  readonly dpiaRequired: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type LGPDLegalBasis =
  | 'consent'                              // Art. 7, I
  | 'legal-obligation'                     // Art. 7, II
  | 'public-policy'                        // Art. 7, III
  | 'research'                             // Art. 7, IV
  | 'contract-performance'                 // Art. 7, V
  | 'legitimate-interest'                  // Art. 7, IX
  | 'credit-protection'                    // Art. 7, X
  | 'health-data'                          // Art. 11, II, f
  | 'public-authority';                    // Art. 7, VI

export type LGPDDataCategory =
  | 'personal'                             // Art. 5, I
  | 'sensitive-personal'                   // Art. 2, II / Art. 11
  | 'anonymous'
  | 'pseudonymous'
  | 'children-adolescent';                 // Art. 14

export interface LGPDDataSubjectRequest {
  readonly id: string;
  readonly organizationId: string;
  readonly type: LGPDSubjectRight;
  readonly requesterId: string;
  readonly status: 'received' | 'in-progress' | 'completed' | 'rejected';
  readonly description: string;
  readonly receivedAt: Date;
  readonly responseDeadline: Date;          // LGPD Art. 15: 15 days
  readonly respondedAt?: Date;
  readonly response?: string;
  readonly rejectionReason?: string;
}

export type LGPDSubjectRight =
  | 'access'                               // Art. 18, I
  | 'correction'                           // Art. 18, III
  | 'deletion'                             // Art. 18, VI
  | 'anonymization'                        // Art. 18, IV
  | 'portability'                          // Art. 18, V
  | 'information'                          // Art. 18, VII/VIII
  | 'revocation'                           // Art. 18, IX
  | 'objection';                           // Art. 18, §2

// ─── ISO 27001 Controls ───────────────────────────────────────────────────────

export const ISO27001_CONTROL_CATEGORIES = {
  'A.5':   'Information Security Policies',
  'A.6':   'Organization of Information Security',
  'A.7':   'Human Resource Security',
  'A.8':   'Asset Management',
  'A.9':   'Access Control',
  'A.10':  'Cryptography',
  'A.11':  'Physical and Environmental Security',
  'A.12':  'Operations Security',
  'A.13':  'Communications Security',
  'A.14':  'System Acquisition, Development and Maintenance',
  'A.15':  'Supplier Relationships',
  'A.16':  'Information Security Incident Management',
  'A.17':  'Business Continuity Management',
  'A.18':  'Compliance',
} as const;

// ─── SOC 2 Trust Service Criteria ────────────────────────────────────────────

export type SOC2TrustCategory = 'Security' | 'Availability' | 'Confidentiality' | 'ProcessingIntegrity' | 'Privacy';

export const SOC2_COMMON_CRITERIA = {
  CC1: 'Control Environment',
  CC2: 'Communication and Information',
  CC3: 'Risk Assessment',
  CC4: 'Monitoring Activities',
  CC5: 'Control Activities',
  CC6: 'Logical and Physical Access Controls',
  CC7: 'System Operations',
  CC8: 'Change Management',
  CC9: 'Risk Mitigation',
} as const;

// ─── NIST CSF Functions ───────────────────────────────────────────────────────

export type NISTFunction = 'Identify' | 'Protect' | 'Detect' | 'Respond' | 'Recover';

export const NIST_CATEGORIES: Record<NISTFunction, string[]> = {
  Identify: ['Asset Management', 'Business Environment', 'Governance', 'Risk Assessment', 'Risk Management Strategy', 'Supply Chain Risk Management'],
  Protect:  ['Identity Management and Access Control', 'Awareness and Training', 'Data Security', 'Information Protection Processes', 'Maintenance', 'Protective Technology'],
  Detect:   ['Anomalies and Events', 'Security Continuous Monitoring', 'Detection Processes'],
  Respond:  ['Response Planning', 'Communications', 'Analysis', 'Mitigation', 'Improvements'],
  Recover:  ['Recovery Planning', 'Improvements', 'Communications'],
};

// ─── Compliance Assessment ───────────────────────────────────────────────────

export interface ComplianceAssessment {
  readonly id: ComplianceAssessmentId;
  readonly organizationId: string;
  readonly framework: ComplianceFramework;
  readonly scope: AssessmentScope;
  readonly status: 'planned' | 'in-progress' | 'completed' | 'expired';
  readonly findings: ComplianceFinding[];
  readonly overallStatus: ControlStatus;
  readonly complianceScore: number;          // 0–100
  readonly criticalGaps: number;
  readonly highRiskGaps: number;
  readonly remediationPlan?: RemediationPlan;
  readonly assessedBy: string;
  readonly assessedAt?: Date;
  readonly expiresAt: Date;
  readonly certificationReady: boolean;
  readonly createdAt: Date;
}

export interface AssessmentScope {
  readonly systems: string[];
  readonly dataTypes: string[];
  readonly processes: string[];
  readonly excludes?: string[];
}

export interface ComplianceFinding {
  readonly controlId: ComplianceControlId;
  readonly status: ControlStatus;
  readonly evidence: string[];
  readonly gaps: string[];
  readonly risk: RiskLevel;
  readonly remediationRequired: boolean;
  readonly remediationDeadline?: Date;
  readonly observation: string;
  readonly recommendations: string[];
}

export interface RemediationPlan {
  readonly id: string;
  readonly items: RemediationItem[];
  readonly targetDate: Date;
  readonly owner: string;
}

export interface RemediationItem {
  readonly controlId: ComplianceControlId;
  readonly action: string;
  readonly priority: RiskLevel;
  readonly owner: string;
  readonly targetDate: Date;
  readonly status: 'open' | 'in-progress' | 'completed';
}

// ─── Compliance Program ──────────────────────────────────────────────────────

export interface ComplianceProgram {
  readonly id: ComplianceProgramId;
  readonly organizationId: string;
  readonly frameworks: ComplianceFramework[];
  readonly scope: AssessmentScope;
  readonly assessmentFrequencyDays: number;
  readonly lastAssessmentId?: ComplianceAssessmentId;
  readonly nextAssessmentDue?: Date;
  readonly dpoId?: string;
  readonly certifications: ComplianceCertification[];
  readonly enabled: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ComplianceCertification {
  readonly framework: ComplianceFramework;
  readonly certificationBody?: string;
  readonly validFrom: Date;
  readonly validUntil: Date;
  readonly status: 'active' | 'expired' | 'revoked';
  readonly certificateUrl?: string;
}

// ─── Compliance Service Interface ────────────────────────────────────────────

export interface IComplianceService {
  startAssessment(orgId: string, framework: ComplianceFramework, by: string): Promise<GovernanceResult<ComplianceAssessment>>;
  recordFinding(assessmentId: ComplianceAssessmentId, finding: ComplianceFinding): Promise<GovernanceResult<void>>;
  completeAssessment(assessmentId: ComplianceAssessmentId, by: string): Promise<GovernanceResult<ComplianceAssessment>>;
  getLatestAssessment(orgId: string, framework: ComplianceFramework): Promise<ComplianceAssessment | null>;
  getControlStatus(orgId: string, controlId: ComplianceControlId): Promise<ControlStatus>;
  generateReport(assessmentId: ComplianceAssessmentId, format: 'pdf' | 'json' | 'csv'): Promise<GovernanceResult<string>>;
  listControls(framework: ComplianceFramework): Promise<ComplianceControl[]>;
  createLGPDRequest(input: CreateLGPDRequestInput): Promise<GovernanceResult<LGPDDataSubjectRequest>>;
  processingRecords(orgId: string): Promise<LGPDProcessingRecord[]>;
  getProgram(orgId: string): Promise<ComplianceProgram | null>;
  setProgram(input: SetComplianceProgramInput): Promise<GovernanceResult<ComplianceProgram>>;
}

export interface CreateLGPDRequestInput {
  readonly organizationId: string;
  readonly type: LGPDSubjectRight;
  readonly requesterId: string;
  readonly description: string;
}

export interface SetComplianceProgramInput {
  readonly organizationId: string;
  readonly frameworks: ComplianceFramework[];
  readonly assessmentFrequencyDays?: number;
  readonly dpoId?: string;
  readonly updatedBy: string;
}
