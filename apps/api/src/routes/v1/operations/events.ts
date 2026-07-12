import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { operationsStore } from '../../../modules/operations/operations-store.js';

export function registerOperationsEventsRoute(router: { get: Function }): void {
  router.get('/api/v1/operations/events', (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = ctx.query.get('tenantId') ?? undefined;
    const limit = Math.min(parseInt(ctx.query.get('limit') ?? '50', 10), 200);

    const events = operationsStore.getEvents(tenantId, limit);
    json(res, { total: events.length, events });
  });
}
