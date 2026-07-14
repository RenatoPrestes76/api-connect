import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireTenantId } from '../../../http/tenant.js';
import { securityStore } from '../../../modules/security/security-store.js';
import type { ConsentPurpose } from '@seltriva/aegis';

export function registerConsentRoutes(router: {
  get: Function;
  post: Function;
  delete: Function;
}): void {
  // GET /api/v1/security/consent
  router.get('/api/v1/security/consent', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireTenantId(ctx);
    const records = securityStore.getConsentRecords(tenantId);
    json(res, { records, total: records.length });
  });

  // POST /api/v1/security/consent
  router.post('/api/v1/security/consent', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireTenantId(ctx);
    const body = (ctx.body ?? {}) as Record<string, unknown>;
    const userId = body['userId'] as string | undefined;
    const purpose = body['purpose'] as ConsentPurpose | undefined;
    const framework = body['framework'] as 'LGPD' | 'GDPR' | undefined;
    const source = body['source'] as string | undefined;
    const ipAddress = body['ipAddress'] as string | undefined;
    const version = body['version'] as string | undefined;
    if (!userId || !purpose || !framework)
      return apiError(res, 'userId, purpose, framework required', 400);
    const now = new Date().toISOString();
    const record = securityStore.upsertConsent({
      tenantId,
      userId,
      purpose,
      framework,
      granted: true,
      grantedAt: now,
      revokedAt: null,
      source: (source as string) || 'api',
      ipAddress: (ipAddress as string) || '0.0.0.0',
      version: (version as string) || '1.0',
    });
    json(res, { record }, 201);
  });

  // DELETE /api/v1/security/consent/revoke  (userId + purpose as query params)
  router.delete(
    '/api/v1/security/consent/revoke',
    async (ctx: RouteContext, res: ServerResponse) => {
      const tenantId = requireTenantId(ctx);
      const userId = ctx.query.get('userId');
      const purpose = ctx.query.get('purpose');
      if (!userId || !purpose) return apiError(res, 'userId and purpose required', 400);
      const record = securityStore.revokeConsent(tenantId, userId, purpose as any);
      if (!record) return apiError(res, 'Consent record not found', 404);
      json(res, { record });
    }
  );
}
