# Developer Guide — @seltriva/governance

## For Platform Developers

This guide explains how to implement governance in platform services that consume `@seltriva/governance`.

---

## Implementing a Governance-Aware Service

Any service that performs protected actions must:

1. **Evaluate a policy** before acting
2. **Log to audit** after acting
3. **Return `GovernanceResult<T>`** to callers

### Pattern

```typescript
import type {
  IPolicyEngine,
  IGovernanceAuditService,
  GovernanceResult,
  PolicyEvaluationRequest,
} from '@seltriva/governance';

class MyService {
  constructor(
    private readonly policyEngine: IPolicyEngine,
    private readonly auditService: IGovernanceAuditService,
  ) {}

  async performProtectedAction(
    actorId: string,
    actorRoles: string[],
    resourceId: string,
    organizationId: string,
  ): Promise<GovernanceResult<MyResult>> {
    // 1. Policy check
    const evalRequest: PolicyEvaluationRequest = {
      subject: { type: 'user', id: actorId, roles: actorRoles, organizationId },
      resource: { type: 'my-resource', id: resourceId, organizationId },
      action: 'my-resource:write',
      context: {
        requestId: generateId(),
        ipAddress: '0.0.0.0',
        timestamp: new Date(),
        attributes: {},
      },
    };

    const evalResult = await this.policyEngine.evaluate(evalRequest);

    if (evalResult.decision !== 'allow') {
      await this.auditService.log({
        actor: { id: actorId, type: 'user', roles: actorRoles, organizationId },
        action: 'my-resource.write',
        resource: { type: 'my-resource', id: resourceId, organizationId },
        outcome: 'denied',
        policyDecision: { decision: evalResult.decision, policyIds: evalResult.matchedPolicies.map(p => p.id) },
      });

      return {
        ok: false,
        error: {
          code: 'POLICY_DENIED',
          message: `Action denied by policy: ${evalResult.matchedRules.map(r => r.name).join(', ')}`,
        },
      };
    }

    // 2. Perform action
    const result = await this.doTheWork(resourceId);

    // 3. Audit success
    await this.auditService.log({
      actor: { id: actorId, type: 'user', roles: actorRoles, organizationId },
      action: 'my-resource.write',
      resource: { type: 'my-resource', id: resourceId, organizationId },
      outcome: 'success',
      after: result,
    });

    return { ok: true, value: result };
  }
}
```

---

## Implementing a Custom Policy Rule

Policies are data — you do not write code for policy logic. Define them in the policy admin service:

```typescript
const policy = await policyAdminService.create({
  name: 'Agent Operation Gate',
  scope: { organizationId: 'org_acme', resourceTypes: ['agent'] },
  conflictResolution: 'deny-overrides',
  rules: [
    {
      name: 'Only operators can restart agents',
      effect: 'deny',
      subjects: [{ type: 'role', id: 'developer' }],
      resources: [{ type: 'agent' }],
      actions: ['agent:restart', 'agent:stop'],
      conditions: [],
      obligations: [],
      priority: 10,
    },
  ],
  tags: ['agent', 'operations'],
  createdBy: adminId,
});
```

---

## Implementing a Claims Provider

Claims enrich the RBAC context with dynamic attributes:

```typescript
class MyClaimsProvider implements IClaimsProvider {
  async extractClaims(subjectId: string): Promise<PolicyClaim[]> {
    const user = await this.userRepo.findById(subjectId);
    return [
      {
        type: 'custom',
        key: 'department',
        value: user.department,
        issuer: 'hr-system',
        issuedAt: new Date(),
      },
      {
        type: 'custom',
        key: 'location',
        value: user.officeLocation,
        issuer: 'hr-system',
        issuedAt: new Date(),
      },
    ];
  }

  async validateClaim(claim: PolicyClaim): Promise<boolean> {
    return claim.issuer === 'hr-system';
  }

  async enrichClaims(ctx: RBACContext): Promise<RBACContext> {
    const additional = await this.extractClaims(ctx.subjectId);
    return { ...ctx, claims: [...ctx.claims, ...additional] };
  }
}
```

---

## Implementing a Policy Repository

```typescript
class PostgresPolicyRepository implements IPolicyRepository {
  async findById(id: PolicyId): Promise<Policy | null> {
    const row = await this.db.query(
      'SELECT * FROM governance_policies WHERE id = $1 AND deleted_at IS NULL',
      [id],
    );
    return row ? mapRowToPolicy(row) : null;
  }

  async findByScope(scope: PolicyScope): Promise<Policy[]> {
    const rows = await this.db.query(
      `SELECT * FROM governance_policies
       WHERE (organization_id = $1 OR organization_id IS NULL)
         AND enabled = true
         AND deleted_at IS NULL`,
      [scope.organizationId],
    );
    return rows.map(mapRowToPolicy);
  }

  async save(policy: Policy): Promise<Policy> { /* ... */ }
  async delete(id: PolicyId): Promise<void>   { /* ... */ }
  async listVersions(id: PolicyId)            { /* ... */ }
  async restoreVersion(id: PolicyId, v: number) { /* ... */ }
}
```

---

## Testing Governance Code

### Unit Testing Policy Evaluation

```typescript
import type { PolicyEvaluationRequest } from '@seltriva/governance';

describe('production deployment policy', () => {
  it('denies developer during off-hours', async () => {
    const request: PolicyEvaluationRequest = {
      subject: { type: 'user', id: 'usr_dev', roles: ['developer'], organizationId: 'org_acme' },
      resource: { type: 'environment', id: 'env_prod', organizationId: 'org_acme' },
      action: 'deploy',
      context: {
        requestId: 'test-req',
        ipAddress: '127.0.0.1',
        timestamp: new Date('2024-01-01T02:00:00Z'), // 2 AM UTC
        attributes: { hour: 2 },
      },
    };

    const result = await policyEngine.evaluate(request);
    expect(result.decision).toBe('deny');
    expect(result.matchedRules[0].name).toContain('off-hours');
  });
});
```

### Testing with Mock Policy Engine

```typescript
class AlwaysAllowPolicyEngine implements IPolicyEngine {
  async evaluate(_req: PolicyEvaluationRequest): Promise<PolicyEvaluationResult> {
    return {
      decision: 'allow',
      matchedPolicies: [],
      matchedRules: [],
      obligations: [],
      evaluationId: 'test',
      evaluatedAt: new Date(),
    };
  }
  async enforce(req) { /* call evaluate + throw on deny */ }
  async evaluateBatch(reqs) { return reqs.map(_ => ({ decision: 'allow' as const, matchedPolicies: [], matchedRules: [], obligations: [], evaluationId: 'test', evaluatedAt: new Date() })); }
  async findApplicable(_scope) { return []; }
}
```

---

## Dependency Injection

All governance interfaces are designed for constructor injection:

```typescript
// Container registration (example with a DI container)
container.bind<IPolicyEngine>('IPolicyEngine').to(OPAPolicyEngine);
container.bind<IGovernanceAuditService>('IAuditService').to(PostgresAuditService);
container.bind<IRBACService>('IRBACService').to(PostgresRBACService);
container.bind<IApprovalWorkflowService>('IApprovalWorkflowService').to(ApprovalWorkflowService);
container.bind<IComplianceService>('IComplianceService').to(ComplianceService);
```

---

## Branded Types

All IDs are branded strings to prevent accidental cross-type assignment:

```typescript
import type { PolicyId, RoleId, OrganizationId } from '@seltriva/governance';

// This won't compile:
const policyId: PolicyId = 'some-string' as RoleId; // ✗ Type error

// Correct:
const policyId = 'pol_abc123' as PolicyId; // ✓
```

Use the `as` cast at system boundaries (API inputs, database reads) and propagate the typed ID throughout.

---

## Adding a New Governance Module

1. Create `src/<module-name>/index.ts`
2. Export branded ID types, entity interfaces, and service interface(s)
3. Service interface returns `GovernanceResult<T>` for all mutating operations
4. Import `GovernanceResult` from `'../policies/index'`
5. Add `export * from './<module-name>/index';` to `src/index.ts`
6. Add sub-path export to `package.json` exports map
7. Document in `docs/module-documentation.md`

### Naming Conventions

| Pattern | Example |
|---------|---------|
| ID types | `FooId = Branded<string, 'FooId'>` |
| Service interface | `IFooService` or `IFooGovernanceService` |
| Admin interface | `IFooAdminService` |
| Repository interface | `IFooRepository` |
| Input types | `CreateFooInput`, `UpdateFooInput` |
| Result types | `GovernanceResult<Foo>` |
