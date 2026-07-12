import type { ServerResponse } from 'http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { controlPlaneStore } from '../../../modules/control-plane/control-plane-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { requirePermission } from '../../../middleware/admin-auth.js';

export function registerTenantRoutes(router: {
  get: Function;
  post: Function;
  patch: Function;
  delete: Function;
}): void {
  router.get(
    '/admin/control-plane/tenants',
    requirePermission('companies.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const status = ctx.query.get('status') ?? undefined;
      const tenants = controlPlaneStore.listTenants({ status });
      json(res, { tenants, total: tenants.length });
    })
  );

  router.get(
    '/admin/control-plane/tenants/:id',
    requirePermission('companies.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const tenant = controlPlaneStore.getTenant(ctx.params?.id as string);
      if (!tenant) return apiError(res, 'Tenant not found', 404, 'TENANT_NOT_FOUND');
      json(res, tenant);
    })
  );

  router.post(
    '/admin/control-plane/tenants',
    requirePermission('companies.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = ctx.body as
        | { name?: string; slug?: string; primaryContactEmail?: string }
        | undefined;
      if (!body?.name || !body?.slug) {
        return apiError(res, 'name and slug are required', 400, 'MISSING_FIELDS');
      }
      const tenant = controlPlaneStore.createTenant({
        name: body.name,
        slug: body.slug,
        primaryContactEmail: body.primaryContactEmail,
      });
      adminIdentityStore.recordAudit({
        action: 'CREATE_TENANT',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: tenant.id,
      });
      json(res, tenant, 201);
    })
  );

  router.patch(
    '/admin/control-plane/tenants/:id',
    requirePermission('companies.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = ctx.body as
        | {
            name?: string;
            status?: 'ACTIVE' | 'SUSPENDED' | 'CHURNED';
            primaryContactEmail?: string;
          }
        | undefined;
      const tenant = controlPlaneStore.updateTenant(ctx.params?.id as string, body ?? {});
      if (!tenant) return apiError(res, 'Tenant not found', 404, 'TENANT_NOT_FOUND');
      adminIdentityStore.recordAudit({
        action: 'UPDATE_TENANT',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: tenant.id,
        metadata: body as Record<string, unknown>,
      });
      json(res, tenant);
    })
  );

  router.delete(
    '/admin/control-plane/tenants/:id',
    requirePermission('companies.delete')(async (ctx: RouteContext, res: ServerResponse) => {
      const id = ctx.params?.id as string;
      const ok = controlPlaneStore.deleteTenant(id);
      if (!ok) return apiError(res, 'Tenant not found', 404, 'TENANT_NOT_FOUND');
      adminIdentityStore.recordAudit({
        action: 'DELETE_TENANT',
        actorId: ctx.adminUserId,
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: id,
      });
      json(res, { success: true });
    })
  );
}
