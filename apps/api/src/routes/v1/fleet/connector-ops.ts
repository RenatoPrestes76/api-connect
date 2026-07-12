import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { fleetOpsStore } from '../../../modules/fleet-ops/fleet-ops-store.js';
import { controlPlaneStore } from '../../../modules/control-plane/control-plane-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { requirePermission } from '../../../middleware/admin-auth.js';

export function registerConnectorOpsRoutes(router: {
  get: Function;
  post: Function;
  delete: Function;
}): void {
  router.post(
    '/admin/fleet/connectors/:id/install',
    requirePermission('marketplace.publish')(async (ctx: RouteContext, res: ServerResponse) => {
      const pluginId = ctx.params?.id as string;
      const body = ctx.body as { organizationId?: string; version?: string } | undefined;
      if (!body?.organizationId || !body?.version) {
        return apiError(res, 'organizationId and version are required', 400, 'MISSING_FIELDS');
      }
      if (!controlPlaneStore.getConnector(pluginId))
        return apiError(res, 'Connector not found', 404, 'CONNECTOR_NOT_FOUND');
      if (!controlPlaneStore.getOrganization(body.organizationId)) {
        return apiError(res, 'Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
      }
      const record = fleetOpsStore.installConnector(body.organizationId, pluginId, body.version);
      adminIdentityStore.recordAudit({
        action: 'CONNECTOR_INSTALL',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: pluginId,
        metadata: { organizationId: body.organizationId, version: body.version },
      });
      json(res, record, 201);
    })
  );

  router.post(
    '/admin/fleet/connectors/:id/update',
    requirePermission('marketplace.publish')(async (ctx: RouteContext, res: ServerResponse) => {
      const pluginId = ctx.params?.id as string;
      const body = ctx.body as { organizationId?: string; version?: string } | undefined;
      if (!body?.organizationId || !body?.version) {
        return apiError(res, 'organizationId and version are required', 400, 'MISSING_FIELDS');
      }
      const record = fleetOpsStore.updateConnector(body.organizationId, pluginId, body.version);
      adminIdentityStore.recordAudit({
        action: 'CONNECTOR_UPDATE',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: pluginId,
        metadata: { organizationId: body.organizationId, version: body.version },
      });
      json(res, record);
    })
  );

  router.post(
    '/admin/fleet/connectors/:id/restart',
    requirePermission('marketplace.publish')(async (ctx: RouteContext, res: ServerResponse) => {
      const pluginId = ctx.params?.id as string;
      const body = ctx.body as { organizationId?: string } | undefined;
      if (!body?.organizationId)
        return apiError(res, 'organizationId is required', 400, 'MISSING_FIELDS');
      const record = fleetOpsStore.restartConnector(body.organizationId, pluginId);
      if (!record) return apiError(res, 'Installation not found', 404, 'INSTALLATION_NOT_FOUND');
      adminIdentityStore.recordAudit({
        action: 'CONNECTOR_RESTART',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: pluginId,
        metadata: { organizationId: body.organizationId },
      });
      json(res, record);
    })
  );

  router.delete(
    '/admin/fleet/connectors/:id',
    requirePermission('marketplace.publish')(async (ctx: RouteContext, res: ServerResponse) => {
      const pluginId = ctx.params?.id as string;
      const organizationId = ctx.query.get('organizationId');
      if (!organizationId)
        return apiError(res, 'organizationId query param is required', 400, 'MISSING_FIELDS');
      const ok = fleetOpsStore.removeConnector(organizationId, pluginId);
      if (!ok) return apiError(res, 'Installation not found', 404, 'INSTALLATION_NOT_FOUND');
      adminIdentityStore.recordAudit({
        action: 'CONNECTOR_REMOVE',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: pluginId,
        metadata: { organizationId },
      });
      json(res, { success: true });
    })
  );

  router.get(
    '/admin/fleet/connectors/:id/logs',
    requirePermission('marketplace.review')(async (ctx: RouteContext, res: ServerResponse) => {
      const pluginId = ctx.params?.id as string;
      const organizationId = ctx.query.get('organizationId');
      if (!organizationId)
        return apiError(res, 'organizationId query param is required', 400, 'MISSING_FIELDS');
      const logs = fleetOpsStore.getConnectorLogs(organizationId, pluginId);
      json(res, { logs, total: logs.length });
    })
  );
}
