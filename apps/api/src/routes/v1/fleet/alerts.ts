import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { fleetOpsStore } from '../../../modules/fleet-ops/fleet-ops-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { requirePermission } from '../../../middleware/admin-auth.js';

export function registerAlertRoutes(router: { get: Function; post: Function }): void {
  router.get(
    '/admin/fleet/alerts',
    requirePermission('dashboard.view')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.query.get('organizationId') ?? undefined;
      const severity = ctx.query.get('severity') ?? undefined;
      const status = ctx.query.get('status') ?? undefined;
      const type = ctx.query.get('type') ?? undefined;
      const alerts = fleetOpsStore.listAlerts({ organizationId, severity, status, type });
      json(res, { alerts, total: alerts.length });
    })
  );

  router.post(
    '/admin/fleet/alerts/:id/acknowledge',
    requirePermission('dashboard.view')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const alert = fleetOpsStore.acknowledgeAlert(id);
      if (!alert) return apiError(res, 'Alert not found', 404, 'ALERT_NOT_FOUND');
      adminIdentityStore.recordAudit({
        action: 'ACKNOWLEDGE_ALERT',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: id,
      });
      json(res, alert);
    })
  );

  router.post(
    '/admin/fleet/alerts/:id/resolve',
    requirePermission('dashboard.view')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const alert = fleetOpsStore.resolveAlert(id);
      if (!alert) return apiError(res, 'Alert not found', 404, 'ALERT_NOT_FOUND');
      adminIdentityStore.recordAudit({
        action: 'RESOLVE_ALERT',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: id,
      });
      json(res, alert);
    })
  );
}
