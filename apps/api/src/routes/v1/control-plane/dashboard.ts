import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { controlPlaneStore } from '../../../modules/control-plane/control-plane-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { requirePermission } from '../../../middleware/admin-auth.js';

export function registerDashboardRoutes(router: { get: Function }): void {
  router.get(
    '/admin/control-plane/dashboard',
    requirePermission('dashboard.view')(async (_ctx: RouteContext, res: ServerResponse) => {
      const summary = controlPlaneStore.getDashboardSummary();
      const recentAudit = adminIdentityStore.getAuditLog({ limit: 10 });
      json(res, { summary, recentAudit });
    })
  );
}
