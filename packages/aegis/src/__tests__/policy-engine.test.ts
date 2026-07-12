import { describe, it, expect } from 'vitest';
import {
  evaluateCondition,
  evaluatePolicy,
  evaluatePolicies,
  evaluatePoliciesWithAudit,
} from '../policy-engine.js';
import type { Policy, PolicyCondition, PolicyContext } from '../types.js';

const ctx: PolicyContext = {
  role: 'admin',
  department: 'engineering',
  riskScore: 20,
  hour: 10,
  ip: '192.168.1.1',
  plan: 'enterprise',
};

// ─── evaluateCondition ────────────────────────────────────────────────────────

describe('evaluateCondition — operators', () => {
  it('eq: matches equal string', () => {
    expect(evaluateCondition({ attribute: 'role', operator: 'eq', value: 'admin' }, ctx)).toBe(
      true
    );
    expect(evaluateCondition({ attribute: 'role', operator: 'eq', value: 'viewer' }, ctx)).toBe(
      false
    );
  });

  it('neq: matches unequal string', () => {
    expect(evaluateCondition({ attribute: 'role', operator: 'neq', value: 'viewer' }, ctx)).toBe(
      true
    );
    expect(evaluateCondition({ attribute: 'role', operator: 'neq', value: 'admin' }, ctx)).toBe(
      false
    );
  });

  it('in: matches when value is in list', () => {
    expect(
      evaluateCondition({ attribute: 'role', operator: 'in', value: ['admin', 'superuser'] }, ctx)
    ).toBe(true);
    expect(evaluateCondition({ attribute: 'role', operator: 'in', value: ['viewer'] }, ctx)).toBe(
      false
    );
  });

  it('notIn: matches when value is not in list', () => {
    expect(
      evaluateCondition({ attribute: 'role', operator: 'notIn', value: ['viewer'] }, ctx)
    ).toBe(true);
    expect(evaluateCondition({ attribute: 'role', operator: 'notIn', value: ['admin'] }, ctx)).toBe(
      false
    );
  });

  it('gt: matches greater-than', () => {
    expect(evaluateCondition({ attribute: 'riskScore', operator: 'gt', value: 10 }, ctx)).toBe(
      true
    );
    expect(evaluateCondition({ attribute: 'riskScore', operator: 'gt', value: 30 }, ctx)).toBe(
      false
    );
  });

  it('lt: matches less-than', () => {
    expect(evaluateCondition({ attribute: 'riskScore', operator: 'lt', value: 30 }, ctx)).toBe(
      true
    );
    expect(evaluateCondition({ attribute: 'riskScore', operator: 'lt', value: 10 }, ctx)).toBe(
      false
    );
  });

  it('between: matches inclusive range', () => {
    expect(evaluateCondition({ attribute: 'hour', operator: 'between', value: [9, 17] }, ctx)).toBe(
      true
    );
    expect(
      evaluateCondition({ attribute: 'hour', operator: 'between', value: [18, 23] }, ctx)
    ).toBe(false);
  });

  it('matches: tests regex', () => {
    expect(
      evaluateCondition({ attribute: 'ip', operator: 'matches', value: '^192\\.168' }, ctx)
    ).toBe(true);
    expect(evaluateCondition({ attribute: 'ip', operator: 'matches', value: '^10\\.' }, ctx)).toBe(
      false
    );
  });

  it('returns false for missing attribute', () => {
    expect(evaluateCondition({ attribute: 'nonexistent', operator: 'eq', value: 'x' }, ctx)).toBe(
      false
    );
  });
});

// ─── evaluatePolicy ────────────────────────────────────────────────────────────

const makePolicy = (overrides: Partial<Policy> = {}): Policy => ({
  id: 'p1',
  name: 'Test',
  effect: 'ALLOW',
  priority: 50,
  active: true,
  logic: 'AND',
  conditions: [],
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('evaluatePolicy', () => {
  it('inactive policy never matches', () => {
    expect(evaluatePolicy(makePolicy({ active: false }), ctx)).toBe(false);
  });

  it('zero conditions → always matches (if active)', () => {
    expect(evaluatePolicy(makePolicy({ conditions: [] }), ctx)).toBe(true);
  });

  it('AND: all conditions must pass', () => {
    const policy = makePolicy({
      logic: 'AND',
      conditions: [
        { attribute: 'role', operator: 'eq', value: 'admin' },
        { attribute: 'riskScore', operator: 'lt', value: 30 },
      ],
    });
    expect(evaluatePolicy(policy, ctx)).toBe(true);

    const failing = makePolicy({
      logic: 'AND',
      conditions: [
        { attribute: 'role', operator: 'eq', value: 'admin' },
        { attribute: 'riskScore', operator: 'lt', value: 10 }, // fails
      ],
    });
    expect(evaluatePolicy(failing, ctx)).toBe(false);
  });

  it('OR: any condition passes', () => {
    const policy = makePolicy({
      logic: 'OR',
      conditions: [
        { attribute: 'role', operator: 'eq', value: 'viewer' }, // fails
        { attribute: 'riskScore', operator: 'lt', value: 30 }, // passes
      ],
    });
    expect(evaluatePolicy(policy, ctx)).toBe(true);
  });
});

// ─── evaluatePolicies (multi-policy) ─────────────────────────────────────────

describe('evaluatePolicies', () => {
  it('DEFAULT_DENY when no policies match', () => {
    const policies = [
      makePolicy({ conditions: [{ attribute: 'role', operator: 'eq', value: 'viewer' }] }),
    ];
    expect(evaluatePolicies(policies, ctx)).toBe('DEFAULT_DENY');
  });

  it('higher priority policy wins', () => {
    const low = makePolicy({ id: 'low', priority: 10, effect: 'ALLOW', conditions: [] });
    const high = makePolicy({ id: 'high', priority: 200, effect: 'DENY', conditions: [] });
    expect(evaluatePolicies([low, high], ctx)).toBe('DENY');
  });

  it('DENY at high priority blocks ALLOW at lower priority', () => {
    const allow = makePolicy({ id: 'allow', priority: 50, effect: 'ALLOW', conditions: [] });
    const deny = makePolicy({ id: 'deny', priority: 200, effect: 'DENY', conditions: [] });
    expect(evaluatePolicies([allow, deny], ctx)).toBe('DENY');
  });

  it('inactive policies are ignored', () => {
    const inactive = makePolicy({
      id: 'off',
      active: false,
      effect: 'DENY',
      priority: 999,
      conditions: [],
    });
    const active = makePolicy({
      id: 'on',
      active: true,
      effect: 'ALLOW',
      priority: 1,
      conditions: [],
    });
    expect(evaluatePolicies([inactive, active], ctx)).toBe('ALLOW');
  });
});

// ─── evaluatePoliciesWithAudit ────────────────────────────────────────────────

describe('evaluatePoliciesWithAudit', () => {
  it('returns matched policy metadata', () => {
    const policy = makePolicy({
      id: 'p-admin',
      name: 'Admin Allow',
      effect: 'ALLOW',
      conditions: [],
    });
    const result = evaluatePoliciesWithAudit([policy], ctx);
    expect(result.decision).toBe('ALLOW');
    expect(result.matchedPolicy?.id).toBe('p-admin');
    expect(result.evaluatedCount).toBe(1);
  });

  it('returns null matchedPolicy on DEFAULT_DENY', () => {
    const result = evaluatePoliciesWithAudit([], ctx);
    expect(result.decision).toBe('DEFAULT_DENY');
    expect(result.matchedPolicy).toBeNull();
  });
});
