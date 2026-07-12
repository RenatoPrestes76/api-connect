import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { requirePermission } from '../../../middleware/admin-auth.js';

/**
 * GET /admin/fleet/audit — alias over the existing admin audit log (see
 * modules/admin-identity), presented under the fleet namespace for the Audit
 * Timeline UI. Not a separate AuditTimeline model/store — one audit trail.
 */
export function registerFleetAuditRoutes(router: { get: Function }): void {
  router.get(
    '/admin/fleet/audit',
    requirePermission('audit.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const limit = ctx.query.get('limit') ? Number(ctx.query.get('limit')) : 100;
      const entries = adminIdentityStore.getAuditLog({
        limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 100,
      });
      json(res, { entries, total: entries.length });
    })
  );
}
