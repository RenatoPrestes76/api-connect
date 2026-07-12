import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { controlPlaneStore } from '../../../modules/control-plane/control-plane-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import type { Environment } from '../../../modules/control-plane/types.js';

export function registerEnvironmentRoutes(router: {
  get: Function;
  post: Function;
  delete: Function;
}): void {
  router.get(
    '/admin/control-plane/environments',
    requirePermission('companies.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.query.get('organizationId') ?? undefined;
      const kind = ctx.query.get('kind') ?? undefined;
      const status = ctx.query.get('status') ?? undefined;
      const environments = controlPlaneStore.listEnvironments({ organizationId, kind, status });
      json(res, { environments, total: environments.length });
    })
  );

  router.get(
    '/admin/control-plane/environments/:id',
    requirePermission('companies.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const env = controlPlaneStore.getEnvironment(ctx.params?.id as string);
      if (!env) return apiError(res, 'Environment not found', 404, 'ENVIRONMENT_NOT_FOUND');
      json(res, env);
    })
  );

  router.post(
    '/admin/control-plane/environments',
    requirePermission('companies.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = ctx.body as
        | { organizationId?: string; name?: string; slug?: string; kind?: Environment['kind'] }
        | undefined;
      if (!body?.organizationId || !body?.name || !body?.slug || !body?.kind) {
        return apiError(
          res,
          'organizationId, name, slug and kind are required',
          400,
          'MISSING_FIELDS'
        );
      }
      const result = controlPlaneStore.createEnvironment({
        organizationId: body.organizationId,
        name: body.name,
        slug: body.slug,
        kind: body.kind,
      });
      if (result === 'ORGANIZATION_NOT_FOUND') {
        return apiError(res, 'Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
      }
      adminIdentityStore.recordAudit({
        action: 'CREATE_ENVIRONMENT',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: result.id,
      });
      json(res, result, 201);
    })
  );

  router.delete(
    '/admin/control-plane/environments/:id',
    requirePermission('companies.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const ok = controlPlaneStore.deleteEnvironment(id);
      if (!ok) return apiError(res, 'Environment not found', 404, 'ENVIRONMENT_NOT_FOUND');
      adminIdentityStore.recordAudit({
        action: 'DELETE_ENVIRONMENT',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: id,
      });
      json(res, { success: true });
    })
  );
}
