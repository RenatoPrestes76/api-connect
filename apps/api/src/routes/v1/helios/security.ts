import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { heliosStore } from '../../../modules/helios/helios-store.js';
import { tenantOf } from './util.js';

export function registerEventSecurityRoutes(router: { get: Function }): void {
  router.get('/api/v1/helios/security/policies', (ctx: RouteContext, res: ServerResponse) => {
    const topicId = ctx.query.get('topicId') ?? undefined;
    const tenantId = tenantOf(ctx);
    const policies = heliosStore.getSecurityPolicies({ topicId, tenantId });
    json(res, { policies, total: policies.length });
  });

  router.get('/api/v1/helios/security/audit', (ctx: RouteContext, res: ServerResponse) => {
    const topicId = ctx.query.get('topicId') ?? undefined;
    const result = ctx.query.get('result') ?? undefined;
    const tenantId = tenantOf(ctx);
    const entries = heliosStore.getSecurityAudit({ topicId, result, tenantId });
    json(res, { entries, total: entries.length });
  });
}
