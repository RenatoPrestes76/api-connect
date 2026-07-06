/**
 * PolicyEngineImpl test suite
 *
 * Tests: condition operators, conflict resolution strategies,
 * attribute path resolution, obligations, batch evaluation.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEngineImpl, GovernancePolicyError } from '../policies/engine.js';
import type {
  Policy,
  PolicyEvaluationRequest,
  PolicySubject,
  PolicyResource,
  PolicyContext,
  PolicyId,
  RuleId,
} from '../policies/index.js';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function makeId(id: string): PolicyId { return id as unknown as PolicyId; }
function makeRuleId(id: string): RuleId { return id as unknown as RuleId; }

const NOW = new Date();

function makeSubject(overrides: Partial<PolicySubject> = {}): PolicySubject {
  return {
    id: 'user-1',
    type: 'user',
    organizationId: 'org-1',
    workspaceId: 'ws-1',
    environmentId: 'env-prod',
    roles: ['developer'],
    claims: [],
    ...overrides,
  };
}

function makeResource(overrides: Partial<PolicyResource> = {}): PolicyResource {
  return {
    type: 'configuration',
    id: 'config-1',
    organizationId: 'org-1',
    workspaceId: 'ws-1',
    environmentId: 'env-prod',
    ...overrides,
  };
}

function makeContext(overrides: Partial<PolicyContext> = {}): PolicyContext {
  return {
    timestamp: NOW,
    environment: 'production',
    ipAddress: '10.0.0.1',
    ...overrides,
  };
}

function makeRequest(
  overrides: Partial<PolicyEvaluationRequest> = {},
): PolicyEvaluationRequest {
  return {
    requestId: 'req-test',
    subject: makeSubject(),
    resource: makeResource(),
    action: 'read',
    context: makeContext(),
    ...overrides,
  };
}

function makePolicy(overrides: Partial<Policy> = {}): Policy {
  return {
    id: makeId('pol-1'),
    name: 'Test Policy',
    version: '1.0.0',
    enabled: true,
    scope: {},
    conflictResolution: 'deny-overrides',
    rules: [],
    createdAt: NOW,
    updatedAt: NOW,
    createdBy: 'system',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PolicyEngineImpl', () => {
  let engine: PolicyEngineImpl;

  beforeEach(() => {
    engine = new PolicyEngineImpl();
  });

  describe('no applicable policies', () => {
    it('returns not-applicable when no policies registered', async () => {
      const result = await engine.evaluate(makeRequest());
      expect(result.decision).toBe('not-applicable');
    });

    it('returns not-applicable for disabled policies', async () => {
      engine.register(makePolicy({
        enabled: false,
        rules: [{ id: makeRuleId('r1'), name: 'allow-all', effect: 'allow', actions: ['*'] }],
      }));
      const result = await engine.evaluate(makeRequest());
      expect(result.decision).toBe('not-applicable');
    });
  });

  describe('simple allow/deny', () => {
    it('allows when matching allow rule with no conditions', async () => {
      engine.register(makePolicy({
        rules: [{ id: makeRuleId('r1'), name: 'allow-all', effect: 'allow', actions: ['*'] }],
      }));
      const result = await engine.evaluate(makeRequest());
      expect(result.decision).toBe('allow');
    });

    it('denies when matching deny rule', async () => {
      engine.register(makePolicy({
        rules: [{ id: makeRuleId('r1'), name: 'deny-all', effect: 'deny', actions: ['*'] }],
      }));
      const result = await engine.evaluate(makeRequest());
      expect(result.decision).toBe('deny');
    });

    it('returns not-applicable when action does not match', async () => {
      engine.register(makePolicy({
        rules: [{ id: makeRuleId('r1'), name: 'allow-write', effect: 'allow', actions: ['write'] }],
      }));
      const result = await engine.evaluate(makeRequest({ action: 'delete' }));
      expect(result.decision).toBe('not-applicable');
    });
  });

  describe('condition operators', () => {
    it('eq — matches equal value', async () => {
      engine.register(makePolicy({
        rules: [{
          id: makeRuleId('r1'),
          name: 'allow-prod',
          effect: 'allow',
          actions: ['*'],
          subjects: [{ attribute: 'subject.organizationId', operator: 'eq', value: 'org-1' }],
        }],
      }));
      const result = await engine.evaluate(makeRequest());
      expect(result.decision).toBe('allow');
    });

    it('eq — does not match different value', async () => {
      engine.register(makePolicy({
        rules: [{
          id: makeRuleId('r1'),
          name: 'allow-org2',
          effect: 'allow',
          actions: ['*'],
          subjects: [{ attribute: 'subject.organizationId', operator: 'eq', value: 'org-2' }],
        }],
      }));
      const result = await engine.evaluate(makeRequest());
      expect(result.decision).toBe('not-applicable');
    });

    it('in — matches when value is in array', async () => {
      engine.register(makePolicy({
        rules: [{
          id: makeRuleId('r1'),
          name: 'allow-env',
          effect: 'allow',
          actions: ['*'],
          subjects: [{ attribute: 'subject.environmentId', operator: 'in', value: ['env-prod', 'env-staging'] }],
        }],
      }));
      const result = await engine.evaluate(makeRequest());
      expect(result.decision).toBe('allow');
    });

    it('contains — matches when subject.roles contains value', async () => {
      engine.register(makePolicy({
        rules: [{
          id: makeRuleId('r1'),
          name: 'allow-developer',
          effect: 'allow',
          actions: ['*'],
          subjects: [{ attribute: 'subject.roles', operator: 'contains', value: 'developer' }],
        }],
      }));
      const result = await engine.evaluate(makeRequest());
      expect(result.decision).toBe('allow');
    });

    it('contains — does not match when role absent', async () => {
      engine.register(makePolicy({
        rules: [{
          id: makeRuleId('r1'),
          name: 'allow-admin',
          effect: 'allow',
          actions: ['*'],
          subjects: [{ attribute: 'subject.roles', operator: 'contains', value: 'admin' }],
        }],
      }));
      const result = await engine.evaluate(makeRequest());
      expect(result.decision).toBe('not-applicable');
    });

    it('starts-with — matches string prefix', async () => {
      engine.register(makePolicy({
        rules: [{
          id: makeRuleId('r1'),
          name: 'allow-env-prefix',
          effect: 'allow',
          actions: ['*'],
          subjects: [{ attribute: 'subject.environmentId', operator: 'starts-with', value: 'env-' }],
        }],
      }));
      const result = await engine.evaluate(makeRequest());
      expect(result.decision).toBe('allow');
    });

    it('matches — supports regex', async () => {
      engine.register(makePolicy({
        rules: [{
          id: makeRuleId('r1'),
          name: 'allow-org-regex',
          effect: 'allow',
          actions: ['*'],
          subjects: [{ attribute: 'subject.organizationId', operator: 'matches', value: '^org-\\d+$' }],
        }],
      }));
      const result = await engine.evaluate(makeRequest());
      expect(result.decision).toBe('allow');
    });

    it('gt — numeric comparison', async () => {
      engine.register(makePolicy({
        rules: [{
          id: makeRuleId('r1'),
          name: 'allow-large-batch',
          effect: 'allow',
          actions: ['*'],
          subjects: [{
            attribute: 'subject.attributes.batchSize',
            operator: 'gt',
            value: 100,
          }],
        }],
      }));
      const req = makeRequest({
        subject: makeSubject({ attributes: { batchSize: 500 } }),
      });
      const result = await engine.evaluate(req);
      expect(result.decision).toBe('allow');
    });

    it('negate — inverts the condition result', async () => {
      engine.register(makePolicy({
        rules: [{
          id: makeRuleId('r1'),
          name: 'deny-non-prod',
          effect: 'deny',
          actions: ['*'],
          subjects: [{
            attribute: 'subject.environmentId',
            operator: 'eq',
            value: 'env-prod',
            negate: true,
          }],
        }],
      }));
      // subject.environmentId IS env-prod, so negated → condition fails → not-applicable
      const result = await engine.evaluate(makeRequest());
      expect(result.decision).toBe('not-applicable');
    });

    it('exists — attribute present', async () => {
      engine.register(makePolicy({
        rules: [{
          id: makeRuleId('r1'),
          name: 'require-org',
          effect: 'deny',
          actions: ['*'],
          subjects: [{ attribute: 'subject.organizationId', operator: 'not-exists' }],
        }],
      }));
      // organizationId exists → not-exists fails → not-applicable
      const result = await engine.evaluate(makeRequest());
      expect(result.decision).toBe('not-applicable');
    });
  });

  describe('conflict resolution', () => {
    it('deny-overrides: deny wins when both allow and deny rules match', async () => {
      engine.register(makePolicy({
        conflictResolution: 'deny-overrides',
        rules: [
          { id: makeRuleId('r1'), name: 'allow-all', effect: 'allow', actions: ['*'] },
          { id: makeRuleId('r2'), name: 'deny-all', effect: 'deny', actions: ['*'] },
        ],
      }));
      const result = await engine.evaluate(makeRequest());
      expect(result.decision).toBe('deny');
    });

    it('allow-overrides: allow wins when both match', async () => {
      engine.register(makePolicy({
        conflictResolution: 'allow-overrides',
        rules: [
          { id: makeRuleId('r1'), name: 'allow-all', effect: 'allow', actions: ['*'] },
          { id: makeRuleId('r2'), name: 'deny-all', effect: 'deny', actions: ['*'] },
        ],
      }));
      const result = await engine.evaluate(makeRequest());
      expect(result.decision).toBe('allow');
    });

    it('first-applicable: returns first matching rule decision', async () => {
      engine.register(makePolicy({
        conflictResolution: 'first-applicable',
        rules: [
          { id: makeRuleId('r1'), name: 'deny-first', effect: 'deny', priority: 10, actions: ['*'] },
          { id: makeRuleId('r2'), name: 'allow-second', effect: 'allow', priority: 5, actions: ['*'] },
        ],
      }));
      const result = await engine.evaluate(makeRequest());
      expect(result.decision).toBe('deny');
    });

    it('only-one: returns indeterminate when multiple rules match', async () => {
      engine.register(makePolicy({
        conflictResolution: 'only-one',
        rules: [
          { id: makeRuleId('r1'), name: 'rule-1', effect: 'allow', actions: ['*'] },
          { id: makeRuleId('r2'), name: 'rule-2', effect: 'allow', actions: ['*'] },
        ],
      }));
      const result = await engine.evaluate(makeRequest());
      expect(result.decision).toBe('indeterminate');
    });
  });

  describe('obligations', () => {
    it('collects obligations from matching allow rules', async () => {
      engine.register(makePolicy({
        rules: [{
          id: makeRuleId('r1'),
          name: 'allow-with-audit',
          effect: 'allow',
          actions: ['*'],
          obligations: [
            { id: 'ob-audit', kind: 'after', action: 'audit.log' },
            { id: 'ob-notify', kind: 'after', action: 'notify.admin' },
          ],
        }],
      }));
      const result = await engine.evaluate(makeRequest());
      expect(result.decision).toBe('allow');
      expect(result.obligations).toHaveLength(2);
      expect(result.obligations[0]!.action).toBe('audit.log');
    });

    it('does not return obligations when decision is deny', async () => {
      engine.register(makePolicy({
        rules: [{
          id: makeRuleId('r1'),
          name: 'deny-with-obligation',
          effect: 'deny',
          actions: ['*'],
          obligations: [{ id: 'ob-1', kind: 'after', action: 'some.action' }],
        }],
      }));
      const result = await engine.evaluate(makeRequest());
      expect(result.decision).toBe('deny');
      expect(result.obligations).toHaveLength(0);
    });
  });

  describe('enforce()', () => {
    it('passes without throwing when decision is allow', async () => {
      engine.register(makePolicy({
        rules: [{ id: makeRuleId('r1'), name: 'allow-all', effect: 'allow', actions: ['*'] }],
      }));
      await expect(engine.enforce(makeRequest())).resolves.toBeUndefined();
    });

    it('throws GovernancePolicyError when decision is deny', async () => {
      engine.register(makePolicy({
        rules: [{ id: makeRuleId('r1'), name: 'deny-all', effect: 'deny', actions: ['*'] }],
      }));
      await expect(engine.enforce(makeRequest())).rejects.toThrow(GovernancePolicyError);
    });

    it('does not throw when not-applicable (permissive default)', async () => {
      await expect(engine.enforce(makeRequest())).resolves.toBeUndefined();
    });
  });

  describe('evaluateBatch()', () => {
    it('evaluates multiple requests in parallel', async () => {
      engine.register(makePolicy({
        rules: [{ id: makeRuleId('r1'), name: 'allow-all', effect: 'allow', actions: ['*'] }],
      }));
      const requests = [
        makeRequest({ requestId: 'req-1' }),
        makeRequest({ requestId: 'req-2', action: 'write' }),
        makeRequest({ requestId: 'req-3', action: 'delete' }),
      ];
      const results = await engine.evaluateBatch(requests);
      expect(results).toHaveLength(3);
      expect(results.every((r) => r.decision === 'allow')).toBe(true);
    });
  });

  describe('scope filtering', () => {
    it('policy scoped to org-2 does not apply to org-1 request', async () => {
      engine.register(makePolicy({
        scope: { organizationId: 'org-2' },
        rules: [{ id: makeRuleId('r1'), name: 'allow-org2', effect: 'allow', actions: ['*'] }],
      }));
      const result = await engine.evaluate(makeRequest());
      expect(result.decision).toBe('not-applicable');
    });

    it('platform-wide policy (no org) applies to any request', async () => {
      engine.register(makePolicy({
        scope: {},
        rules: [{ id: makeRuleId('r1'), name: 'platform-allow', effect: 'allow', actions: ['*'] }],
      }));
      const result = await engine.evaluate(makeRequest({
        subject: makeSubject({ organizationId: 'any-org' }),
        resource: makeResource({ organizationId: 'any-org', type: 'agent' }),
      }));
      expect(result.decision).toBe('allow');
    });

    it('policy restricted to resource type does not apply to other types', async () => {
      engine.register(makePolicy({
        scope: { resourceTypes: ['secret'] },
        rules: [{ id: makeRuleId('r1'), name: 'allow-secrets', effect: 'allow', actions: ['*'] }],
      }));
      const result = await engine.evaluate(makeRequest({
        resource: makeResource({ type: 'configuration' }),
      }));
      expect(result.decision).toBe('not-applicable');
    });
  });

  describe('audit trail', () => {
    it('includes matched policy details in result', async () => {
      engine.register(makePolicy({
        id: makeId('pol-audit'),
        name: 'My Audit Policy',
        rules: [{
          id: makeRuleId('r1'),
          name: 'allow-read',
          effect: 'allow',
          actions: ['read'],
          subjects: [{ attribute: 'subject.roles', operator: 'contains', value: 'developer' }],
        }],
      }));
      const result = await engine.evaluate(makeRequest({ action: 'read' }));
      expect(result.decision).toBe('allow');
      expect(result.applicablePolicies).toHaveLength(1);
      expect(result.applicablePolicies[0]!.policyName).toBe('My Audit Policy');
      expect(result.applicablePolicies[0]!.matchedConditions).toHaveLength(1);
    });

    it('records evaluatedAt and durationMs', async () => {
      engine.register(makePolicy({
        rules: [{ id: makeRuleId('r1'), name: 'allow-all', effect: 'allow', actions: ['*'] }],
      }));
      const result = await engine.evaluate(makeRequest());
      expect(result.evaluatedAt).toBeInstanceOf(Date);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
