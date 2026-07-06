# Governance Guide

## What Is Governance?

In the Atlas Platform, **governance** is the set of rules, policies, and processes that control who can do what, where, and when. Everything that affects organizational data, infrastructure, or security is governed.

Governance is:
- **Policy-driven**: rules are data, not code
- **Auditable**: every decision leaves a tamper-evident trail
- **Modular**: each domain has its own governance contract
- **Hierarchical**: platform > organization > workspace > environment

---

## Policy Engine

The policy engine is the foundation of all governance decisions.

### Creating a Policy

A policy consists of rules. Each rule has subjects (who), resources (what), actions (which verbs), and conditions (when):

```typescript
const policy: Policy = {
  id: 'pol_production_deploy' as PolicyId,
  name: 'Production Deployment Gate',
  version: 1,
  enabled: true,
  scope: {
    organizationId: 'org_acme',
    resourceTypes: ['environment', 'deployment'],
  },
  conflictResolution: 'deny-overrides',
  rules: [
    {
      id: 'rule_deny_unscheduled' as RuleId,
      name: 'Deny deployments outside maintenance window',
      effect: 'deny',
      subjects: [{ type: 'role', id: 'developer' }],
      resources: [{ type: 'environment', attribute: 'name', value: 'production' }],
      actions: ['deploy', 'configuration:write'],
      conditions: [
        {
          attribute: 'context.hour',
          operator: 'lt',
          value: 8,
        },
      ],
      obligations: [],
      priority: 100,
    },
  ],
  tags: ['production', 'deployment'],
};
```

### Evaluating a Policy

```typescript
const result = await policyEngine.evaluate({
  subject: {
    type: 'user',
    id: userId,
    roles: ['developer'],
    organizationId: 'org_acme',
  },
  resource: {
    type: 'environment',
    id: 'env_production',
    organizationId: 'org_acme',
  },
  action: 'deploy',
  context: {
    requestId: 'req_abc123',
    ipAddress: '10.0.1.50',
    timestamp: new Date(),
    attributes: {
      hour: new Date().getUTCHours(),
    },
  },
});

if (result.decision === 'allow') {
  // proceed
} else if (result.decision === 'deny') {
  // blocked by policy
  throw new Error(`Denied by: ${result.matchedRules.map(r => r.name).join(', ')}`);
}
```

### Conflict Resolution Strategies

| Strategy | Behavior |
|----------|----------|
| `deny-overrides` | A single deny rule blocks the action (default for production) |
| `allow-overrides` | A single allow rule permits the action |
| `first-applicable` | First matching rule (by priority) decides |
| `only-one` | Exactly one rule must match; error if multiple match |

---

## RBAC

### Role Hierarchy

```
PLATFORM_SUPER_ADMIN
    └── PLATFORM_ADMIN
            ├── ORG_OWNER
            │       └── ORG_ADMIN
            │               ├── WORKSPACE_ADMIN
            │               │       └── DEVELOPER
            │               └── SECURITY_ADMIN
            └── PLATFORM_SUPPORT
```

### Assigning Roles

```typescript
await rbacService.assignRole({
  subjectId: userId,
  roleId: PLATFORM_ROLES.ORG_ADMIN,
  organizationId: 'org_acme',
  grantedBy: adminId,
  expiresAt: addMonths(new Date(), 6),
});
```

### Checking Permissions

```typescript
// Check a single permission
const canDeploy = await rbacService.checkPermission(
  rbacContext,
  PLATFORM_PERMISSIONS.ENVIRONMENTS_WRITE,
);

// Assert (throws FORBIDDEN if false)
await permissionGuard.assert(rbacContext, PLATFORM_PERMISSIONS.POLICIES_ADMIN);

// Check all (AND)
const canDoAll = await permissionGuard.checkAll(rbacContext, [
  PLATFORM_PERMISSIONS.RELEASES_CREATE,
  PLATFORM_PERMISSIONS.RELEASES_APPROVE,
]);
```

---

## Approval Workflows

### Simple Two-Stage Approval

```typescript
// 1. Check if action needs approval
const required = await approvalService.requiresApproval(
  'environment:deploy:production',
  organizationId,
);

if (required) {
  // 2. Create approval request
  const request = await approvalService.request({
    requesterId: userId,
    requesterEmail: userEmail,
    organizationId,
    action: 'environment:deploy:production',
    resourceType: 'environment',
    resourceId: envId,
    title: 'Deploy v1.3.0 to Production',
    description: 'Scheduled maintenance window deployment',
    payload: deploymentSpec,
    urgency: 'high',
  });

  // 3. Approvers get notified and call .decide()
  // Wait for approval...
}
```

### Emergency Changes

```typescript
const emergencyRequest = await approvalService.request({
  ...input,
  urgency: 'emergency',
  policyId: EMERGENCY_APPROVAL_POLICY_ID,
});

// Emergency approvals are expedited (1 stage, 1 approver)
// Post-approval review is required within 24h
```

---

## Change Management

### Standard Change (pre-approved)

```typescript
// Standard changes skip approval workflow
const change = await changeService.create({
  type: 'standard',
  category: 'configuration',
  risk: 'low',
  ...
});

// Can be implemented immediately
await changeService.startImplementation(change.id, by);
```

### Normal Change (full approval)

```typescript
const change = await changeService.create({
  type: 'normal',
  category: 'deployment',
  risk: 'high',
  title: 'Deploy Connector v2.0',
  rationale: 'Adds support for SAP S/4HANA 2024',
  impact: {
    scope: 'limited',
    affectedComponents: ['connector-runtime'],
    estimatedDowntimeMinutes: 0,
    requiresMaintenanceWindow: false,
    customerFacing: true,
    dataImpact: 'read-only',
  },
  rollbackPlan: {
    available: true,
    strategy: 'revert-commit',
    estimatedRollbackMinutes: 5,
    steps: ['Revert deployment', 'Verify health'],
    dataRecoverable: true,
    rollbackWindowHours: 4,
  },
  implementationSteps: [
    { name: 'Pre-flight check', automated: true, estimatedMinutes: 2 },
    { name: 'Deploy containers', automated: true, estimatedMinutes: 5 },
    { name: 'Smoke test', automated: true, estimatedMinutes: 3 },
  ],
  requestedBy: userId,
});
```

---

## Environment Governance

### Change Windows

```typescript
// Freeze production for release
await envGovernanceService.freezeChangeWindow(
  'env_production',
  addDays(new Date(), 7),
  'Release freeze for v1.4.0',
  adminId,
);

// Check before deploying
const allowed = await envGovernanceService.isChangeAllowed(
  'env_production',
  'deploy',
);
// allowed.allowed === false, allowed.changeWindowStatus === 'closed'
```

### Locking an Environment

```typescript
// Lock for incident response
await envGovernanceService.lockEnvironment(
  'env_production',
  'Active security incident INC-2024-0042',
  adminId,
  addHours(new Date(), 4),  // auto-unlock in 4h
);
```

---

## Compliance

### Starting an ISO 27001 Assessment

```typescript
const assessment = await complianceService.startAssessment(
  organizationId,
  'ISO27001',
  assessorId,
);

// Record findings
await complianceService.recordFinding(assessment.id, {
  controlId: 'ctrl_a9_1_1' as ComplianceControlId,
  status: 'compliant',
  evidence: ['audit_log_export_2024.jsonl', 'policy_doc_access_control.pdf'],
  gaps: [],
  risk: 'low',
  remediationRequired: false,
  observation: 'Access control policy is documented and reviewed annually.',
  recommendations: [],
});

// Complete
const final = await complianceService.completeAssessment(assessment.id, assessorId);
console.log(`Score: ${final.value.complianceScore}/100`);
```

### LGPD Data Subject Request

```typescript
const dsrRequest = await complianceService.createLGPDRequest({
  organizationId,
  type: 'deletion',   // Art. 18, VI
  requesterId: dataSubjectId,
  description: 'Request for erasure of personal data.',
});
// Deadline is auto-set to 15 days (Art. 15)
```

---

## Audit

### Logging a Governance Event

```typescript
await auditService.log({
  organizationId,
  actor: {
    id: userId,
    type: 'user',
    email: userEmail,
    roles: ['org-admin'],
    organizationId,
  },
  action: 'policy.created',
  resource: {
    type: 'policy',
    id: policyId,
    organizationId,
  },
  outcome: 'success',
  sensitivityLevel: 'confidential',
  after: policy,
  policyDecision: {
    decision: 'allow',
    policyIds: ['pol_rbac_create'],
  },
});
```

### Verifying Chain Integrity

```typescript
const verification = await auditService.verifyChain(chainId);
if (verification.integrity === 'tampered') {
  // Security incident: alert immediately
  console.error(`Tamper detected at entry: ${verification.firstTamperedEntry}`);
}
```

---

## Secret Management

```typescript
// Store a secret
const secret = await secretManager.create({
  name: 'salesforce-api-key',
  kind: 'api-key',
  value: rawApiKey,
  organizationId,
  rotationPolicyId: quarterlyRotationPolicyId,
  allowedConsumers: [
    { type: 'agent', id: agentId, permissions: ['read'] },
  ],
  createdBy: adminId,
});

// Access a secret (fully audited)
const access = await secretManager.access({
  secretId: secret.id,
  requesterId: agentId,
  requesterType: 'agent',
  justification: 'Sync job run #12345',
});
console.log(access.value.value); // plaintext
```

---

## Backup & Recovery

### Defining a Backup Policy

```typescript
await backupGovernance.createPolicy({
  name: 'Production Daily Backup',
  organizationId,
  targets: [
    { id: 'tgt_db', type: 'database', name: 'PostgreSQL', identifier: 'postgres://...', backupType: 'full', priority: 1 },
    { id: 'tgt_cfg', type: 'config', name: 'Config Store', identifier: 'config://...', backupType: 'incremental', priority: 2 },
  ],
  schedule: { frequency: 'daily', timezone: 'America/Sao_Paulo', startTime: '03:00' },
  retention: {
    keepLast: 7,
    keepDailyForDays: 30,
    keepWeeklyForWeeks: 12,
    keepMonthlyForMonths: 12,
    keepYearlyForYears: 7,
  },
  encryption: 'aes-256',
  destinationId: 's3://atlas-backups-prod',
  createdBy: adminId,
});
```
