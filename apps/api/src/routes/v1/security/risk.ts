import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireTenantId } from '../../../http/tenant.js';
import { securityStore } from '../../../modules/security/security-store.js';
import type { RiskType, RiskLevel } from '@seltriva/aegis';

export function registerRiskRoutes(router: { get: Function; post: Function }): void {
  // GET /api/v1/security/risk
  router.get('/api/v1/security/risk', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireTenantId(ctx);
    const resolved = ctx.query.get('resolved');
    let events = securityStore.getRiskEvents(tenantId);
    if (resolved === 'false') events = events.filter((e) => !e.resolved);
    if (resolved === 'true') events = events.filter((e) => e.resolved);
    json(res, { events, total: events.length });
  });

  // GET /api/v1/security/risk/score/:tenantId  — register BEFORE /risk/:id/resolve
  router.get(
    '/api/v1/security/risk/score/:tenantId',
    async (ctx: RouteContext, res: ServerResponse) => {
      const score = securityStore.computeRiskScore(ctx.params['tenantId']!);
      json(res, score);
    }
  );

  // POST /api/v1/security/risk/assess
  router.post('/api/v1/security/risk/assess', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireTenantId(ctx);
    const body = (ctx.body ?? {}) as Record<string, unknown>;
    const type = body['type'] as RiskType | undefined;
    const actor = body['actor'] as string | undefined;
    const level = body['level'] as RiskLevel | undefined;
    const score = body['score'] as number | undefined;
    const description = body['description'] as string | undefined;
    const ip = body['ip'] as string | undefined;
    const country = (body['country'] as string | undefined) ?? null;
    if (!type || !actor || !level || score === undefined || !description || !ip) {
      return apiError(res, 'type, actor, level, score, description, ip required', 400);
    }
    const event = securityStore.createRiskEvent({
      type,
      actor,
      level,
      score,
      description,
      ip,
      country,
      tenantId,
      resolved: false,
    });
    json(res, { event }, 201);
  });

  // POST /api/v1/security/risk/:id/resolve
  router.post(
    '/api/v1/security/risk/:id/resolve',
    async (ctx: RouteContext, res: ServerResponse) => {
      const event = securityStore.resolveRiskEvent(ctx.params['id']!);
      if (!event) return apiError(res, 'Risk event not found', 404);
      json(res, { event });
    }
  );
}
