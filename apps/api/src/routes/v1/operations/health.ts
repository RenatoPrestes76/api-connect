import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { healthEngine } from '../../../modules/operations/health-engine.js';

export function registerOperationsHealthRoute(router: { get: Function }): void {
  router.get('/api/v1/operations/health', (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = ctx.query.get('tenantId') ?? undefined;

    if (tenantId) {
      const health = healthEngine.getTenantHealth(tenantId);
      if (!health) return apiError(res, 'Tenant not found', 404, 'NOT_FOUND');
      json(res, { total: 1, tenants: [health] });
      return;
    }

    const tenants = healthEngine.getAllTenantHealth();
    const counts = { healthy: 0, warning: 0, critical: 0, offline: 0 };
    for (const t of tenants) {
      counts[t.overallStatus]++;
    }

    json(res, { total: tenants.length, ...counts, tenants });
  });
}
