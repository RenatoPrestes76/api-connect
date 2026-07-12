import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { securityStore } from '../../../modules/security/security-store.js';

function resolveTenant(ctx: RouteContext): string {
  return (ctx.headers['x-tenant-id'] as string) || ctx.query.get('tenantId') || 'tenant-enterprise';
}

export function registerCertificatesRoutes(router: { get: Function; post: Function }): void {
  // GET /api/v1/security/certificates
  router.get('/api/v1/security/certificates', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = resolveTenant(ctx);
    const certs = securityStore.getCertificates(tenantId);
    const expiringSoon = certs.filter((c) => c.daysUntilExpiry <= 30);
    json(res, { certificates: certs, expiringSoon: expiringSoon.length, total: certs.length });
  });

  // POST /api/v1/security/certificates/renew/:id
  router.post(
    '/api/v1/security/certificates/renew/:id',
    async (ctx: RouteContext, res: ServerResponse) => {
      const cert = securityStore.renewCertificate(ctx.params['id']!);
      if (!cert) return apiError(res, 'Certificate not found', 404);
      json(res, { certificate: cert });
    }
  );
}
