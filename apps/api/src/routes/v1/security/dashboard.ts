import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { requireTenantId } from '../../../http/tenant.js';
import { securityStore } from '../../../modules/security/security-store.js';

export function registerDashboardRoutes(router: { get: Function }): void {
  // GET /api/v1/security/dashboard
  router.get('/api/v1/security/dashboard', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireTenantId(ctx);
    const dashboard = securityStore.getDashboard(tenantId);
    json(res, dashboard);
  });
}
