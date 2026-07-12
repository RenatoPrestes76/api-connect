import type {
  GovernancePolicy,
  PolicyCategory,
  PolicyEnforcement,
  AuditLog,
  AuditAction,
  AuditResult,
  AuditExportFormat,
  AuditExportResult,
  ComplianceControl,
  ComplianceEvidence,
  ComplianceFramework,
  ComplianceFrameworkStatus,
  ComplianceStatusResult,
  ControlStatus,
  EvidenceStatus,
  Risk,
  RiskCategory,
  RiskSeverity,
  RiskStatus,
  ChangeRequest,
  ChangeType,
  ChangePriority,
  ChangeStatus,
  GovernanceOverview,
} from './types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function nowIso(): string {
  return new Date().toISOString();
}
function ago(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}
function sign(payload: string): string {
  let h = 0xcafebabe;
  for (let i = 0; i < payload.length; i++) {
    h = Math.imul(h ^ payload.charCodeAt(i), 0x9e3779b9);
    h = (h << 13) | (h >>> 19);
  }
  return `sha256:${(h >>> 0).toString(16).padStart(8, '0')}atlas`;
}
function computeSeverity(probability: number, impact: number): RiskSeverity {
  const score = probability * impact;
  if (score >= 15) return 'critical';
  if (score >= 8) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

// ─── Seed data ────────────────────────────────────────────────────────────────

function seedPolicies(): GovernancePolicy[] {
  const pol = (
    id: string,
    name: string,
    category: PolicyCategory,
    description: string,
    enabled: boolean,
    enforcement: PolicyEnforcement,
    version: number,
    rules: Record<string, unknown>
  ): GovernancePolicy => ({
    id,
    name,
    category,
    description,
    enabled,
    enforcement,
    version,
    rules,
    appliesTo: ['*'],
    createdAt: ago(60 * 24 * 90),
    updatedAt: ago(60 * 24 * 7),
    createdBy: 'admin',
  });
  return [
    pol(
      'pol-001',
      'Password Policy',
      'security',
      'Enforce minimum 12-char passwords with complexity',
      true,
      'mandatory',
      1,
      { minLength: 12, requireUppercase: true, requireSymbol: true }
    ),
    pol(
      'pol-002',
      'MFA Mandatory',
      'access',
      'All users must enable multi-factor authentication',
      true,
      'mandatory',
      2,
      { methods: ['totp', 'sms', 'hardware_key'], graceperiodDays: 0 }
    ),
    pol(
      'pol-003',
      'API Key Rotation',
      'security',
      'Rotate API keys every 90 days',
      true,
      'advisory',
      1,
      { rotationDays: 90, alertBeforeDays: 14 }
    ),
    pol(
      'pol-004',
      'Log Retention 90 Days',
      'data',
      'Retain all audit and system logs for minimum 90 days',
      true,
      'mandatory',
      1,
      { retentionDays: 90, compressAfterDays: 30, archiveToS3: true }
    ),
    pol(
      'pol-005',
      'Encryption at Rest',
      'security',
      'All stored data must use AES-256 encryption',
      true,
      'mandatory',
      3,
      { algorithm: 'AES-256-GCM', keyRotationDays: 365, kmsMandatory: true }
    ),
    pol(
      'pol-006',
      'Deploy Window',
      'deployment',
      'Production deployments allowed Mon-Fri 08:00–18:00 UTC only',
      true,
      'advisory',
      1,
      {
        allowedDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
        windowStart: '08:00',
        windowEnd: '18:00',
        timezone: 'UTC',
      }
    ),
    pol(
      'pol-007',
      'IP Allowlist',
      'access',
      'Restrict admin panel access to approved IP ranges',
      false,
      'advisory',
      1,
      { allowedCidrs: ['10.0.0.0/8', '172.16.0.0/12'] }
    ),
    pol(
      'pol-008',
      'Data Export Limit',
      'operational',
      'Maximum 100k records per single data export operation',
      true,
      'advisory',
      1,
      { maxRecords: 100_000, requiresApproval: true, notifyAdmin: true }
    ),
  ];
}

function seedAuditLogs(): AuditLog[] {
  const log = (
    id: string,
    actor: string,
    actorName: string,
    action: AuditAction,
    resource: string,
    result: AuditResult,
    ipAddress: string,
    createdAt: string,
    tenantId?: string,
    details: Record<string, unknown> = {}
  ): AuditLog => ({
    id,
    tenantId,
    actor,
    actorName,
    action,
    resource,
    result,
    ipAddress,
    details,
    signature: sign(`${id}|${actor}|${action}|${resource}|${createdAt}`),
    createdAt,
  });
  const now = nowIso();
  return [
    log(
      'al-001',
      'usr-001',
      'Alice Admin',
      'user.login',
      'auth/session',
      'success',
      '192.168.1.10',
      ago(5),
      'tenant-enterprise',
      { mfa: true }
    ),
    log(
      'al-002',
      'usr-002',
      'Bob DevOps',
      'policy.updated',
      'policies/pol-002',
      'success',
      '10.0.1.20',
      ago(30),
      'tenant-enterprise',
      { field: 'enforcement', from: 'advisory', to: 'mandatory' }
    ),
    log(
      'al-003',
      'usr-003',
      'Carol Dev',
      'secret.rotated',
      'secrets/sk-prod-db',
      'success',
      '10.0.1.21',
      ago(60),
      'tenant-professional',
      { secretId: 'sk-prod-db' }
    ),
    log(
      'al-004',
      'usr-001',
      'Alice Admin',
      'tenant.created',
      'tenants/tenant-new',
      'success',
      '192.168.1.10',
      ago(90),
      undefined,
      { tenantName: 'Acme Corp' }
    ),
    log(
      'al-005',
      'usr-004',
      'Dave Sec',
      'permission.changed',
      'users/usr-005',
      'success',
      '10.0.0.5',
      ago(120),
      'tenant-enterprise',
      { role: 'admin', from: 'editor' }
    ),
    log(
      'al-006',
      'usr-005',
      'Eve Op',
      'workflow.executed',
      'workflows/wf-export',
      'success',
      '10.0.1.15',
      ago(180),
      'tenant-professional',
      { workflowId: 'wf-export', rows: 45_200 }
    ),
    log(
      'al-007',
      'usr-006',
      'Frank Attacker',
      'user.login',
      'auth/session',
      'denied',
      '203.0.113.99',
      ago(240),
      'tenant-enterprise',
      { reason: 'brute_force_detected' }
    ),
    log(
      'al-008',
      'usr-001',
      'Alice Admin',
      'change.approved',
      'changes/chg-001',
      'success',
      '192.168.1.10',
      ago(300),
      undefined,
      { changeId: 'chg-001', title: 'DB Schema Migration' }
    ),
    log(
      'al-009',
      'usr-003',
      'Carol Dev',
      'connector.provisioned',
      'connectors/conn-pg-002',
      'success',
      '10.0.1.21',
      ago(360),
      'tenant-community',
      { connectorType: 'postgresql' }
    ),
    log(
      'al-010',
      'usr-002',
      'Bob DevOps',
      'api_key.rotated',
      'api-keys/key-prod',
      'success',
      '10.0.1.20',
      ago(420),
      'tenant-enterprise',
      { keyId: 'key-prod' }
    ),
    log(
      'al-011',
      'usr-007',
      'Grace Audit',
      'data.exported',
      'reports/audit-2025',
      'success',
      '10.0.2.30',
      ago(60 * 24),
      'tenant-professional',
      { format: 'csv', rows: 8_456 }
    ),
    log(
      'al-012',
      'system',
      'System',
      'policy.enabled',
      'policies/pol-005',
      'success',
      '127.0.0.1',
      ago(60 * 24 * 2),
      undefined,
      { policyId: 'pol-005' }
    ),
    log(
      'al-013',
      'usr-001',
      'Alice Admin',
      'user.mfa_enabled',
      'users/usr-003',
      'success',
      '192.168.1.10',
      ago(60 * 24 * 3),
      'tenant-enterprise',
      { method: 'totp' }
    ),
    log(
      'al-014',
      'usr-002',
      'Bob DevOps',
      'change.executed',
      'changes/chg-002',
      'success',
      '10.0.1.20',
      ago(60 * 24 * 5),
      undefined,
      { changeId: 'chg-002', duration: '3m12s' }
    ),
    log(
      'al-015',
      'usr-004',
      'Dave Sec',
      'secret.created',
      'secrets/sk-api-gateway',
      'success',
      '10.0.0.5',
      ago(60 * 24 * 7),
      'tenant-enterprise',
      { secretId: 'sk-api-gateway' }
    ),
  ];
}

function seedControls(): ComplianceControl[] {
  const ctl = (
    id: string,
    framework: ComplianceFramework,
    controlId: string,
    title: string,
    status: ControlStatus,
    owner: string,
    evidenceCount = 0,
    actionPlan?: string
  ): ComplianceControl => ({
    id,
    framework,
    controlId,
    title,
    status,
    owner,
    evidenceCount,
    lastVerified: ago(60 * 24 * 7),
    actionPlan,
  });
  return [
    // ISO 27001
    ctl('iso-c-001', 'iso27001', 'A.9.1.1', 'Access Control Policy', 'compliant', 'Dave Sec', 2),
    ctl(
      'iso-c-002',
      'iso27001',
      'A.10.1.1',
      'Use of Cryptographic Controls',
      'compliant',
      'Dave Sec',
      1
    ),
    ctl(
      'iso-c-003',
      'iso27001',
      'A.12.6.1',
      'Management of Technical Vulnerabilities',
      'partial',
      'Bob DevOps',
      1,
      'Complete automated scanning coverage by Q1'
    ),
    ctl(
      'iso-c-004',
      'iso27001',
      'A.16.1.1',
      'Responsibilities & Procedures',
      'compliant',
      'Grace Audit',
      1
    ),
    // SOC 2
    ctl(
      'soc-c-001',
      'soc2',
      'CC6.1',
      'Logical & Physical Access Controls',
      'compliant',
      'Dave Sec',
      1
    ),
    ctl(
      'soc-c-002',
      'soc2',
      'CC6.3',
      'Remote Access',
      'partial',
      'Bob DevOps',
      0,
      'Implement VPN certificate rotation'
    ),
    ctl('soc-c-003', 'soc2', 'CC7.1', 'System Monitoring', 'compliant', 'Eve Op', 1),
    ctl(
      'soc-c-004',
      'soc2',
      'CC8.1',
      'Change Management',
      'under_review',
      'Alice Admin',
      0,
      'Formalise CAB process'
    ),
    // LGPD
    ctl('lgpd-c-001', 'lgpd', 'Art.7', 'Legal Basis for Processing', 'compliant', 'Grace Audit', 1),
    ctl(
      'lgpd-c-002',
      'lgpd',
      'Art.18',
      'Data Subject Rights',
      'partial',
      'Grace Audit',
      0,
      'Deploy data subject portal'
    ),
    ctl('lgpd-c-003', 'lgpd', 'Art.37', 'Data Processing Records', 'compliant', 'Alice Admin', 0),
    ctl(
      'lgpd-c-004',
      'lgpd',
      'Art.46',
      'Security Measures',
      'non_compliant',
      'Dave Sec',
      0,
      'Implement DLP and data classification ASAP'
    ),
    // GDPR
    ctl('gdpr-c-001', 'gdpr', 'Art.6', 'Lawful Basis', 'compliant', 'Grace Audit', 1),
    ctl('gdpr-c-002', 'gdpr', 'Art.25', 'Data Protection by Design', 'compliant', 'Dave Sec', 1),
    ctl(
      'gdpr-c-003',
      'gdpr',
      'Art.32',
      'Security of Processing',
      'partial',
      'Dave Sec',
      0,
      'Document security controls and run DPIA'
    ),
    ctl('gdpr-c-004', 'gdpr', 'Art.33', 'Breach Notification', 'compliant', 'Alice Admin', 0),
    // NIST
    ctl('nist-c-001', 'nist', 'ID.AM-1', 'Physical Device Inventory', 'compliant', 'Bob DevOps', 1),
    ctl(
      'nist-c-002',
      'nist',
      'PR.AC-1',
      'Identity & Credential Management',
      'compliant',
      'Dave Sec',
      0
    ),
    ctl(
      'nist-c-003',
      'nist',
      'DE.CM-1',
      'Network Monitoring',
      'partial',
      'Eve Op',
      0,
      'Extend NDR coverage to all zones'
    ),
    ctl(
      'nist-c-004',
      'nist',
      'RS.RP-1',
      'Response Planning',
      'under_review',
      'Alice Admin',
      0,
      'Update IR runbooks'
    ),
    // CIS
    ctl(
      'cis-c-001',
      'cis',
      'CIS-1',
      'Inventory of Enterprise Assets',
      'compliant',
      'Bob DevOps',
      0
    ),
    ctl(
      'cis-c-002',
      'cis',
      'CIS-4',
      'Secure Configuration',
      'partial',
      'Dave Sec',
      0,
      'Harden baseline images'
    ),
    ctl('cis-c-003', 'cis', 'CIS-6', 'Access Control Management', 'compliant', 'Dave Sec', 0),
    ctl(
      'cis-c-004',
      'cis',
      'CIS-16',
      'Application Software Security',
      'partial',
      'Carol Dev',
      0,
      'SAST in CI pipeline for all repos'
    ),
  ];
}

function seedEvidence(): ComplianceEvidence[] {
  const ev = (
    id: string,
    framework: ComplianceFramework,
    controlId: string,
    title: string,
    evidenceType: ComplianceEvidence['evidenceType'],
    verifiedBy: string,
    status: EvidenceStatus,
    description = '',
    expiresAt?: string
  ): ComplianceEvidence => ({
    id,
    framework,
    controlId,
    title,
    description,
    evidenceType,
    verifiedBy,
    status,
    expiresAt,
    verifiedAt: status === 'expired' ? ago(60 * 24 * 100) : ago(60 * 24 * 5),
  });
  return [
    ev(
      'ev-001',
      'iso27001',
      'A.9.1.1',
      'Access Control Policy v3.1',
      'document',
      'Grace Audit',
      'valid'
    ),
    ev(
      'ev-002',
      'iso27001',
      'A.10.1.1',
      'Encryption Config Screenshot',
      'screenshot',
      'Dave Sec',
      'valid'
    ),
    ev(
      'ev-003',
      'iso27001',
      'A.12.6.1',
      'Q3 Vulnerability Scan Report',
      'report',
      'Bob DevOps',
      'expired',
      'Nessus scan results — Q3 2024',
      ago(-60 * 24 * 10)
    ),
    ev(
      'ev-004',
      'iso27001',
      'A.16.1.1',
      'Incident Response Runbook v2',
      'document',
      'Alice Admin',
      'valid'
    ),
    ev('ev-005', 'soc2', 'CC6.1', 'Access Review Report Oct-2025', 'report', 'Dave Sec', 'valid'),
    ev('ev-006', 'soc2', 'CC7.1', 'SIEM Monitoring Dashboard', 'screenshot', 'Eve Op', 'valid'),
    ev('ev-007', 'lgpd', 'Art.7', 'Legal Basis Documentation', 'document', 'Grace Audit', 'valid'),
    ev(
      'ev-008',
      'lgpd',
      'Art.18',
      'Data Subject Request Process Draft',
      'document',
      'Grace Audit',
      'pending'
    ),
    ev(
      'ev-009',
      'gdpr',
      'Art.6',
      'Consent Management Attestation',
      'attestation',
      'Grace Audit',
      'valid'
    ),
    ev('ev-010', 'gdpr', 'Art.25', 'Privacy by Design Assessment', 'report', 'Dave Sec', 'valid'),
  ];
}

function seedRisks(): Risk[] {
  const risk = (
    id: string,
    title: string,
    category: Risk['category'],
    description: string,
    probability: number,
    impact: number,
    status: RiskStatus,
    owner: string,
    mitigationPlan: string,
    dueDate?: string
  ): Risk => ({
    id,
    title,
    category,
    description,
    probability,
    impact,
    severity: computeSeverity(probability, impact),
    status,
    owner,
    mitigationPlan,
    dueDate,
    createdAt: ago(60 * 24 * 30),
    updatedAt: ago(60 * 24 * 2),
  });
  return [
    risk(
      'risk-001',
      'Single Point of Failure — Primary DB',
      'infrastructure',
      'No read replica for primary PostgreSQL instance',
      4,
      5,
      'open',
      'Bob DevOps',
      'Deploy read replicas and automatic failover',
      ago(-60 * 24 * 14)
    ),
    risk(
      'risk-002',
      'Third-Party Connector SLA Breach',
      'operational',
      'External payment connector missing uptime guarantees',
      3,
      4,
      'mitigating',
      'Eve Op',
      'Negotiate SLA amendment; add circuit breaker'
    ),
    risk(
      'risk-003',
      'Unauthorized Data Access',
      'security',
      'Potential gap in row-level access controls',
      4,
      5,
      'mitigating',
      'Dave Sec',
      'Implement row-level security + pen test',
      ago(-60 * 24 * 7)
    ),
    risk(
      'risk-004',
      'API Rate Limit Exceeded',
      'availability',
      'High-throughput tenant can saturate rate limits',
      3,
      3,
      'mitigated',
      'Eve Op',
      'Dynamic rate-limiting deployed; monitoring added'
    ),
    risk(
      'risk-005',
      'SSL Certificate Expiry',
      'security',
      'Wildcard cert expires in 45 days',
      4,
      4,
      'mitigating',
      'Bob DevOps',
      "Automate with Let's Encrypt; rotate by month-end",
      ago(-60 * 24 * 7)
    ),
    risk(
      'risk-006',
      'LGPD Non-Compliance Fine Risk',
      'compliance',
      'Art.46 control non-compliant; fine exposure',
      3,
      5,
      'open',
      'Grace Audit',
      'Implement DLP and data classification',
      ago(-60 * 24 * 3)
    ),
    risk(
      'risk-007',
      'Cloud Provider Regional Outage',
      'availability',
      'Single-region deployment could fail on AWS outage',
      2,
      4,
      'accepted',
      'Bob DevOps',
      'Accepted — multi-region in Sprint 41 roadmap'
    ),
    risk(
      'risk-008',
      'Insider Threat Vector',
      'security',
      'Privileged user could exfiltrate config/secrets',
      2,
      5,
      'mitigating',
      'Dave Sec',
      'Least-privilege audit; DLP on admin exports'
    ),
  ];
}

function seedChanges(): ChangeRequest[] {
  const chg = (
    id: string,
    title: string,
    type: ChangeType,
    priority: ChangePriority,
    status: ChangeStatus,
    requesterName: string,
    justification: string,
    rollbackPlan: string,
    affectedSystems: string[],
    scheduledAt: string,
    executedAt?: string,
    approverName?: string,
    rejectionReason?: string,
    approvalNotes?: string
  ): ChangeRequest => ({
    id,
    title,
    description: `${title} — automated by TITAN Governance`,
    type,
    priority,
    status,
    requester: 'usr-002',
    requesterName,
    approver: approverName ? 'usr-001' : undefined,
    approverName,
    approvalNotes,
    rejectionReason,
    justification,
    rollbackPlan,
    affectedSystems,
    scheduledAt,
    executedAt,
    tenantId: 'tenant-enterprise',
    createdAt: ago(60 * 24 * 14),
    updatedAt: ago(60 * 24),
  });
  return [
    chg(
      'chg-001',
      'DB Schema Migration v2',
      'data',
      'high',
      'completed',
      'Bob DevOps',
      'Add indexes for query performance',
      'Revert via migration rollback script',
      ['primary-db'],
      ago(-60 * 24 * 5),
      ago(-60 * 24 * 5 + 30),
      'Alice Admin',
      undefined,
      'Low risk, tested in staging'
    ),
    chg(
      'chg-002',
      'TLS Certificate Rotation',
      'security',
      'high',
      'completed',
      'Dave Sec',
      'Wildcard cert expired; immediate rotation required',
      'Restore previous cert from vault',
      ['load-balancer', 'api-gw'],
      ago(-60 * 24 * 3),
      ago(-60 * 24 * 3 + 45),
      'Alice Admin'
    ),
    chg(
      'chg-003',
      'Firewall Rule — New Office IP',
      'infrastructure',
      'medium',
      'pending',
      'Bob DevOps',
      'Allow access from new London office (203.0.113.0/24)',
      'Remove added rule if issues arise',
      ['firewall'],
      ago(-60 * 24 * 1)
    ),
    chg(
      'chg-004',
      'Emergency Security Patch v1.9.2',
      'emergency',
      'critical',
      'approved',
      'Dave Sec',
      'Critical CVE-2025-xxxx patch for connector framework',
      'Rollback to v1.9.1 package if instability',
      ['all-connectors'],
      ago(-60 * 30),
      undefined,
      'Alice Admin',
      undefined,
      'Emergency — approved out of window'
    ),
    chg(
      'chg-005',
      'Agent Cluster Scale-Out ×3',
      'infrastructure',
      'medium',
      'executing',
      'Bob DevOps',
      'Load increase forecasted for Q1; provision 3 nodes',
      'Decommission new nodes if no load',
      ['agent-cluster'],
      ago(-60 * 60)
    ),
    chg(
      'chg-006',
      'Connector API Endpoint Change',
      'configuration',
      'low',
      'rejected',
      'Carol Dev',
      'Update endpoint to v3 API; v2 EOL',
      'Revert config map',
      ['connector-salesforce'],
      ago(-60 * 24 * 10),
      undefined,
      'Alice Admin',
      'Insufficient test coverage for v3 API'
    ),
  ];
}

// ─── Store ────────────────────────────────────────────────────────────────────

export class GovernanceStore {
  private policies: GovernancePolicy[] = seedPolicies();
  private logs: AuditLog[] = seedAuditLogs();
  private controls: ComplianceControl[] = seedControls();
  private evidence: ComplianceEvidence[] = seedEvidence();
  private risks: Risk[] = seedRisks();
  private changes: ChangeRequest[] = seedChanges();

  // ── Policies ───────────────────────────────────────────────────────────────

  getPolicies(filters?: { category?: PolicyCategory; enabled?: boolean }): GovernancePolicy[] {
    let list = [...this.policies];
    if (filters?.category !== undefined) list = list.filter((p) => p.category === filters.category);
    if (filters?.enabled !== undefined) list = list.filter((p) => p.enabled === filters.enabled);
    return list;
  }

  getPolicy(id: string): GovernancePolicy | undefined {
    return this.policies.find((p) => p.id === id);
  }

  createPolicy(data: {
    name: string;
    category: PolicyCategory;
    description?: string;
    enforcement?: PolicyEnforcement;
    rules?: Record<string, unknown>;
    appliesTo?: string[];
  }): GovernancePolicy {
    const policy: GovernancePolicy = {
      id: genId('pol'),
      name: data.name,
      category: data.category,
      description: data.description ?? '',
      enabled: true,
      enforcement: data.enforcement ?? 'advisory',
      version: 1,
      rules: data.rules ?? {},
      appliesTo: data.appliesTo ?? ['*'],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      createdBy: 'admin',
    };
    this.policies.push(policy);
    return policy;
  }

  // ── Audit logs ─────────────────────────────────────────────────────────────

  getLogs(filters?: {
    actor?: string;
    action?: string;
    tenantId?: string;
    limit?: number;
  }): AuditLog[] {
    let list = [...this.logs];
    if (filters?.actor) list = list.filter((l) => l.actor === filters.actor);
    if (filters?.action) list = list.filter((l) => l.action === filters.action);
    if (filters?.tenantId) list = list.filter((l) => l.tenantId === filters.tenantId);
    list = list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filters?.limit) list = list.slice(0, filters.limit);
    return list;
  }

  addLog(data: Omit<AuditLog, 'id' | 'signature' | 'createdAt'>): AuditLog {
    const id = genId('al');
    const createdAt = nowIso();
    const log: AuditLog = {
      id,
      ...data,
      signature: sign(`${id}|${data.actor}|${data.action}|${data.resource}|${createdAt}`),
      createdAt,
    };
    this.logs.unshift(log);
    return log;
  }

  exportLogs(format: string, filters?: { limit?: number }): object {
    const records = this.getLogs(filters);
    const exportedAt = nowIso();
    if (format === 'csv') {
      const headers = [
        'id',
        'actor',
        'actorName',
        'action',
        'resource',
        'result',
        'ipAddress',
        'createdAt',
      ];
      const rows = records.map((l) =>
        headers
          .map((h) => JSON.stringify((l as unknown as Record<string, unknown>)[h] ?? ''))
          .join(',')
      );
      const data = [headers.join(','), ...rows].join('\n');
      return { format: 'csv', total: records.length, exportedAt, data };
    }
    if (format === 'pdf') {
      return {
        format: 'pdf',
        total: records.length,
        exportedAt,
        downloadUrl: `/api/v1/audit/download/${genId('exp')}`,
        message: 'PDF export queued — link valid for 1 hour',
      };
    }
    return { format: 'json', total: records.length, exportedAt, records };
  }

  // ── Compliance ─────────────────────────────────────────────────────────────

  getComplianceStatus(): ComplianceStatusResult {
    const frameworkKeys: ComplianceFramework[] = [
      'iso27001',
      'soc2',
      'lgpd',
      'gdpr',
      'nist',
      'cis',
    ];
    const labels: Record<ComplianceFramework, string> = {
      iso27001: 'ISO 27001',
      soc2: 'SOC 2',
      lgpd: 'LGPD',
      gdpr: 'GDPR',
      nist: 'NIST CSF',
      cis: 'CIS Controls',
    };
    const frameworks: ComplianceFrameworkStatus[] = frameworkKeys.map((fw) => {
      const ctls = this.controls.filter((c) => c.framework === fw);
      const applicable = ctls.filter((c) => c.status !== 'not_applicable');
      const compliant = ctls.filter((c) => c.status === 'compliant').length;
      const partial = ctls.filter((c) => c.status === 'partial').length;
      const nonCompliant = ctls.filter((c) => c.status === 'non_compliant').length;
      const notApplicable = ctls.filter((c) => c.status === 'not_applicable').length;
      const underReview = ctls.filter((c) => c.status === 'under_review').length;
      const score =
        applicable.length > 0
          ? Math.round(((compliant + partial * 0.5) / applicable.length) * 100)
          : 0;
      return {
        framework: fw,
        label: labels[fw],
        totalControls: ctls.length,
        compliant,
        partial,
        nonCompliant,
        notApplicable,
        underReview,
        complianceScore: score,
        lastAudit: ago(60 * 24 * 7),
      };
    });
    const overallScore = Math.round(
      frameworks.reduce((s, f) => s + f.complianceScore, 0) / frameworks.length
    );
    return { overallScore, frameworks };
  }

  getEvidence(filters?: {
    framework?: ComplianceFramework;
    controlId?: string;
    status?: EvidenceStatus;
  }): ComplianceEvidence[] {
    let list = [...this.evidence];
    if (filters?.framework) list = list.filter((e) => e.framework === filters.framework);
    if (filters?.controlId) list = list.filter((e) => e.controlId === filters.controlId);
    if (filters?.status) list = list.filter((e) => e.status === filters.status);
    return list;
  }

  // ── Risk ───────────────────────────────────────────────────────────────────

  getRisks(filters?: {
    category?: RiskCategory;
    status?: RiskStatus;
    severity?: RiskSeverity;
  }): Risk[] {
    let list = [...this.risks];
    if (filters?.category) list = list.filter((r) => r.category === filters.category);
    if (filters?.status) list = list.filter((r) => r.status === filters.status);
    if (filters?.severity) list = list.filter((r) => r.severity === filters.severity);
    return list;
  }

  getRisk(id: string): Risk | undefined {
    return this.risks.find((r) => r.id === id);
  }

  createRisk(data: {
    title: string;
    category: RiskCategory;
    description?: string;
    probability: number;
    impact: number;
    owner?: string;
    mitigationPlan?: string;
    dueDate?: string;
    tenantId?: string;
  }): Risk {
    const risk: Risk = {
      id: genId('risk'),
      title: data.title,
      category: data.category,
      description: data.description ?? '',
      probability: data.probability,
      impact: data.impact,
      severity: computeSeverity(data.probability, data.impact),
      status: 'open',
      owner: data.owner ?? 'admin',
      mitigationPlan: data.mitigationPlan ?? '',
      dueDate: data.dueDate,
      tenantId: data.tenantId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.risks.push(risk);
    return risk;
  }

  // ── Changes ────────────────────────────────────────────────────────────────

  getChanges(filters?: {
    status?: ChangeStatus;
    type?: ChangeType;
    priority?: ChangePriority;
  }): ChangeRequest[] {
    let list = [...this.changes];
    if (filters?.status) list = list.filter((c) => c.status === filters.status);
    if (filters?.type) list = list.filter((c) => c.type === filters.type);
    if (filters?.priority) list = list.filter((c) => c.priority === filters.priority);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getChange(id: string): ChangeRequest | undefined {
    return this.changes.find((c) => c.id === id);
  }

  createChange(data: {
    title: string;
    description?: string;
    type: ChangeType;
    priority?: ChangePriority;
    requesterName: string;
    justification: string;
    rollbackPlan?: string;
    scheduledAt: string;
    affectedSystems?: string[];
    tenantId?: string;
  }): ChangeRequest {
    const change: ChangeRequest = {
      id: genId('chg'),
      title: data.title,
      description: data.description ?? data.title,
      type: data.type,
      priority: data.priority ?? 'medium',
      status: 'pending',
      requester: 'admin',
      requesterName: data.requesterName,
      justification: data.justification,
      rollbackPlan: data.rollbackPlan ?? 'Manual rollback required',
      scheduledAt: data.scheduledAt,
      affectedSystems: data.affectedSystems ?? [],
      tenantId: data.tenantId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.changes.push(change);
    return change;
  }

  approveChange(id: string, approverName: string, notes?: string): ChangeRequest | null {
    const idx = this.changes.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const chg = this.changes[idx]!;
    if (chg.status !== 'pending') return chg; // return as-is, caller checks status
    this.changes[idx] = {
      ...chg,
      status: 'approved',
      approver: 'admin',
      approverName,
      approvalNotes: notes,
      updatedAt: nowIso(),
    };
    this.addLog({
      actor: 'admin',
      actorName: approverName,
      action: 'change.approved',
      resource: `changes/${id}`,
      result: 'success',
      ipAddress: '127.0.0.1',
      details: { changeId: id, title: chg.title, notes },
    });
    return { ...this.changes[idx]! };
  }

  rejectChange(id: string, rejectorName: string, reason: string): ChangeRequest | null {
    const idx = this.changes.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const chg = this.changes[idx]!;
    this.changes[idx] = {
      ...chg,
      status: 'rejected',
      approver: 'admin',
      approverName: rejectorName,
      rejectionReason: reason,
      updatedAt: nowIso(),
    };
    this.addLog({
      actor: 'admin',
      actorName: rejectorName,
      action: 'change.rejected',
      resource: `changes/${id}`,
      result: 'success',
      ipAddress: '127.0.0.1',
      details: { changeId: id, reason },
    });
    return { ...this.changes[idx]! };
  }

  // ── Overview ───────────────────────────────────────────────────────────────

  getOverview(): GovernanceOverview {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return {
      activePolicies: this.policies.filter((p) => p.enabled).length,
      totalPolicies: this.policies.length,
      openChanges: this.changes.filter(
        (c) => !['completed', 'rejected', 'rolled_back'].includes(c.status)
      ).length,
      pendingApprovals: this.changes.filter((c) => c.status === 'pending').length,
      openRisks: this.risks.filter((r) => r.status === 'open' || r.status === 'mitigating').length,
      criticalRisks: this.risks.filter((r) => r.severity === 'critical').length,
      auditLogsToday: this.logs.filter((l) => new Date(l.createdAt) >= todayStart).length,
      overallComplianceScore: this.getComplianceStatus().overallScore,
    };
  }
}

export const governanceStore = new GovernanceStore();
