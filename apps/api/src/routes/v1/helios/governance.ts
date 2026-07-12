import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { heliosStore } from '../../../modules/helios/helios-store.js';
import { tenantOf } from './util.js';

export function registerEventGovernanceRoutes(router: { get: Function }): void {
  router.get('/api/v1/helios/governance', (ctx: RouteContext, res: ServerResponse) => {
    const classification = ctx.query.get('classification') ?? undefined;
    const criticality = ctx.query.get('criticality') ?? undefined;
    const tenantId = tenantOf(ctx);
    const policies = heliosStore.getGovernancePolicies({ classification, criticality, tenantId });
    json(res, { policies, total: policies.length });
  });
}
