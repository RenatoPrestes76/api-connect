import type { ServerResponse } from 'http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import {
  controlPlaneStore,
  OrganizationTenantNotFoundError,
} from '../../../modules/control-plane/control-plane-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import type { Organization } from '../../../modules/control-plane/types.js';
import { runtimeRegistrationStore } from '../../../modules/runtime-registration/runtime-registration-store.js';

export function registerOrganizationRoutes(router: Router): void {
  router.get(
    '/admin/control-plane/organizations',
    requirePermission('companies.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const tenantId = ctx.query.get('tenantId') ?? undefined;
      const status = ctx.query.get('status') ?? undefined;
      const tier = ctx.query.get('tier') ?? undefined;
      const organizations = await controlPlaneStore.listOrganizations({ tenantId, status, tier });
      json(res, { organizations, total: organizations.length });
    })
  );

  router.get(
    '/admin/control-plane/organizations/:id',
    requirePermission('companies.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const org = await controlPlaneStore.getOrganization(ctx.params?.id as string);
      if (!org) return apiError(res, 'Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
      json(res, org);
    })
  );

  /**
   * ATLAS 46.21 — the Ed25519 runtime-registration Runtimes ("Atlas
   * Runtimes" in apps/admin) that were registered under this real, Control
   * Plane Organization — see docs/ADR-ATLAS-CANONICAL-CLIENT-ONBOARDING.md.
   * A lookup, not a new store: reads runtime-registration's own records,
   * filtered by the controlPlaneOrganizationId link established at portal
   * registration time.
   */
  router.get(
    '/admin/control-plane/organizations/:id/runtimes',
    requirePermission('companies.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const org = await controlPlaneStore.getOrganization(id);
      if (!org) return apiError(res, 'Organization not found', 404, 'ORGANIZATION_NOT_FOUND');

      const runtimes = runtimeRegistrationStore
        .listRuntimes({ controlPlaneOrganizationId: id })
        .map((r) => runtimeRegistrationStore.toDTO(r));
      json(res, { runtimes, total: runtimes.length });
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
      let org;
      try {
        org = await controlPlaneStore.createOrganization({
          name: body.name,
          slug: body.slug,
          tenantId: body.tenantId,
          tier: body.tier,
        });
      } catch (err) {
        if (err instanceof OrganizationTenantNotFoundError) {
          return apiError(res, err.message, 404, 'TENANT_NOT_FOUND');
        }
        throw err;
      }
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
      const org = await controlPlaneStore.updateOrganization(ctx.params?.id as string, body ?? {});
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
      const ok = await controlPlaneStore.deleteOrganization(id);
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
