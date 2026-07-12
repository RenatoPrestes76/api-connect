import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { heliosStore } from '../../../modules/helios/helios-store.js';
import { tenantOf } from './util.js';

export function registerAnalyticsRoutes(router: { get: Function }): void {
  router.get('/api/v1/helios/analytics/stream', (_ctx: RouteContext, res: ServerResponse) => {
    json(res, heliosStore.getStreamMetrics());
  });

  router.get('/api/v1/helios/analytics/topics', (ctx: RouteContext, res: ServerResponse) => {
    const metrics = heliosStore.getTopicMetrics(tenantOf(ctx));
    json(res, { metrics, total: metrics.length });
  });
}
