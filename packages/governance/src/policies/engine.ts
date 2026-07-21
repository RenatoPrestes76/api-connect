/**
 * PolicyEngineImpl — OPA-inspired policy evaluation engine.
 *
 * Evaluation pipeline:
 *   1. Load applicable policies for (subject, resource, action)
 *   2. Sort rules by priority (descending)
 *   3. Evaluate conditions (attribute paths + operator comparisons)
 *   4. Collect per-rule decisions
 *   5. Apply conflict resolution strategy
 *   6. Aggregate obligations from applicable allow rules
 *
 * Attribute paths are dot-notation references resolved against the evaluation
 * request object: "subject.roles", "resource.attributes.tier", "context.environment"
 */
import type {
  IPolicyEngine,
  Policy,
  PolicyId,
  PolicyScope,
  PolicyEvaluationRequest,
  PolicyEvaluationResult,
  PolicyDecision,
  PolicyCondition,
  PolicyRule,
  PolicyObligation,
  ApplicablePolicyResult,
  ConflictResolution,
} from './index.js';

// ─── Attribute Path Resolver ─────────────────────────────────────────────────

function resolvePath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let cursor: unknown = obj;
  for (const part of parts) {
    if (cursor === null || cursor === undefined) return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

function resolveRequestAttribute(request: PolicyEvaluationRequest, attribute: string): unknown {
  // Supports: subject.*, resource.*, context.*, action
  if (attribute === 'action') return request.action;
  return resolvePath(request, attribute);
}

// ─── Condition Evaluator ─────────────────────────────────────────────────────

function evaluateCondition(condition: PolicyCondition, request: PolicyEvaluationRequest): boolean {
  const raw = resolveRequestAttribute(request, condition.attribute);
  const { operator, value, negate = false } = condition;

  let result: boolean;

  switch (operator) {
    case 'exists':
      result = raw !== undefined && raw !== null;
      break;

    case 'not-exists':
      result = raw === undefined || raw === null;
      break;

    case 'eq':
      result = raw === value;
      break;

    case 'neq':
      result = raw !== value;
      break;

    case 'in':
      if (!Array.isArray(value)) {
        result = false;
        break;
      }
      result = value.includes(raw);
      break;

    case 'not-in':
      if (!Array.isArray(value)) {
        result = true;
        break;
      }
      result = !value.includes(raw);
      break;

    case 'contains':
      if (Array.isArray(raw)) {
        result = raw.includes(value);
      } else if (typeof raw === 'string' && typeof value === 'string') {
        result = raw.includes(value);
      } else {
        result = false;
      }
      break;

    case 'starts-with':
      result = typeof raw === 'string' && typeof value === 'string' && raw.startsWith(value);
      break;

    case 'ends-with':
      result = typeof raw === 'string' && typeof value === 'string' && raw.endsWith(value);
      break;

    case 'matches':
      try {
        result = typeof raw === 'string' && new RegExp(String(value)).test(raw);
      } catch {
        result = false;
      }
      break;

    case 'gt':
      result = typeof raw === 'number' && typeof value === 'number' && raw > value;
      break;

    case 'gte':
      result = typeof raw === 'number' && typeof value === 'number' && raw >= value;
      break;

    case 'lt':
      result = typeof raw === 'number' && typeof value === 'number' && raw < value;
      break;

    case 'lte':
      result = typeof raw === 'number' && typeof value === 'number' && raw <= value;
      break;

    default:
      result = false;
  }

  return negate ? !result : result;
}

function evaluateConditions(
  conditions: PolicyCondition[] | undefined,
  request: PolicyEvaluationRequest
): { matched: boolean; matchedPaths: string[] } {
  if (!conditions || conditions.length === 0) {
    return { matched: true, matchedPaths: [] };
  }

  const matchedPaths: string[] = [];
  for (const cond of conditions) {
    if (!evaluateCondition(cond, request)) {
      return { matched: false, matchedPaths };
    }
    matchedPaths.push(`${cond.attribute} ${cond.operator} ${JSON.stringify(cond.value)}`);
  }
  return { matched: true, matchedPaths };
}

// ─── Rule Evaluator ──────────────────────────────────────────────────────────

interface RuleEvaluation {
  rule: PolicyRule;
  decision: PolicyDecision;
  matchedConditions: string[];
}

function evaluateRule(rule: PolicyRule, request: PolicyEvaluationRequest): RuleEvaluation {
  // Check action match
  const actions = rule.actions ?? ['*'];
  const actionMatched = actions.includes('*') || actions.includes(request.action);
  if (!actionMatched) {
    return { rule, decision: 'not-applicable', matchedConditions: [] };
  }

  // Evaluate subject conditions
  const subjectResult = evaluateConditions(rule.subjects, request);
  if (!subjectResult.matched) {
    return { rule, decision: 'not-applicable', matchedConditions: [] };
  }

  // Evaluate resource conditions
  const resourceResult = evaluateConditions(rule.resources, request);
  if (!resourceResult.matched) {
    return { rule, decision: 'not-applicable', matchedConditions: [] };
  }

  // Evaluate environmental conditions
  const envResult = evaluateConditions(rule.conditions, request);
  if (!envResult.matched) {
    return { rule, decision: 'not-applicable', matchedConditions: [] };
  }

  const matchedConditions = [
    ...subjectResult.matchedPaths,
    ...resourceResult.matchedPaths,
    ...envResult.matchedPaths,
  ];

  return {
    rule,
    decision: rule.effect === 'allow' ? 'allow' : 'deny',
    matchedConditions,
  };
}

// ─── Conflict Resolution ─────────────────────────────────────────────────────

function applyConflictResolution(
  evaluations: RuleEvaluation[],
  strategy: ConflictResolution
): PolicyDecision {
  const applicable = evaluations.filter((e) => e.decision !== 'not-applicable');
  if (applicable.length === 0) return 'not-applicable';

  switch (strategy) {
    case 'deny-overrides': {
      if (applicable.some((e) => e.decision === 'deny')) return 'deny';
      if (applicable.some((e) => e.decision === 'allow')) return 'allow';
      return 'not-applicable';
    }

    case 'allow-overrides': {
      if (applicable.some((e) => e.decision === 'allow')) return 'allow';
      if (applicable.some((e) => e.decision === 'deny')) return 'deny';
      return 'not-applicable';
    }

    case 'first-applicable': {
      const first = applicable[0];
      return first ? first.decision : 'not-applicable';
    }

    case 'only-one': {
      const [only] = applicable;
      if (applicable.length === 1 && only) return only.decision;
      return 'indeterminate';
    }

    default:
      return 'deny';
  }
}

// ─── PolicyEngineImpl ────────────────────────────────────────────────────────

export class PolicyEngineImpl implements IPolicyEngine {
  private _policies = new Map<string, Policy>();

  /**
   * Register a policy directly (used instead of repository in tests/dev).
   */
  register(policy: Policy): void {
    this._policies.set(policy.id, policy);
  }

  unregister(id: PolicyId): void {
    this._policies.delete(id);
  }

  async findApplicable(scope: PolicyScope, action?: string): Promise<Policy[]> {
    const results: Policy[] = [];

    for (const policy of this._policies.values()) {
      if (!policy.enabled) continue;
      if (!policyMatchesScope(policy.scope, scope)) continue;
      if (action && !policyCoversAction(policy, action)) continue;
      results.push(policy);
    }

    return results;
  }

  async evaluate(request: PolicyEvaluationRequest): Promise<PolicyEvaluationResult> {
    const start = Date.now();
    const requestId = request.requestId ?? generateId();

    const scope: PolicyScope = {
      organizationId: request.resource.organizationId,
      workspaceId: request.resource.workspaceId,
      environmentId: request.resource.environmentId,
      resourceTypes: [request.resource.type],
    };

    const applicablePolicies = await this.findApplicable(scope, request.action);

    if (applicablePolicies.length === 0) {
      return {
        requestId,
        decision: 'not-applicable',
        applicablePolicies: [],
        obligations: [],
        evaluatedAt: new Date(),
        durationMs: Date.now() - start,
        reason: 'No applicable policies found',
      };
    }

    const applicableResults: ApplicablePolicyResult[] = [];
    const obligations: PolicyObligation[] = [];
    const policyDecisions: PolicyDecision[] = [];

    for (const policy of applicablePolicies) {
      // Sort rules by priority descending
      const sortedRules = [...policy.rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

      const ruleEvaluations = sortedRules.map((rule) => evaluateRule(rule, request));

      const policyDecision = applyConflictResolution(ruleEvaluations, policy.conflictResolution);

      policyDecisions.push(policyDecision);

      // Collect matching rule info for audit
      const matchingRule = ruleEvaluations.find((e) => e.decision !== 'not-applicable');
      applicableResults.push({
        policyId: policy.id,
        policyName: policy.name,
        ruleId: matchingRule?.rule.id,
        decision: policyDecision,
        matchedConditions: matchingRule?.matchedConditions ?? [],
      });

      // Collect obligations from allow rules
      if (policyDecision === 'allow') {
        for (const ev of ruleEvaluations) {
          if (ev.decision === 'allow' && ev.rule.obligations) {
            obligations.push(...ev.rule.obligations);
          }
        }
      }
    }

    // Aggregate across policies: deny-overrides is the cross-policy default
    let finalDecision: PolicyDecision;
    if (policyDecisions.some((d) => d === 'deny')) {
      finalDecision = 'deny';
    } else if (policyDecisions.some((d) => d === 'allow')) {
      finalDecision = 'allow';
    } else if (policyDecisions.some((d) => d === 'indeterminate')) {
      finalDecision = 'indeterminate';
    } else {
      finalDecision = 'not-applicable';
    }

    return {
      requestId,
      decision: finalDecision,
      applicablePolicies: applicableResults,
      obligations: finalDecision === 'allow' ? obligations : [],
      evaluatedAt: new Date(),
      durationMs: Date.now() - start,
      reason: buildReason(finalDecision, applicableResults),
    };
  }

  async enforce(request: PolicyEvaluationRequest): Promise<void> {
    const result = await this.evaluate(request);
    if (result.decision === 'deny') {
      throw new GovernancePolicyError(
        `Access denied: ${result.reason ?? 'policy evaluation returned deny'}`,
        result
      );
    }
    if (result.decision === 'indeterminate') {
      throw new GovernancePolicyError(`Access indeterminate: ambiguous policy result`, result);
    }
    // 'not-applicable' and 'allow' pass through
  }

  async evaluateBatch(requests: PolicyEvaluationRequest[]): Promise<PolicyEvaluationResult[]> {
    return Promise.all(requests.map((req) => this.evaluate(req)));
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function policyMatchesScope(policyScope: PolicyScope, requestScope: PolicyScope): boolean {
  // Platform-wide policies have no organizationId — they always apply
  if (
    policyScope.organizationId !== undefined &&
    policyScope.organizationId !== requestScope.organizationId
  ) {
    return false;
  }

  if (
    policyScope.workspaceId !== undefined &&
    policyScope.workspaceId !== requestScope.workspaceId
  ) {
    return false;
  }

  if (
    policyScope.environmentId !== undefined &&
    policyScope.environmentId !== requestScope.environmentId
  ) {
    return false;
  }

  if (policyScope.resourceTypes && policyScope.resourceTypes.length > 0) {
    const resourceTypes = policyScope.resourceTypes;
    const covers =
      resourceTypes.includes('*') ||
      requestScope.resourceTypes?.some((rt) => resourceTypes.includes(rt));
    if (!covers) return false;
  }

  return true;
}

function policyCoversAction(policy: Policy, action: string): boolean {
  return policy.rules.some((rule) => {
    const actions = rule.actions ?? ['*'];
    return actions.includes('*') || actions.includes(action);
  });
}

function buildReason(decision: PolicyDecision, results: ApplicablePolicyResult[]): string {
  if (decision === 'not-applicable') return 'No policy matched';

  const decisive = results.find((r) => r.decision === decision);
  if (!decisive) return decision;

  const conditions =
    decisive.matchedConditions.length > 0
      ? ` (${decisive.matchedConditions.slice(0, 2).join(', ')})`
      : '';

  return `${decision} by policy "${decisive.policyName}"${conditions}`;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Error Class ─────────────────────────────────────────────────────────────

export class GovernancePolicyError extends Error {
  readonly result: PolicyEvaluationResult;

  constructor(message: string, result: PolicyEvaluationResult) {
    super(message);
    this.name = 'GovernancePolicyError';
    this.result = result;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createPolicyEngine(): PolicyEngineImpl {
  return new PolicyEngineImpl();
}

export type { RuleEvaluation };
