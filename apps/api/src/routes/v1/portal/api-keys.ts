import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { portalStore } from '../../../modules/portal/portal-store.js';

function tenantId(ctx: RouteContext): string {
  return (ctx.headers['x-tenant-id'] as string) || ctx.query.get('tenantId') || 'tenant-enterprise';
}

export function registerApiKeysRoutes(router: {
  get: Function;
  post: Function;
  delete: Function;
}): void {
  router.get('/api/v1/portal/api-keys', (ctx: RouteContext, res: ServerResponse) => {
    const keys = portalStore.listApiKeys(tenantId(ctx));
    json(res, { total: keys.length, keys });
  });

  router.post('/api/v1/portal/api-keys', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { name, scopes, expiresAt } = body;

    if (!name) return apiError(res, '"name" is required', 400, 'MISSING_NAME');
    if (!Array.isArray(scopes) || scopes.length === 0) {
      return apiError(res, '"scopes" must be a non-empty array', 400, 'MISSING_SCOPES');
    }

    const created = portalStore.createApiKey({
      tenantId: tenantId(ctx),
      name,
      scopes,
      expiresAt: expiresAt ?? undefined,
      createdBy: (ctx.headers['x-user-email'] as string) || 'admin',
    });
    json(res, created, 201);
  });

  router.post('/api/v1/portal/api-keys/:id/revoke', (ctx: RouteContext, res: ServerResponse) => {
    const revoked = portalStore.revokeApiKey(ctx.params['id']!);
    if (!revoked) return apiError(res, 'API key not found', 404, 'NOT_FOUND');
    json(res, { revoked: true });
  });

  router.delete('/api/v1/portal/api-keys/:id', (ctx: RouteContext, res: ServerResponse) => {
    const deleted = portalStore.deleteApiKey(ctx.params['id']!);
    if (!deleted) return apiError(res, 'API key not found', 404, 'NOT_FOUND');
    json(res, { deleted: true });
  });
}
