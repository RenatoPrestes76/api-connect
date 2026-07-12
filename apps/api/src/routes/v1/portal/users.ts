import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { portalStore } from '../../../modules/portal/portal-store.js';
import type { UserRole } from '@seltriva/release';

const VALID_ROLES: UserRole[] = ['owner', 'admin', 'developer', 'viewer'];

function tenantId(ctx: RouteContext): string {
  return (ctx.headers['x-tenant-id'] as string) || ctx.query.get('tenantId') || 'tenant-enterprise';
}

export function registerPortalUsersRoutes(router: {
  get: Function;
  post: Function;
  put: Function;
  delete: Function;
}): void {
  router.get('/api/v1/portal/users', (ctx: RouteContext, res: ServerResponse) => {
    const users = portalStore.listUsers(tenantId(ctx));
    json(res, { total: users.length, users });
  });

  router.get('/api/v1/portal/users/:id', (ctx: RouteContext, res: ServerResponse) => {
    const user = portalStore.getUser(ctx.params['id']!);
    if (!user) return apiError(res, 'User not found', 404, 'NOT_FOUND');
    json(res, user);
  });

  router.post('/api/v1/portal/users/invite', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { email, name, role } = body;

    if (!email || !name) {
      return apiError(res, '"email" and "name" are required', 400, 'MISSING_FIELDS');
    }
    if (!VALID_ROLES.includes(role)) {
      return apiError(res, `role must be one of: ${VALID_ROLES.join(', ')}`, 400, 'INVALID_ROLE');
    }

    const user = portalStore.inviteUser({ tenantId: tenantId(ctx), email, name, role });
    json(res, user, 201);
  });

  router.put('/api/v1/portal/users/:id/role', (ctx: RouteContext, res: ServerResponse) => {
    const { role } = (ctx.body as any) ?? {};
    if (!VALID_ROLES.includes(role)) {
      return apiError(res, `role must be one of: ${VALID_ROLES.join(', ')}`, 400, 'INVALID_ROLE');
    }
    const user = portalStore.updateUserRole(ctx.params['id']!, role);
    if (!user) return apiError(res, 'User not found', 404, 'NOT_FOUND');
    json(res, user);
  });

  router.delete('/api/v1/portal/users/:id', (ctx: RouteContext, res: ServerResponse) => {
    const deleted = portalStore.removeUser(ctx.params['id']!);
    if (!deleted) return apiError(res, 'User not found', 404, 'NOT_FOUND');
    json(res, { deleted: true });
  });
}
