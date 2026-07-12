import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { regionsStore } from '../../../modules/regions/regions-store.js';
import type { ReplicationStatus } from '../../../modules/regions/types.js';

export function registerGlobalRoutes(router: { get: Function }): void {
  // GET /api/v1/global/overview
  router.get('/api/v1/global/overview', (_ctx: RouteContext, res: ServerResponse) => {
    json(res, regionsStore.getGlobalOverview());
  });

  // GET /api/v1/global/replication
  router.get('/api/v1/global/replication', (ctx: RouteContext, res: ServerResponse) => {
    const sourceRegion = ctx.query.get('sourceRegion') ?? undefined;
    const targetRegion = ctx.query.get('targetRegion') ?? undefined;
    const status = ctx.query.get('status') ?? undefined;

    const records = regionsStore.getReplicationRecords(
      sourceRegion,
      targetRegion,
      status as ReplicationStatus | undefined
    );

    const summary = regionsStore.getReplicationSummary();

    json(res, {
      ...summary,
      filtered: !!(sourceRegion || targetRegion || status),
      records,
    });
  });

  // GET /api/v1/global/events
  router.get('/api/v1/global/events', (ctx: RouteContext, res: ServerResponse) => {
    const limit = Math.min(parseInt(ctx.query.get('limit') ?? '50', 10), 200);
    const events = regionsStore.getGlobalEvents(limit);
    json(res, { total: events.length, events });
  });
}
