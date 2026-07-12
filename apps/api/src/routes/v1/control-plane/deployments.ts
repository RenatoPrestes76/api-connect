import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { controlPlaneStore } from '../../../modules/control-plane/control-plane-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { requirePermission } from '../../../middleware/admin-auth.js';

export function registerDeploymentRoutes(router: { get: Function; post: Function }): void {
  router.get(
    '/admin/control-plane/deployments',
    requirePermission('marketplace.review')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.query.get('organizationId') ?? undefined;
      const environmentId = ctx.query.get('environmentId') ?? undefined;
      const status = ctx.query.get('status') ?? undefined;
      const deployments = controlPlaneStore.listDeployments({
        organizationId,
        environmentId,
        status,
      });
      json(res, { deployments, total: deployments.length });
    })
  );

  router.get(
    '/admin/control-plane/deployments/:id',
    requirePermission('marketplace.review')(async (ctx: RouteContext, res: ServerResponse) => {
      const deployment = controlPlaneStore.getDeployment(ctx.params?.id as string);
      if (!deployment) return apiError(res, 'Deployment not found', 404, 'DEPLOYMENT_NOT_FOUND');
      json(res, deployment);
    })
  );

  router.post(
    '/admin/control-plane/deployments',
    requirePermission('marketplace.publish')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = ctx.body as
        | {
            organizationId?: string;
            environmentId?: string;
            pluginId?: string;
            pluginVersionId?: string;
          }
        | undefined;
      if (
        !body?.organizationId ||
        !body?.environmentId ||
        !body?.pluginId ||
        !body?.pluginVersionId
      ) {
        return apiError(
          res,
          'organizationId, environmentId, pluginId and pluginVersionId are required',
          400,
          'MISSING_FIELDS'
        );
      }
      const result = controlPlaneStore.createDeployment({
        organizationId: body.organizationId,
        environmentId: body.environmentId,
        pluginId: body.pluginId,
        pluginVersionId: body.pluginVersionId,
        triggeredBy: ctx.adminUserId,
      });
      if (result === 'ORGANIZATION_NOT_FOUND')
        return apiError(res, 'Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
      if (result === 'ENVIRONMENT_NOT_FOUND')
        return apiError(res, 'Environment not found', 404, 'ENVIRONMENT_NOT_FOUND');
      if (result === 'CONNECTOR_VERSION_NOT_FOUND') {
        return apiError(res, 'Connector version not found', 404, 'CONNECTOR_VERSION_NOT_FOUND');
      }
      adminIdentityStore.recordAudit({
        action: 'CREATE_DEPLOYMENT',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: result.id,
      });
      json(res, result, 201);
    })
  );

  router.post(
    '/admin/control-plane/deployments/:id/rollback',
    requirePermission('marketplace.publish')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const result = controlPlaneStore.rollbackDeployment(id);
      if (result === 'NOT_FOUND')
        return apiError(res, 'Deployment not found', 404, 'DEPLOYMENT_NOT_FOUND');
      if (result === 'NOT_ROLLBACKABLE') {
        return apiError(
          res,
          'Only successful deployments can be rolled back',
          400,
          'NOT_ROLLBACKABLE'
        );
      }
      adminIdentityStore.recordAudit({
        action: 'ROLLBACK_DEPLOYMENT',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: id,
      });
      json(res, result);
    })
  );
}
