import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { heliosStore } from '../../../modules/helios/helios-store.js';
import { tenantOf, assertTenantAccess } from './util.js';

export function registerDLQRoutes(router: { get: Function; post: Function }): void {
  router.get('/api/v1/helios/dlq', (ctx: RouteContext, res: ServerResponse) => {
    const status = ctx.query.get('status') ?? undefined;
    const tenantId = tenantOf(ctx);
    const entries = heliosStore.getDLQEntries({ status, tenantId });
    json(res, { entries, total: entries.length });
  });

  router.post('/api/v1/helios/dlq/:id/requeue', (ctx: RouteContext, res: ServerResponse) => {
    const id = ctx.params?.id as string;
    const entries = heliosStore.getDLQEntries();
    const entry = entries.find((e) => e.id === id);
    if (
      !entry ||
      !assertTenantAccess(heliosStore.getTenantIdForTopic(entry.originalTopicId), ctx)
    ) {
      return apiError(res, 'DLQ entry not found', 404, 'DLQ_ENTRY_NOT_FOUND');
    }
    const result = heliosStore.requeueDLQEntry(id);
    if (result === null) return apiError(res, 'DLQ entry not found', 404, 'DLQ_ENTRY_NOT_FOUND');
    if (result === 'ALREADY_RESOLVED')
      return apiError(res, 'Entry is already resolved', 400, 'ALREADY_RESOLVED');
    if (result === 'ALREADY_DISCARDED')
      return apiError(res, 'Entry has been discarded', 400, 'ALREADY_DISCARDED');
    json(res, result);
  });

  router.post('/api/v1/helios/dlq/:id/discard', (ctx: RouteContext, res: ServerResponse) => {
    const id = ctx.params?.id as string;
    const entries = heliosStore.getDLQEntries();
    const entry = entries.find((e) => e.id === id);
    if (
      !entry ||
      !assertTenantAccess(heliosStore.getTenantIdForTopic(entry.originalTopicId), ctx)
    ) {
      return apiError(res, 'DLQ entry not found', 404, 'DLQ_ENTRY_NOT_FOUND');
    }
    const result = heliosStore.discardDLQEntry(id);
    if (result === null) return apiError(res, 'DLQ entry not found', 404, 'DLQ_ENTRY_NOT_FOUND');
    if (result === 'ALREADY_RESOLVED')
      return apiError(res, 'Entry is already resolved', 400, 'ALREADY_RESOLVED');
    if (result === 'ALREADY_DISCARDED')
      return apiError(res, 'Entry is already discarded', 400, 'ALREADY_DISCARDED');
    json(res, result);
  });
}
