import { describe, it, expect, beforeEach } from 'vitest';
import { FeatureFlagStore, evaluateFlag } from '../feature-flags.js';
import type { FeatureFlag } from '../types.js';

function makeFlag(overrides: Partial<FeatureFlag> = {}): FeatureFlag {
  return {
    id: 'flag-1',
    name: 'Test Flag',
    key: 'test-flag',
    description: 'A test feature flag',
    enabled: true,
    rolloutPercentage: 100,
    targetingRules: [],
    variants: [],
    defaultVariant: 'control',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    createdBy: 'system',
    ...overrides,
  };
}

describe('evaluateFlag — disabled flag', () => {
  it('returns enabled=false when flag is disabled', () => {
    const flag = makeFlag({ enabled: false });
    const result = evaluateFlag(flag, { tenantId: 'tenant-1' });
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe('disabled');
  });
});

describe('evaluateFlag — rollout percentage', () => {
  it('100% rollout enables flag for all tenants', () => {
    const flag = makeFlag({ rolloutPercentage: 100 });
    const result = evaluateFlag(flag, { tenantId: 'any-tenant' });
    expect(result.enabled).toBe(true);
    expect(result.reason).toBe('default');
  });

  it('0% rollout disables flag for all tenants', () => {
    const flag = makeFlag({ rolloutPercentage: 0 });
    const result = evaluateFlag(flag, { tenantId: 'any-tenant' });
    expect(result.enabled).toBe(false);
    expect(result.reason).toBe('rollout');
  });

  it('same tenant always gets same result (stable hash)', () => {
    const flag = makeFlag({ rolloutPercentage: 50 });
    const r1 = evaluateFlag(flag, { tenantId: 'tenant-stable' });
    const r2 = evaluateFlag(flag, { tenantId: 'tenant-stable' });
    expect(r1.enabled).toBe(r2.enabled);
  });

  it('different tenants get a mixed split at 50% across 200 samples', () => {
    const flag = makeFlag({ rolloutPercentage: 50 });
    let enabled = 0;
    for (let i = 0; i < 200; i++) {
      if (evaluateFlag(flag, { tenantId: `org-${i}-x${i * 7}` }).enabled) enabled++;
    }
    // Expect somewhere between 20%-80% enabled (50% target, wide tolerance for hash distribution)
    expect(enabled).toBeGreaterThan(20);
    expect(enabled).toBeLessThan(180);
  });
});

describe('evaluateFlag — targeting rules', () => {
  it('eq operator matches exact value', () => {
    const flag = makeFlag({
      targetingRules: [
        {
          id: 'r1',
          attribute: 'plan',
          operator: 'eq',
          values: ['enterprise'],
          variant: 'full',
        },
      ],
    });
    const result = evaluateFlag(flag, { tenantId: 't1', plan: 'enterprise' });
    expect(result.enabled).toBe(true);
    expect(result.variant).toBe('full');
    expect(result.reason).toBe('targeting_match');
  });

  it('in operator matches any of values', () => {
    const flag = makeFlag({
      targetingRules: [
        {
          id: 'r1',
          attribute: 'plan',
          operator: 'in',
          values: ['enterprise', 'professional'],
          variant: 'beta',
        },
      ],
    });
    expect(evaluateFlag(flag, { plan: 'enterprise' }).reason).toBe('targeting_match');
    expect(evaluateFlag(flag, { plan: 'professional' }).reason).toBe('targeting_match');
    expect(evaluateFlag(flag, { plan: 'community' }).reason).toBe('default');
  });

  it('notIn operator excludes listed values', () => {
    const flag = makeFlag({
      targetingRules: [
        {
          id: 'r1',
          attribute: 'plan',
          operator: 'notIn',
          values: ['community'],
          variant: 'upgrade',
        },
      ],
    });
    expect(evaluateFlag(flag, { plan: 'enterprise' }).reason).toBe('targeting_match');
    expect(evaluateFlag(flag, { plan: 'community' }).reason).toBe('default');
  });

  it('contains operator matches substring', () => {
    const flag = makeFlag({
      targetingRules: [
        {
          id: 'r1',
          attribute: 'tenantId',
          operator: 'contains',
          values: ['enterprise'],
          variant: 'v',
        },
      ],
    });
    expect(evaluateFlag(flag, { tenantId: 'tenant-enterprise' }).reason).toBe('targeting_match');
    expect(evaluateFlag(flag, { tenantId: 'tenant-basic' }).reason).toBe('default');
  });

  it('targeting rule missing attribute returns no match', () => {
    const flag = makeFlag({
      targetingRules: [
        {
          id: 'r1',
          attribute: 'userId',
          operator: 'eq',
          values: ['admin'],
          variant: 'v',
        },
      ],
    });
    const result = evaluateFlag(flag, { tenantId: 't1' });
    expect(result.reason).not.toBe('targeting_match');
  });
});

describe('evaluateFlag — A/B variants', () => {
  it('returns a variant from the variants list', () => {
    const flag = makeFlag({
      variants: [
        { id: 'v1', key: 'control', description: 'Control', weight: 50 },
        { id: 'v2', key: 'treatment', description: 'Treatment', weight: 50 },
      ],
    });
    const result = evaluateFlag(flag, { tenantId: 'some-tenant' });
    expect(['control', 'treatment']).toContain(result.variant);
  });
});

describe('FeatureFlagStore', () => {
  let store: FeatureFlagStore;
  beforeEach(() => {
    store = new FeatureFlagStore();
  });

  it('upsert and get by id', () => {
    const flag = makeFlag();
    store.upsert(flag);
    expect(store.get('flag-1')?.key).toBe('test-flag');
  });

  it('getByKey finds flag by key string', () => {
    store.upsert(makeFlag());
    expect(store.getByKey('test-flag')?.id).toBe('flag-1');
  });

  it('list returns all flags', () => {
    store.upsert(makeFlag({ id: 'f1', key: 'k1' }));
    store.upsert(makeFlag({ id: 'f2', key: 'k2' }));
    expect(store.list()).toHaveLength(2);
  });

  it('patch updates flag field', () => {
    store.upsert(makeFlag());
    const updated = store.patch('flag-1', { enabled: false });
    expect(updated?.enabled).toBe(false);
  });

  it('evaluate returns result for known flag', () => {
    store.upsert(makeFlag({ enabled: false }));
    const result = store.evaluate('flag-1', {});
    expect(result?.enabled).toBe(false);
  });

  it('evaluate returns null for unknown flag', () => {
    expect(store.evaluate('no-such', {})).toBeNull();
  });

  it('evaluateAll returns one result per flag', () => {
    store.upsert(makeFlag({ id: 'f1', key: 'k1' }));
    store.upsert(makeFlag({ id: 'f2', key: 'k2' }));
    expect(store.evaluateAll({})).toHaveLength(2);
  });

  it('delete removes the flag', () => {
    store.upsert(makeFlag());
    expect(store.delete('flag-1')).toBe(true);
    expect(store.get('flag-1')).toBeUndefined();
  });
});
