import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { portalIdentityStore } from '../../../modules/portal-identity/portal-identity-store.js';
import { requirePortalPermission } from '../../../middleware/portal-auth.js';

export function registerPortalAuditRoutes(router: { get: Function }): void {
  router.get(
    '/api/v1/portal/audit-log',
    requirePortalPermission('audit.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const limit = ctx.query.get('limit');
      const entries = portalIdentityStore.getAuditLog(ctx.portalOrganizationId as string, {
        limit: limit ? parseInt(limit, 10) : undefined,
      });
      json(res, { total: entries.length, entries });
    })
  );
}
