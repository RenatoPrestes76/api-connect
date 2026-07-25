import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json } from '../../../http/router.js';
import { requireTenantId } from '../../../http/tenant.js';
import { portalStore } from '../../../modules/portal/portal-store.js';
import { portalIdentityStore } from '../../../modules/portal-identity/portal-identity-store.js';

export function registerPortalDashboardRoutes(router: { get: Function; post: Function }): void {
  router.get('/api/v1/portal/dashboard', (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireTenantId(ctx);
    json(res, {
      ...portalStore.getDashboard(tenantId),
      // Sprint 46.4 — organization/environments/users summary cards. `tenantId`
      // here doubles as the organizationId once the caller is a real,
      // logged-in portal session (see usePortalSession on the frontend).
      organizationSummary: portalIdentityStore.getDashboardSummary(tenantId),
    });
  });

  router.post(
    '/api/v1/portal/onboarding/complete-step',
    (ctx: RouteContext, res: ServerResponse) => {
      const { step } = (ctx.body as any) ?? {};
      if (!step) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 'MISSING_STEP', message: '"step" is required' } }));
        return;
      }
      const progress = portalStore.completeStep(requireTenantId(ctx), step);
      if (!progress) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: { code: 'NOT_FOUND', message: 'Onboarding not found for tenant' },
          })
        );
        return;
      }
      json(res, { progress });
    }
  );
}
