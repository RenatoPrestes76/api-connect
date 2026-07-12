import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { securityStore } from '../../../modules/security/security-store.js';
import { evaluatePoliciesWithAudit } from '@seltriva/aegis';
import type { PolicyContext } from '@seltriva/aegis';

function resolveTenant(ctx: RouteContext): string {
  return (ctx.headers['x-tenant-id'] as string) || ctx.query.get('tenantId') || 'tenant-enterprise';
}

export function registerPoliciesRoutes(router: {
  get: Function;
  post: Function;
  put: Function;
  delete: Function;
}): void {
  // GET /api/v1/security/policies
  router.get('/api/v1/security/policies', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = resolveTenant(ctx);
    const policies = securityStore.getPolicies(tenantId);
    json(res, { policies, total: policies.length });
  });

  // GET /api/v1/security/policies/:id
  router.get('/api/v1/security/policies/:id', async (ctx: RouteContext, res: ServerResponse) => {
    const policy = securityStore.getPolicyById(ctx.params['id']!);
    if (!policy) return apiError(res, 'Policy not found', 404);
    json(res, { policy });
  });

  // POST /api/v1/security/policies/evaluate  — must be registered BEFORE /:id
  router.post(
    '/api/v1/security/policies/evaluate',
    async (ctx: RouteContext, res: ServerResponse) => {
      const tenantId = resolveTenant(ctx);
      const body = ctx.body as Record<string, unknown>;
      const rawContext = (body?.['context'] as Record<string, string | number | undefined>) || {};
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
    const tenantId = resolveTenant(ctx);
    const body = ctx.body as Record<string, unknown>;
    const { name, description, conditions, logic, effect, priority, active } = body ?? ({} as any);
    if (!name || !effect || !logic) return apiError(res, 'name, effect, logic required', 400);
    const policy = securityStore.createPolicy({
      name: name as string,
      description: (description as string) || '',
      conditions: (conditions as any[]) || [],
      logic: (logic as 'AND' | 'OR') || 'AND',
      effect: effect as 'ALLOW' | 'DENY',
      priority: (priority as number) ?? 50,
      active: (active as boolean) ?? true,
      tenantId,
    });
    json(res, { policy }, 201);
  });

  // PUT /api/v1/security/policies/:id
  router.put('/api/v1/security/policies/:id', async (ctx: RouteContext, res: ServerResponse) => {
    const policy = securityStore.updatePolicy(ctx.params['id']!, ctx.body as any);
    if (!policy) return apiError(res, 'Policy not found', 404);
    json(res, { policy });
  });

  // DELETE /api/v1/security/policies/:id
  router.delete('/api/v1/security/policies/:id', async (ctx: RouteContext, res: ServerResponse) => {
    const ok = securityStore.deletePolicy(ctx.params['id']!);
    if (!ok) return apiError(res, 'Policy not found', 404);
    json(res, { deleted: true });
  });
}
