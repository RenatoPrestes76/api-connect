import type {
  FeatureFlag,
  FlagVariant,
  TargetingRule,
  FlagEvaluationContext,
  FlagEvaluationResult,
} from './types.js';

// Stable, hash-based bucket assignment so the same entity always lands in the same bucket.
function hashBucket(seed: string, buckets: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) >>> 0;
  }
  return h % buckets;
}

function matchesRule(rule: TargetingRule, ctx: FlagEvaluationContext): boolean {
  const attrValue = ctx[rule.attribute];
  if (attrValue === undefined) return false;
  switch (rule.operator) {
    case 'eq':
      return attrValue === rule.values[0];
    case 'neq':
      return attrValue !== rule.values[0];
    case 'in':
      return rule.values.includes(attrValue);
    case 'notIn':
      return !rule.values.includes(attrValue);
    case 'contains':
      return rule.values.some((v) => attrValue.includes(v));
    default:
      return false;
  }
}

function selectVariant(flag: FeatureFlag, ctx: FlagEvaluationContext): string {
  if (flag.variants.length === 0) return flag.defaultVariant;
  // bucket 0-99 based on flag key + context key
  const entityKey = ctx.tenantId ?? ctx.userId ?? 'anonymous';
  const bucket = hashBucket(`${flag.key}:${entityKey}`, 100);
  let cumulative = 0;
  for (const variant of flag.variants) {
    cumulative += variant.weight;
    if (bucket < cumulative) return variant.key;
  }
  return flag.defaultVariant;
}

export function evaluateFlag(flag: FeatureFlag, ctx: FlagEvaluationContext): FlagEvaluationResult {
  if (!flag.enabled) {
    return {
      flagId: flag.id,
      flagKey: flag.key,
      enabled: false,
      variant: flag.defaultVariant,
      reason: 'disabled',
    };
  }

  // Targeting rules take precedence
  for (const rule of flag.targetingRules) {
    if (matchesRule(rule, ctx)) {
      return {
        flagId: flag.id,
        flagKey: flag.key,
        enabled: true,
        variant: rule.variant,
        reason: 'targeting_match',
      };
    }
  }

  // Percentage rollout
  const entityKey = ctx.tenantId ?? ctx.userId ?? 'anonymous';
  const bucket = hashBucket(`${flag.key}:${entityKey}`, 100);
  if (bucket >= flag.rolloutPercentage) {
    return {
      flagId: flag.id,
      flagKey: flag.key,
      enabled: false,
      variant: flag.defaultVariant,
      reason: 'rollout',
    };
  }

  return {
    flagId: flag.id,
    flagKey: flag.key,
    enabled: true,
    variant: selectVariant(flag, ctx),
    reason: 'default',
  };
}

export class FeatureFlagStore {
  private flags = new Map<string, FeatureFlag>();

  upsert(flag: FeatureFlag): void {
    this.flags.set(flag.id, { ...flag, updatedAt: new Date().toISOString() });
  }

  get(id: string): FeatureFlag | undefined {
    return this.flags.get(id);
  }

  getByKey(key: string): FeatureFlag | undefined {
    return [...this.flags.values()].find((f) => f.key === key);
  }

  list(): FeatureFlag[] {
    return [...this.flags.values()];
  }

  delete(id: string): boolean {
    return this.flags.delete(id);
  }

  evaluate(flagId: string, ctx: FlagEvaluationContext): FlagEvaluationResult | null {
    const flag = this.flags.get(flagId) ?? [...this.flags.values()].find((f) => f.key === flagId);
    if (!flag) return null;
    return evaluateFlag(flag, ctx);
  }

  evaluateAll(ctx: FlagEvaluationContext): FlagEvaluationResult[] {
    return [...this.flags.values()].map((f) => evaluateFlag(f, ctx));
  }

  patch(id: string, updates: Partial<FeatureFlag>): FeatureFlag | null {
    const flag = this.flags.get(id);
    if (!flag) return null;
    const updated = { ...flag, ...updates, id: flag.id, updatedAt: new Date().toISOString() };
    this.flags.set(id, updated);
    return updated;
  }
}

export const featureFlagStore = new FeatureFlagStore();
