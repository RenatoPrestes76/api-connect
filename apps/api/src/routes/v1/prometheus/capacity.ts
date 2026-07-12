import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { prometheusStore } from '../../../modules/prometheus/prometheus-store.js';
import { tenantOf } from './util.js';

export function registerCapacityRoutes(router: { get: Function }): void {
  router.get('/api/v1/prometheus/capacity', (_ctx: RouteContext, res: ServerResponse) => {
    json(res, prometheusStore.getCapacityPlan());
  });

  router.get('/api/v1/prometheus/costs', (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = tenantOf(ctx);
    json(res, prometheusStore.getCostReport({ tenantId }));
  });
}
