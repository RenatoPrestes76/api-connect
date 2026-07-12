import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { prometheusStore } from '../../../modules/prometheus/prometheus-store.js';
import { tenantOf } from './util.js';

export function registerSLORoutes(router: { get: Function }): void {
  router.get('/api/v1/prometheus/slo', (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = tenantOf(ctx);
    const status = ctx.query.get('status') ?? undefined;
    const targets = prometheusStore.getSLOTargets({ tenantId, status });
    json(res, { targets, total: targets.length });
  });
}
