import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { operationsStore } from '../../../modules/operations/operations-store.js';

export function registerOperationsMetricsRoute(router: { get: Function }): void {
  router.get('/api/v1/operations/metrics', (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = ctx.query.get('tenantId') ?? undefined;

    if (tenantId) {
      const tenant = operationsStore.getTenant(tenantId);
      if (!tenant) return apiError(res, 'Tenant not found', 404, 'NOT_FOUND');
      const metrics = operationsStore.getMetrics(tenantId);
      json(res, { tenantId, tenantName: tenant.name, total: metrics.length, metrics });
      return;
    }

    const allMetrics = operationsStore.getMetrics();
    const byTenant: Record<string, unknown> = {};
    for (const t of operationsStore.getTenants()) {
      const tm = allMetrics.filter((m) => m.tenantId === t.tenantId);
      byTenant[t.tenantId] = { tenantName: t.name, total: tm.length, metrics: tm };
    }
    json(res, { total: allMetrics.length, tenants: byTenant });
  });
}
