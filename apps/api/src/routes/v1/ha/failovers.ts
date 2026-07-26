import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { haStore } from '../../../modules/ha/ha-store.js';
import { failoverEngine } from '../../../modules/ha/failover-engine.js';

interface TriggerFailoverBody {
  fromNodeId?: string;
  toNodeId?: string;
  reason?: string;
}

export function registerHaFailoverRoutes(router: Router): void {
  router.get('/api/v1/ha/failovers', async (ctx: RouteContext, res: ServerResponse) => {
    const limit = Math.min(parseInt(ctx.query.get('limit') ?? '50', 10), 200);
    const events = haStore.getFailoverEvents(limit);
    json(res, { total: events.length, events });
  });

  router.post('/api/v1/ha/failover', async (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as TriggerFailoverBody | undefined) ?? {};
    const { fromNodeId, toNodeId, reason = 'Manual failover initiated by admin' } = body;

    if (!fromNodeId) return apiError(res, '"fromNodeId" is required', 400, 'MISSING_FIELDS');
    if (!toNodeId) return apiError(res, '"toNodeId" is required', 400, 'MISSING_FIELDS');

    try {
      const result = failoverEngine.triggerFailover(fromNodeId, toNodeId, reason, false);
      json(res, result);
    } catch (err) {
      const code = (err as { code?: string }).code ?? 'FAILOVER_ERROR';
      if (code === 'SOURCE_NODE_NOT_FOUND')
        return apiError(res, 'Source node not found', 404, 'NOT_FOUND');
      if (code === 'TARGET_NODE_NOT_FOUND')
        return apiError(res, 'Target node not found', 404, 'NOT_FOUND');
      return apiError(res, (err as Error).message, 500, 'FAILOVER_ERROR');
    }
  });
}
