import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { portalIdentityStore } from '../../../modules/portal-identity/portal-identity-store.js';
import { requirePortalPermission } from '../../../middleware/portal-auth.js';
import type {
  OrganizationPlan,
  OrganizationStatus,
} from '../../../modules/portal-identity/types.js';

interface UpdateOrganizationBody {
  name?: string;
  razaoSocial?: string;
  cnpj?: string;
  internalCode?: string;
  status?: OrganizationStatus;
  plan?: OrganizationPlan;
}

export function registerPortalOrganizationRoutes(router: { get: Function; patch: Function }): void {
  router.get(
    '/api/v1/portal/organization',
    requirePortalPermission('organization.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const organization = portalIdentityStore.getOrganization(ctx.portalOrganizationId as string);
      if (!organization) return apiError(res, 'Organization not found', 404, 'NOT_FOUND');
      json(res, organization);
    })
  );

  router.patch(
    '/api/v1/portal/organization',
    requirePortalPermission('organization.write')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const body = (ctx.body ?? {}) as UpdateOrganizationBody;
        const organizationId = ctx.portalOrganizationId as string;
        const organization = portalIdentityStore.updateOrganization(organizationId, body);
        if (!organization) return apiError(res, 'Organization not found', 404, 'NOT_FOUND');

        portalIdentityStore.recordAudit({
          organizationId,
          action: 'ORG_UPDATED',
          actorId: ctx.portalUserId,
          actorEmail: ctx.portalEmail ?? 'unknown',
          target: organizationId,
          metadata: body as Record<string, unknown>,
        });

        json(res, organization);
      }
    )
  );
}
