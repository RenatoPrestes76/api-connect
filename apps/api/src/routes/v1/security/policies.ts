import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireOrgId } from '../../../http/tenant.js';
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

/**
 * ATLAS 46.26 — GET/PUT/DELETE .../policies/:id previously took the policy
 * id from the URL with no tenant check at all — any authenticated caller
 * could read, weaken (e.g. flip a DENY to ALLOW), or delete another
 * tenant's authorization policy. Fixed the same way as the rest of this
 * module: session-derived org, ownership verified before any read or
 * mutation. A second, related bug was found and fixed in the same pass:
 * security-store.ts's updatePolicy() applied the PATCH body's fields
 * directly with only `id` protected, so a body containing `tenantId`
 * would have silently reassigned the policy to a different tenant even
 * with this route's ownership check in place — now allowlisted at the
 * store layer too (see updatePolicy's own comment).
 */
export function registerPoliciesRoutes(router: Router): void {
  // GET /api/v1/security/policies
  router.get('/api/v1/security/policies', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireOrgId(ctx);
    const policies = securityStore.getPolicies(tenantId);
    json(res, { policies, total: policies.length });
  });

  // GET /api/v1/security/policies/:id
  router.get('/api/v1/security/policies/:id', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireOrgId(ctx);
    const policy = securityStore.getPolicyById(ctx.params['id']);
    if (!policy || policy.tenantId !== tenantId) return apiError(res, 'Policy not found', 404);
    json(res, { policy });
  });

  // POST /api/v1/security/policies/evaluate  — must be registered BEFORE /:id
  router.post(
    '/api/v1/security/policies/evaluate',
    async (ctx: RouteContext, res: ServerResponse) => {
      const tenantId = requireOrgId(ctx);
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
    const tenantId = requireOrgId(ctx);
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
    const tenantId = requireOrgId(ctx);
    const existing = securityStore.getPolicyById(ctx.params['id']);
    if (!existing || existing.tenantId !== tenantId) {
      return apiError(res, 'Policy not found', 404);
    }
    const policy = securityStore.updatePolicy(ctx.params['id'], ctx.body as Partial<Policy>);
    if (!policy) return apiError(res, 'Policy not found', 404);
    json(res, { policy });
  });

  // DELETE /api/v1/security/policies/:id
  router.delete('/api/v1/security/policies/:id', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireOrgId(ctx);
    const existing = securityStore.getPolicyById(ctx.params['id']);
    if (!existing || existing.tenantId !== tenantId) {
      return apiError(res, 'Policy not found', 404);
    }
    const ok = securityStore.deletePolicy(ctx.params['id']);
    if (!ok) return apiError(res, 'Policy not found', 404);
    json(res, { deleted: true });
  });
}
