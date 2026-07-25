import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { portalIdentityStore } from '../../../modules/portal-identity/portal-identity-store.js';
import { requirePortalPermission } from '../../../middleware/portal-auth.js';
import type { OrgRole } from '../../../modules/portal-identity/types.js';

const VALID_ROLES: OrgRole[] = ['OWNER', 'ADMINISTRATOR', 'DEVELOPER', 'OPERATOR', 'VIEWER'];

interface UpdateRoleBody {
  role?: OrgRole;
}

export function registerPortalUsersRoutes(router: Router): void {
  router.get(
    '/api/v1/portal/users',
    requirePortalPermission('org-users.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const users = portalIdentityStore
        .listUsers(ctx.portalOrganizationId as string)
        .map((u) => portalIdentityStore.toDTO(u));
      json(res, { total: users.length, users });
    })
  );

  router.put(
    '/api/v1/portal/users/:id/role',
    requirePortalPermission('org-users.manage')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = (ctx.body ?? {}) as UpdateRoleBody;
      if (!body.role || !VALID_ROLES.includes(body.role)) {
        return apiError(res, `role must be one of: ${VALID_ROLES.join(', ')}`, 400, 'INVALID_ROLE');
      }

      const organizationId = ctx.portalOrganizationId as string;
      const id = ctx.params['id'] as string;
      const user = portalIdentityStore.updateUserRole(organizationId, id, body.role);
      if (!user) return apiError(res, 'User not found', 404, 'NOT_FOUND');

      portalIdentityStore.recordAudit({
        organizationId,
        action: 'USER_ROLE_CHANGED',
        actorId: ctx.portalUserId,
        actorEmail: ctx.portalEmail ?? 'unknown',
        target: id,
        metadata: { role: body.role },
      });

      json(res, portalIdentityStore.toDTO(user));
    })
  );

  router.delete(
    '/api/v1/portal/users/:id',
    requirePortalPermission('org-users.manage')(async (ctx: RouteContext, res: ServerResponse) => {
      const organizationId = ctx.portalOrganizationId as string;
      const id = ctx.params['id'] as string;
      const ok = portalIdentityStore.removeUser(organizationId, id);
      if (!ok) return apiError(res, 'User not found', 404, 'NOT_FOUND');

      portalIdentityStore.recordAudit({
        organizationId,
        action: 'USER_REMOVED',
        actorId: ctx.portalUserId,
        actorEmail: ctx.portalEmail ?? 'unknown',
        target: id,
      });

      json(res, { deleted: true });
    })
  );
}
