export type PolicyCategory =
  | 'security'
  | 'access'
  | 'deployment'
  | 'data'
  | 'operational'
  | 'compliance';
export type PolicyEnforcement = 'mandatory' | 'advisory' | 'disabled';

export type AuditAction =
  | 'user.login'
  | 'user.logout'
  | 'user.mfa_enabled'
  | 'user.password_changed'
  | 'tenant.created'
  | 'tenant.updated'
  | 'tenant.deleted'
  | 'policy.created'
  | 'policy.updated'
  | 'policy.enabled'
  | 'policy.disabled'
  | 'secret.created'
  | 'secret.rotated'
  | 'secret.deleted'
  | 'connector.provisioned'
  | 'connector.updated'
  | 'connector.deleted'
  | 'workflow.executed'
  | 'change.approved'
  | 'change.rejected'
  | 'change.executed'
  | 'permission.changed'
  | 'api_key.rotated'
  | 'data.exported';
export type AuditResult = 'success' | 'failure' | 'denied';

export type ComplianceFramework = 'iso27001' | 'soc2' | 'lgpd' | 'gdpr' | 'nist' | 'cis';
export type ControlStatus =
  | 'compliant'
  | 'partial'
  | 'non_compliant'
  | 'not_applicable'
  | 'under_review';
export type EvidenceStatus = 'valid' | 'expired' | 'pending';

export type RiskCategory =
  | 'operational'
  | 'security'
  | 'availability'
  | 'compliance'
  | 'integration'
  | 'infrastructure';
export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';
export type RiskStatus = 'open' | 'mitigating' | 'mitigated' | 'accepted' | 'transferred';

export type ChangeType =
  | 'infrastructure'
  | 'configuration'
  | 'deployment'
  | 'security'
  | 'data'
  | 'emergency';
export type ChangePriority = 'critical' | 'high' | 'medium' | 'low';
export type ChangeStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'completed'
  | 'rolled_back';

// ─── Policy ────────────────────────────────────────────────────────────────

export interface GovernancePolicy {
  id: string;
  name: string;
  category: PolicyCategory;
  description: string;
  enabled: boolean;
  enforcement: PolicyEnforcement;
  version: number;
  rules: Record<string, unknown>;
  appliesTo: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// ─── Audit ─────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  tenantId?: string;
  actor: string;
  actorName: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  details: Record<string, unknown>;
  ipAddress: string;
  result: AuditResult;
  signature: string;
  createdAt: string;
}

export type AuditExportFormat = 'json' | 'csv' | 'pdf';

export interface AuditExportResult {
  format: AuditExportFormat;
  total: number;
  exportedAt: string;
  records?: AuditLog[];
  data?: string;
  downloadUrl?: string;
  message?: string;
}

// ─── Compliance ────────────────────────────────────────────────────────────

export interface ComplianceControl {
  id: string;
  framework: ComplianceFramework;
  controlId: string;
  title: string;
  status: ControlStatus;
  evidenceCount: number;
  lastVerified: string;
  owner: string;
  actionPlan?: string;
}

export interface ComplianceEvidence {
  id: string;
  framework: ComplianceFramework;
  controlId: string;
  title: string;
  description: string;
  evidenceType: 'document' | 'screenshot' | 'log' | 'report' | 'attestation';
  verifiedAt: string;
  verifiedBy: string;
  expiresAt?: string;
  status: EvidenceStatus;
}

export interface ComplianceFrameworkStatus {
  framework: ComplianceFramework;
  label: string;
  totalControls: number;
  compliant: number;
  partial: number;
  nonCompliant: number;
  notApplicable: number;
  underReview: number;
  complianceScore: number;
  lastAudit: string;
}

export interface ComplianceStatusResult {
  overallScore: number;
  frameworks: ComplianceFrameworkStatus[];
}

// ─── Risk ──────────────────────────────────────────────────────────────────

export interface Risk {
  id: string;
  title: string;
  category: RiskCategory;
  description: string;
  probability: number;
  impact: number;
  severity: RiskSeverity;
  status: RiskStatus;
  owner: string;
  mitigationPlan: string;
  dueDate?: string;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Change Management ─────────────────────────────────────────────────────

export interface ChangeRequest {
  id: string;
  title: string;
  description: string;
  type: ChangeType;
  priority: ChangePriority;
  status: ChangeStatus;
  requester: string;
  requesterName: string;
  approver?: string;
  approverName?: string;
  approvalNotes?: string;
  rejectionReason?: string;
  justification: string;
  scheduledAt: string;
  executedAt?: string;
  rollbackPlan: string;
  affectedSystems: string[];
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Overview ──────────────────────────────────────────────────────────────

export interface GovernanceOverview {
  activePolicies: number;
  totalPolicies: number;
  openChanges: number;
  pendingApprovals: number;
  openRisks: number;
  criticalRisks: number;
  auditLogsToday: number;
  overallComplianceScore: number;
}
