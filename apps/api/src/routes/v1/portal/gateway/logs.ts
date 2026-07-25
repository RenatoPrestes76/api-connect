import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../../http/router.js';
import { json } from '../../../../http/router.js';
import { gatewayStore } from '../../../../modules/gateway/gateway-store.js';
import { requirePortalPermission } from '../../../../middleware/portal-auth.js';

export function registerGatewayLogRoutes(router: { get: Function }): void {
  router.get(
    '/api/v1/portal/gateway/logs',
    requirePortalPermission('api-logs.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const limit = ctx.query.get('limit');
      const entries = gatewayStore.listLogs(ctx.portalOrganizationId as string, {
        limit: limit ? parseInt(limit, 10) : 100,
      });
      json(res, { total: entries.length, entries });
    })
  );
}
