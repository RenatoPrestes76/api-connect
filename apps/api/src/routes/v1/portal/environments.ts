import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { portalIdentityStore } from '../../../modules/portal-identity/portal-identity-store.js';
import { requirePortalPermission } from '../../../middleware/portal-auth.js';
import type { EnvironmentKind } from '../../../modules/portal-identity/types.js';

const VALID_KINDS: EnvironmentKind[] = ['production', 'staging', 'development'];

interface CreateEnvironmentBody {
  name?: string;
  kind?: EnvironmentKind;
  region?: string;
  timezone?: string;
}

export function registerPortalEnvironmentRoutes(router: Router): void {
  router.get(
    '/api/v1/portal/environments',
    requirePortalPermission('environments.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const environments = portalIdentityStore.listEnvironments(ctx.portalOrganizationId as string);
      json(res, { total: environments.length, environments });
    })
  );

  router.post(
    '/api/v1/portal/environments',
    requirePortalPermission('environments.write')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const body = (ctx.body ?? {}) as CreateEnvironmentBody;
        if (!body.name || !body.kind || !VALID_KINDS.includes(body.kind)) {
          return apiError(
            res,
            `"name" is required and kind must be one of: ${VALID_KINDS.join(', ')}`,
            400,
            'MISSING_FIELDS'
          );
        }

        const organizationId = ctx.portalOrganizationId as string;
        const environment = portalIdentityStore.createEnvironment(organizationId, {
          name: body.name,
          kind: body.kind,
          region: body.region,
          timezone: body.timezone,
        });

        portalIdentityStore.recordAudit({
          organizationId,
          action: 'ENVIRONMENT_CREATED',
          actorId: ctx.portalUserId,
          actorEmail: ctx.portalEmail ?? 'unknown',
          target: environment.id,
        });

        json(res, environment, 201);
      }
    )
  );

  router.delete(
    '/api/v1/portal/environments/:id',
    requirePortalPermission('environments.delete')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const organizationId = ctx.portalOrganizationId as string;
        const id = ctx.params['id'] as string;
        const ok = portalIdentityStore.deleteEnvironment(organizationId, id);
        if (!ok) return apiError(res, 'Environment not found', 404, 'NOT_FOUND');

        portalIdentityStore.recordAudit({
          organizationId,
          action: 'ENVIRONMENT_DELETED',
          actorId: ctx.portalUserId,
          actorEmail: ctx.portalEmail ?? 'unknown',
          target: id,
        });

        json(res, { deleted: true });
      }
    )
  );
}
