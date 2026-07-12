import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { controlPlaneStore } from '../../../modules/control-plane/control-plane-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { requirePermission } from '../../../middleware/admin-auth.js';

export function registerConnectorRoutes(router: { get: Function; post: Function }): void {
  router.get(
    '/admin/control-plane/connectors',
    requirePermission('marketplace.review')(async (ctx: RouteContext, res: ServerResponse) => {
      const status = ctx.query.get('status') ?? undefined;
      const category = ctx.query.get('category') ?? undefined;
      const connectors = controlPlaneStore.listConnectors({ status, category });
      json(res, { connectors, total: connectors.length });
    })
  );

  router.get(
    '/admin/control-plane/connectors/:id',
    requirePermission('marketplace.review')(async (ctx: RouteContext, res: ServerResponse) => {
      const connector = controlPlaneStore.getConnector(ctx.params?.id as string);
      if (!connector) return apiError(res, 'Connector not found', 404, 'CONNECTOR_NOT_FOUND');
      json(res, connector);
    })
  );

  router.get(
    '/admin/control-plane/connectors/:id/versions',
    requirePermission('marketplace.review')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      if (!controlPlaneStore.getConnector(id))
        return apiError(res, 'Connector not found', 404, 'CONNECTOR_NOT_FOUND');
      const versions = controlPlaneStore.getConnectorVersions(id);
      json(res, { versions, total: versions.length });
    })
  );

  router.post(
    '/admin/control-plane/connectors/:id/versions',
    requirePermission('marketplace.publish')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const body = ctx.body as { version?: string; changelog?: string } | undefined;
      if (!body?.version) return apiError(res, 'version is required', 400, 'MISSING_FIELDS');
      const result = controlPlaneStore.createConnectorVersion(id, {
        version: body.version,
        changelog: body.changelog,
      });
      if (result === 'CONNECTOR_NOT_FOUND')
        return apiError(res, 'Connector not found', 404, 'CONNECTOR_NOT_FOUND');
      json(res, result, 201);
    })
  );

  router.post(
    '/admin/control-plane/connectors/:id/versions/:versionId/publish',
    requirePermission('marketplace.publish')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const versionId = ctx.params?.versionId as string;
      const result = controlPlaneStore.publishConnectorVersion(id, versionId);
      if (result === 'NOT_FOUND')
        return apiError(res, 'Connector version not found', 404, 'VERSION_NOT_FOUND');
      adminIdentityStore.recordAudit({
        action: 'PUBLISH_CONNECTOR_VERSION',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: `${id}/${versionId}`,
      });
      json(res, result);
    })
  );

  router.get(
    '/admin/control-plane/organizations/:id/connectors',
    requirePermission('marketplace.review')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.params?.id as string;
      if (!controlPlaneStore.getOrganization(organizationId)) {
        return apiError(res, 'Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
      }
      const installed = controlPlaneStore.listOrganizationConnectors(organizationId);
      json(res, { installed, total: installed.length });
    })
  );
}
