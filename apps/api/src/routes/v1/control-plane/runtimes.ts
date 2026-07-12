import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { controlPlaneStore } from '../../../modules/control-plane/control-plane-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { requirePermission } from '../../../middleware/admin-auth.js';

export function registerRuntimeRoutes(router: { get: Function; post: Function }): void {
  router.get(
    '/admin/control-plane/runtimes',
    requirePermission('runtime.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.query.get('organizationId') ?? undefined;
      const environmentId = ctx.query.get('environmentId') ?? undefined;
      const status = ctx.query.get('status') ?? undefined;
      const runtimes = controlPlaneStore.listRuntimes({ organizationId, environmentId, status });
      json(res, { runtimes, total: runtimes.length });
    })
  );

  router.get(
    '/admin/control-plane/runtimes/:id',
    requirePermission('runtime.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const runtime = controlPlaneStore.getRuntime(ctx.params?.id as string);
      if (!runtime) return apiError(res, 'Runtime not found', 404, 'RUNTIME_NOT_FOUND');
      json(res, runtime);
    })
  );

  router.post(
    '/admin/control-plane/runtimes/:id/restart',
    requirePermission('runtime.restart')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const runtime = controlPlaneStore.restartRuntime(id);
      if (!runtime) return apiError(res, 'Runtime not found', 404, 'RUNTIME_NOT_FOUND');
      adminIdentityStore.recordAudit({
        action: 'RESTART_RUNTIME',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: id,
      });
      json(res, runtime);
    })
  );

  router.post(
    '/admin/control-plane/runtimes/:id/update',
    requirePermission('runtime.update')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const body = ctx.body as { version?: string } | undefined;
      if (!body?.version) return apiError(res, 'version is required', 400, 'MISSING_FIELDS');
      const runtime = controlPlaneStore.updateRuntimeVersion(id, body.version);
      if (!runtime) return apiError(res, 'Runtime not found', 404, 'RUNTIME_NOT_FOUND');
      adminIdentityStore.recordAudit({
        action: 'UPDATE_RUNTIME',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: id,
        metadata: { version: body.version },
      });
      json(res, runtime);
    })
  );

  router.post(
    '/admin/control-plane/runtimes/:id/retire',
    requirePermission('runtime.update')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const runtime = controlPlaneStore.retireRuntime(id);
      if (!runtime) return apiError(res, 'Runtime not found', 404, 'RUNTIME_NOT_FOUND');
      adminIdentityStore.recordAudit({
        action: 'RETIRE_RUNTIME',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: id,
      });
      json(res, runtime);
    })
  );

  router.post(
    '/admin/control-plane/runtimes/:id/token',
    requirePermission('runtime.token')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const result = controlPlaneStore.issueRuntimeToken(id);
      if (!result) return apiError(res, 'Runtime not found', 404, 'RUNTIME_NOT_FOUND');
      adminIdentityStore.recordAudit({
        action: 'ROTATE_RUNTIME_TOKEN',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: id,
      });
      // The raw token is returned exactly once — only its hash is ever persisted.
      json(res, {
        token: result.raw,
        expiresAt: result.record.expiresAt,
        tokenPrefix: result.record.tokenPrefix,
      });
    })
  );
}
