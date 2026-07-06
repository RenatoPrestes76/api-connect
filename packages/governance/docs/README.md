# @seltriva/governance

Enterprise Governance Architecture for the Atlas Platform.

## Overview

`@seltriva/governance` is the Enterprise Governance Platform responsible for managing organizations, environments, runtime policies, permissions, approvals, compliance, releases, auditing, and platform lifecycle.

It defines the **governance contracts** for the entire Atlas Platform — pure port interfaces, typed data models, and policy engine abstractions. There are no concrete implementations in this package; all implementations are provided by infrastructure adapters.

## Design Principles

| Principle | Description |
|-----------|-------------|
| **Policy-driven** | Every action is subject to policy evaluation. No hardcoded rules. |
| **Hexagonal** | Only interfaces and types — no infrastructure dependencies |
| **DDD** | Domain entities, value objects, and bounded contexts |
| **Immutability** | Audit entries, approved decisions, and snapshots are immutable |
| **Zero-trust** | All cross-tenant access is denied by default |
| **Chain-of-custody** | Critical operations leave tamper-evident audit trails |

## Modules

```
packages/governance/src/
├── policies/          Foundation: policy engine, GovernanceResult<T>, GovernanceError
├── rbac/              Roles, permissions, scopes, claims, contexts
├── permissions/       Permission registry, matrix, guard
├── organizations/     Org governance policies, membership rules, tier limits
├── workspaces/        Workspace isolation, promotion gates
├── environments/      Change windows, lockdowns, access restrictions
├── clusters/          Cluster governance, node scheduling
├── nodes/             Node lifecycle, health conditions, taints
├── approval/          Multi-stage approval workflow engine
├── change-management/ ITIL-style change requests, deployment plans
├── audit/             Immutable ledger, chain-of-custody, export
├── compliance/        LGPD, ISO 27001, SOC 2, NIST frameworks
├── configuration/     Scoped governance configuration
├── feature-management/ Feature flags, targeting, experiments
├── package-registry/  Plugin submission, review, publish governance
├── release-management/ Release lifecycle, gates, promotion
├── backup/            Backup policy, scheduling, verification
├── recovery/          DR plans, recovery points, RTO/RPO
├── version-catalog/   Component version tracking, compatibility
├── secret-management/ Secret vault, rotation policies
└── tenant-isolation/  Boundary enforcement, cross-tenant access
```

## Installation

```bash
pnpm add @seltriva/governance
```

## Usage

```typescript
// Full import
import * as Governance from '@seltriva/governance';

// Sub-path import (tree-shakeable)
import type { IComplianceService, ComplianceFramework } from '@seltriva/governance/compliance';
import type { IPolicyEngine, PolicyDecision }           from '@seltriva/governance/policies';
import type { IRBACService, RBACContext }               from '@seltriva/governance/rbac';
```

## Result Pattern

All service methods return `GovernanceResult<T>`:

```typescript
import type { GovernanceResult } from '@seltriva/governance';

const result: GovernanceResult<ComplianceAssessment> = await complianceService.startAssessment(
  organizationId,
  'ISO27001',
  userId,
);

if (result.ok) {
  console.log(result.value.complianceScore);
} else {
  console.error(result.error.code, result.error.message);
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `POLICY_DENIED` | A policy explicitly denied the action |
| `POLICY_NOT_FOUND` | Referenced policy does not exist |
| `VALIDATION_ERROR` | Input data failed validation |
| `CONFLICT` | Conflicting state (e.g., duplicate resource) |
| `NOT_FOUND` | Resource not found |
| `UNAUTHORIZED` | Identity could not be authenticated |
| `FORBIDDEN` | Authenticated but not authorized |
| `INVALID_STATE` | Resource is in an incompatible state for the action |
| `QUOTA_EXCEEDED` | Tier or resource limit exceeded |
| `APPROVAL_REQUIRED` | Action requires approval before proceeding |
| `CHANGE_FROZEN` | Environment or change window is frozen |
| `TENANT_VIOLATION` | Cross-tenant access boundary was violated |
| `COMPLIANCE_VIOLATION` | Action would violate a compliance requirement |
| `UNKNOWN` | Unexpected internal error |

## Compliance Support

| Framework | Coverage |
|-----------|----------|
| **LGPD** | Legal basis tracking, data subject rights (Art. 18), processing records, DPIA |
| **ISO 27001** | All 14 control domains (A.5 – A.18), evidence collection, certification tracking |
| **SOC 2** | All 9 Common Criteria (CC1–CC9), trust category mapping |
| **NIST CSF** | All 5 functions (Identify, Protect, Detect, Respond, Recover) |

## License

Internal — Seltriva Proprietary
