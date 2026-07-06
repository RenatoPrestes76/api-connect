/**
 * @seltriva/governance — audit
 *
 * Full audit architecture: immutable audit ledger, chain-of-custody,
 * retention management, tamper detection, and compliance export.
 *
 * The governance audit layer is a superset of the cloud audit module.
 * It adds:
 *   - Policy evaluation trails
 *   - Change request audit
 *   - Approval decision audit
 *   - Compliance evidence collection
 *   - Chain-of-custody for sensitive operations
 */

import type { GovernanceResult } from '../policies/index';

declare const brand: unique symbol;
type Branded<T, B> = T & { readonly [brand]: B };
export type GovernanceAuditId    = Branded<string, 'GovernanceAuditId'>;
export type AuditChainId         = Branded<string, 'AuditChainId'>;
export type ComplianceEvidenceId = Branded<string, 'ComplianceEvidenceId'>;

// ─── Audit Entry ─────────────────────────────────────────────────────────────

export interface GovernanceAuditEntry {
  readonly id: GovernanceAuditId;
  readonly chainId: AuditChainId;           // groups related operations
  readonly sequence: number;                // monotonically increasing per chain
  readonly hash: string;                    // SHA-256 of (previousHash + entry content)
  readonly previousHash?: string;           // links to previous entry in chain
  readonly organizationId?: string;
  readonly workspaceId?: string;
  readonly environmentId?: string;
  readonly actor: AuditActor;
  readonly action: GovernanceAuditAction;
  readonly resource: AuditedResource;
  readonly outcome: AuditOutcome;
  readonly policyDecision?: AuditPolicyTrace;
  readonly changeContext?: AuditChangeContext;
  readonly approvalContext?: AuditApprovalContext;
  readonly sensitivityLevel: DataSensitivity;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly metadata?: Record<string, unknown>;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
  readonly occurredAt: Date;
  readonly retainUntil: Date;
}

export interface AuditActor {
  readonly id: string;
  readonly type: 'user' | 'api-key' | 'agent' | 'system' | 'automation';
  readonly email?: string;
  readonly roles?: string[];
  readonly organizationId?: string;
}

export interface AuditedResource {
  readonly type: string;
  readonly id?: string;
  readonly name?: string;
  readonly version?: string;
  readonly organizationId?: string;
}

export type AuditOutcome = 'success' | 'failure' | 'partial' | 'denied';

export interface AuditPolicyTrace {
  readonly decision: 'allow' | 'deny' | 'not-applicable';
  readonly policyIds: string[];
  readonly evaluationId?: string;
}

export interface AuditChangeContext {
  readonly changeRequestId?: string;
  readonly changeRequestNumber?: string;
  readonly changeType?: string;
}

export interface AuditApprovalContext {
  readonly approvalRequestId?: string;
  readonly stage?: number;
  readonly decision?: 'approved' | 'rejected';
}

export type DataSensitivity = 'public' | 'internal' | 'confidential' | 'restricted';

// ─── Audit Actions ────────────────────────────────────────────────────────────

export type GovernanceAuditAction =
  | 'policy.evaluated'
  | 'policy.created'
  | 'policy.updated'
  | 'policy.deleted'
  | 'policy.enforced'
  | 'role.assigned'
  | 'role.revoked'
  | 'role.created'
  | 'permission.granted'
  | 'permission.denied'
  | 'approval.requested'
  | 'approval.approved'
  | 'approval.rejected'
  | 'approval.escalated'
  | 'change.created'
  | 'change.approved'
  | 'change.rejected'
  | 'change.deployed'
  | 'change.rolled-back'
  | 'secret.read'
  | 'secret.written'
  | 'secret.rotated'
  | 'secret.deleted'
  | 'config.written'
  | 'config.deleted'
  | 'tenant.boundary.accessed'
  | 'tenant.boundary.violated'
  | 'environment.locked'
  | 'environment.unlocked'
  | 'compliance.report.generated'
  | 'compliance.control.failed'
  | 'backup.created'
  | 'backup.restored'
  | 'release.published'
  | 'release.rolled-back'
  | 'package.published'
  | 'package.installed'
  | string;

// ─── Audit Chain ──────────────────────────────────────────────────────────────

export interface AuditChain {
  readonly id: AuditChainId;
  readonly name: string;
  readonly organizationId?: string;
  readonly purpose: string;
  readonly entries: number;
  readonly firstEntryId: GovernanceAuditId;
  readonly lastEntryId: GovernanceAuditId;
  readonly lastHash: string;
  readonly integrity: 'verified' | 'tampered' | 'pending';
  readonly createdAt: Date;
  readonly verifiedAt?: Date;
}

// ─── Audit Service Interface ─────────────────────────────────────────────────

export interface IGovernanceAuditService {
  /**
   * Append an immutable audit entry (fire-and-forget).
   */
  log(entry: AuditEntryInput): Promise<void>;

  /**
   * Query audit entries.
   */
  query(filter: AuditQueryFilter): Promise<AuditQueryResult>;

  /**
   * Verify the integrity of an audit chain (tamper detection).
   */
  verifyChain(chainId: AuditChainId): Promise<ChainVerificationResult>;

  /**
   * Export audit entries for compliance.
   */
  export(request: AuditExportRequest): Promise<GovernanceResult<AuditExport>>;

  /**
   * Get compliance evidence for a specific control.
   */
  getComplianceEvidence(controlId: string, period: AuditPeriod): Promise<ComplianceEvidence[]>;

  /**
   * Get statistics.
   */
  getStats(orgId: string, period: AuditPeriod): Promise<AuditStats>;
}

export interface AuditEntryInput {
  readonly chainId?: AuditChainId;
  readonly organizationId?: string;
  readonly workspaceId?: string;
  readonly environmentId?: string;
  readonly actor: AuditActor;
  readonly action: GovernanceAuditAction;
  readonly resource: AuditedResource;
  readonly outcome: AuditOutcome;
  readonly sensitivityLevel?: DataSensitivity;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly metadata?: Record<string, unknown>;
  readonly policyDecision?: AuditPolicyTrace;
  readonly changeContext?: AuditChangeContext;
  readonly approvalContext?: AuditApprovalContext;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
}

export interface AuditQueryFilter {
  readonly organizationId?: string;
  readonly actor?: { id?: string; type?: string };
  readonly actions?: GovernanceAuditAction[];
  readonly resourceType?: string;
  readonly outcome?: AuditOutcome;
  readonly sensitivityLevel?: DataSensitivity;
  readonly chainId?: AuditChainId;
  readonly since?: Date;
  readonly until?: Date;
  readonly requestId?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface AuditQueryResult {
  readonly entries: GovernanceAuditEntry[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface ChainVerificationResult {
  readonly chainId: AuditChainId;
  readonly integrity: 'verified' | 'tampered';
  readonly entriesChecked: number;
  readonly firstTamperedEntry?: GovernanceAuditId;
  readonly verifiedAt: Date;
  readonly durationMs: number;
}

export interface AuditExportRequest {
  readonly organizationId: string;
  readonly format: 'json' | 'csv' | 'jsonl' | 'pdf-report';
  readonly filter: AuditQueryFilter;
  readonly includeChainProof: boolean;      // include hash chain for tamper evidence
  readonly encryptExport?: boolean;
  readonly requestedBy: string;
}

export interface AuditExport {
  readonly exportId: string;
  readonly format: string;
  readonly fileUrl: string;
  readonly entryCount: number;
  readonly sizeBytes: number;
  readonly chainProofIncluded: boolean;
  readonly encrypted: boolean;
  readonly expiresAt: Date;
  readonly generatedAt: Date;
}

export interface ComplianceEvidence {
  readonly id: ComplianceEvidenceId;
  readonly controlId: string;
  readonly evidenceType: 'audit-log' | 'policy-document' | 'test-result' | 'certification';
  readonly summary: string;
  readonly entries: GovernanceAuditId[];
  readonly collectedAt: Date;
  readonly period: AuditPeriod;
}

export interface AuditPeriod {
  readonly from: Date;
  readonly to: Date;
}

export interface AuditStats {
  readonly organizationId: string;
  readonly period: AuditPeriod;
  readonly totalEntries: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly deniedCount: number;
  readonly topActions: Array<{ action: string; count: number }>;
  readonly topActors: Array<{ actorId: string; count: number }>;
  readonly sensitivityBreakdown: Record<DataSensitivity, number>;
  readonly policyDenials: number;
  readonly chainIntegrity: 'verified' | 'unverified' | 'tampered';
}
