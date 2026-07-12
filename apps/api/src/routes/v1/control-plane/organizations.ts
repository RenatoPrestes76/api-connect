import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { controlPlaneStore } from '../../../modules/control-plane/control-plane-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import type { Organization } from '../../../modules/control-plane/types.js';

export function registerOrganizationRoutes(router: {
  get: Function;
  post: Function;
  patch: Function;
  delete: Function;
}): void {
  router.get(
    '/admin/control-plane/organizations',
    requirePermission('companies.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const tenantId = ctx.query.get('tenantId') ?? undefined;
      const status = ctx.query.get('status') ?? undefined;
      const tier = ctx.query.get('tier') ?? undefined;
      const organizations = controlPlaneStore.listOrganizations({ tenantId, status, tier });
      json(res, { organizations, total: organizations.length });
    })
  );

  router.get(
    '/admin/control-plane/organizations/:id',
    requirePermission('companies.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const org = controlPlaneStore.getOrganization(ctx.params?.id as string);
      if (!org) return apiError(res, 'Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
      json(res, org);
    })
  );

  router.post(
    '/admin/control-plane/organizations',
    requirePermission('companies.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = ctx.body as
        | { name?: string; slug?: string; tenantId?: string; tier?: Organization['tier'] }
        | undefined;
      if (!body?.name || !body?.slug) {
        return apiError(res, 'name and slug are required', 400, 'MISSING_FIELDS');
      }
      const org = controlPlaneStore.createOrganization({
        name: body.name,
        slug: body.slug,
        tenantId: body.tenantId,
        tier: body.tier,
      });
      adminIdentityStore.recordAudit({
        action: 'CREATE_ORGANIZATION',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: org.id,
      });
      json(res, org, 201);
    })
  );

  router.patch(
    '/admin/control-plane/organizations/:id',
    requirePermission('companies.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = ctx.body as
        | Partial<Pick<Organization, 'name' | 'tier' | 'status' | 'tenantId'>>
        | undefined;
      const org = controlPlaneStore.updateOrganization(ctx.params?.id as string, body ?? {});
      if (!org) return apiError(res, 'Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
      adminIdentityStore.recordAudit({
        action: 'UPDATE_ORGANIZATION',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: org.id,
        metadata: body as Record<string, unknown>,
      });
      json(res, org);
    })
  );

  router.delete(
    '/admin/control-plane/organizations/:id',
    requirePermission('companies.delete')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const ok = controlPlaneStore.deleteOrganization(id);
      if (!ok) return apiError(res, 'Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
      adminIdentityStore.recordAudit({
        action: 'DELETE_ORGANIZATION',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: id,
      });
      json(res, { success: true });
    })
  );
}
