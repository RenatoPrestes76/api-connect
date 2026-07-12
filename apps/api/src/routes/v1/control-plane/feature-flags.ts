import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { controlPlaneStore } from '../../../modules/control-plane/control-plane-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import type { FeatureFlag } from '../../../modules/control-plane/types.js';

export function registerFeatureFlagRoutes(router: {
  get: Function;
  post: Function;
  delete: Function;
}): void {
  router.get(
    '/admin/control-plane/feature-flags',
    requirePermission('dashboard.view')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.query.get('organizationId') ?? undefined;
      const environmentId = ctx.query.get('environmentId') ?? undefined;
      const enabledParam = ctx.query.get('enabled');
      const flags = controlPlaneStore.listFeatureFlags({
        organizationId,
        environmentId,
        enabled: enabledParam === null ? undefined : enabledParam === 'true',
      });
      json(res, { flags, total: flags.length });
    })
  );

  router.post(
    '/admin/control-plane/feature-flags',
    requirePermission('settings.manage')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = ctx.body as
        | {
            key?: string;
            organizationId?: string;
            environmentId?: string;
            kind?: FeatureFlag['kind'];
            enabled?: boolean;
            rolloutPercent?: number;
            description?: string;
          }
        | undefined;
      if (!body?.key) return apiError(res, 'key is required', 400, 'MISSING_FIELDS');
      const flag = controlPlaneStore.createFeatureFlag({
        key: body.key,
        organizationId: body.organizationId,
        environmentId: body.environmentId,
        kind: body.kind,
        enabled: body.enabled,
        rolloutPercent: body.rolloutPercent,
        description: body.description,
      });
      adminIdentityStore.recordAudit({
        action: 'CREATE_FEATURE_FLAG',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: flag.id,
      });
      json(res, flag, 201);
    })
  );

  router.post(
    '/admin/control-plane/feature-flags/:id/toggle',
    requirePermission('settings.manage')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const flag = controlPlaneStore.toggleFeatureFlag(id);
      if (!flag) return apiError(res, 'Feature flag not found', 404, 'FLAG_NOT_FOUND');
      adminIdentityStore.recordAudit({
        action: 'TOGGLE_FEATURE_FLAG',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: id,
        metadata: { enabled: flag.enabled },
      });
      json(res, flag);
    })
  );

  router.delete(
    '/admin/control-plane/feature-flags/:id',
    requirePermission('settings.manage')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const ok = controlPlaneStore.deleteFeatureFlag(id);
      if (!ok) return apiError(res, 'Feature flag not found', 404, 'FLAG_NOT_FOUND');
      adminIdentityStore.recordAudit({
        action: 'DELETE_FEATURE_FLAG',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: id,
      });
      json(res, { success: true });
    })
  );
}
