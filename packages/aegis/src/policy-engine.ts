import type {
  Policy,
  PolicyCondition,
  PolicyContext,
  PolicyDecision,
  ConditionOperator,
} from './types.js';

// ─── Condition evaluation ─────────────────────────────────────────────────────

export function evaluateCondition(cond: PolicyCondition, ctx: PolicyContext): boolean {
  const ctxValue = ctx[cond.attribute];
  if (ctxValue === undefined || ctxValue === null) return false;

  switch (cond.operator as ConditionOperator) {
    case 'eq':
      return String(ctxValue) === String(cond.value);
    case 'neq':
      return String(ctxValue) !== String(cond.value);
    case 'in':
      return Array.isArray(cond.value) && cond.value.map(String).includes(String(ctxValue));
    case 'notIn':
      return Array.isArray(cond.value) && !cond.value.map(String).includes(String(ctxValue));
    case 'gt':
      return Number(ctxValue) > Number(cond.value);
    case 'lt':
      return Number(ctxValue) < Number(cond.value);
    case 'between': {
      const [lo, hi] = Array.isArray(cond.value) ? cond.value.map(Number) : [0, 0];
      const n = Number(ctxValue);
      return n >= lo && n <= hi;
    }
    case 'matches':
      try {
        return new RegExp(String(cond.value)).test(String(ctxValue));
      } catch {
        return false;
      }
    default:
      return false;
  }
}

// ─── Policy evaluation ────────────────────────────────────────────────────────

/** Returns true if ALL (AND) or ANY (OR) conditions match the context. */
export function evaluatePolicy(policy: Policy, ctx: PolicyContext): boolean {
  if (!policy.active) return false;
  if (policy.conditions.length === 0) return true;
  const results = policy.conditions.map((c) => evaluateCondition(c, ctx));
  return policy.logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
}

/**
 * Evaluates all active policies sorted by priority (highest first).
 * First matching policy wins. If none match → DEFAULT_DENY.
 * DENY policies at higher priority can block ALLOW policies below.
 */
export function evaluatePolicies(policies: Policy[], ctx: PolicyContext): PolicyDecision {
  const active = policies.filter((p) => p.active).sort((a, b) => b.priority - a.priority);
  for (const policy of active) {
    if (evaluatePolicy(policy, ctx)) {
      return policy.effect;
    }
  }
  return 'DEFAULT_DENY';
}

/**
 * Evaluates policies and returns a detailed audit record.
 */
export interface PolicyEvaluationResult {
  decision: PolicyDecision;
  matchedPolicy: Pick<Policy, 'id' | 'name' | 'effect' | 'priority'> | null;
  evaluatedCount: number;
  context: PolicyContext;
}

export function evaluatePoliciesWithAudit(
  policies: Policy[],
  ctx: PolicyContext
): PolicyEvaluationResult {
  const active = policies.filter((p) => p.active).sort((a, b) => b.priority - a.priority);
  for (const policy of active) {
    if (evaluatePolicy(policy, ctx)) {
      return {
        decision: policy.effect,
        matchedPolicy: {
          id: policy.id,
          name: policy.name,
          effect: policy.effect,
          priority: policy.priority,
        },
        evaluatedCount: active.length,
        context: ctx,
      };
    }
  }
  return {
    decision: 'DEFAULT_DENY',
    matchedPolicy: null,
    evaluatedCount: active.length,
    context: ctx,
  };
}
