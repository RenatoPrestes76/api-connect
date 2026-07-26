import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireTenantId } from '../../../http/tenant.js';
import { securityStore } from '../../../modules/security/security-store.js';
import { evaluatePoliciesWithAudit } from '@seltriva/aegis';
import type { PolicyContext, Policy, PolicyCondition } from '@seltriva/aegis';

interface EvaluatePoliciesBody {
  context?: Record<string, string | number | undefined>;
}

interface CreatePolicyBody {
  name?: string;
  description?: string;
  conditions?: PolicyCondition[];
  logic?: 'AND' | 'OR';
  effect?: 'ALLOW' | 'DENY';
  priority?: number;
  active?: boolean;
}

export function registerPoliciesRoutes(router: Router): void {
  // GET /api/v1/security/policies
  router.get('/api/v1/security/policies', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireTenantId(ctx);
    const policies = securityStore.getPolicies(tenantId);
    json(res, { policies, total: policies.length });
  });

  // GET /api/v1/security/policies/:id
  router.get('/api/v1/security/policies/:id', async (ctx: RouteContext, res: ServerResponse) => {
    const policy = securityStore.getPolicyById(ctx.params['id']);
    if (!policy) return apiError(res, 'Policy not found', 404);
    json(res, { policy });
  });

  // POST /api/v1/security/policies/evaluate  — must be registered BEFORE /:id
  router.post(
    '/api/v1/security/policies/evaluate',
    async (ctx: RouteContext, res: ServerResponse) => {
      const tenantId = requireTenantId(ctx);
      const body = ctx.body as EvaluatePoliciesBody | undefined;
      const rawContext = body?.context ?? {};
      const context: PolicyContext = {
        ...rawContext,
        role: String(rawContext['role'] ?? 'unknown'),
      };
      const policies = securityStore.getPolicies(tenantId);
      const result = evaluatePoliciesWithAudit(policies, context);
      json(res, result);
    }
  );

  // POST /api/v1/security/policies
  router.post('/api/v1/security/policies', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireTenantId(ctx);
    const body = (ctx.body as CreatePolicyBody | undefined) ?? {};
    const { name, description, conditions, logic, effect, priority, active } = body;
    if (!name || !effect || !logic) return apiError(res, 'name, effect, logic required', 400);
    const policy = securityStore.createPolicy({
      name,
      description: description ?? '',
      conditions: conditions ?? [],
      logic: logic || 'AND',
      effect,
      priority: priority ?? 50,
      active: active ?? true,
      tenantId,
    });
    json(res, { policy }, 201);
  });

  // PUT /api/v1/security/policies/:id
  router.put('/api/v1/security/policies/:id', async (ctx: RouteContext, res: ServerResponse) => {
    const policy = securityStore.updatePolicy(ctx.params['id'], ctx.body as Partial<Policy>);
    if (!policy) return apiError(res, 'Policy not found', 404);
    json(res, { policy });
  });

  // DELETE /api/v1/security/policies/:id
  router.delete('/api/v1/security/policies/:id', async (ctx: RouteContext, res: ServerResponse) => {
    const ok = securityStore.deletePolicy(ctx.params['id']);
    if (!ok) return apiError(res, 'Policy not found', 404);
    json(res, { deleted: true });
  });
}
