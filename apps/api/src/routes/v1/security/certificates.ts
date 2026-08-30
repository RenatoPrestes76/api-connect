import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireOrgId } from '../../../http/tenant.js';
import { securityStore } from '../../../modules/security/security-store.js';

/**
 * ATLAS 46.26 — `POST .../certificates/renew/:id` previously took the
 * certificate id from the URL with no tenant check at all — any
 * authenticated caller could renew (mutate the expiry of) any other
 * tenant's certificate. Fixed the same way as the rest of this module.
 */
export function registerCertificatesRoutes(router: Router): void {
  // GET /api/v1/security/certificates
  router.get('/api/v1/security/certificates', async (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = requireOrgId(ctx);
    const certs = securityStore.getCertificates(tenantId);
    const expiringSoon = certs.filter((c) => c.daysUntilExpiry <= 30);
    json(res, { certificates: certs, expiringSoon: expiringSoon.length, total: certs.length });
  });

  // POST /api/v1/security/certificates/renew/:id
  router.post(
    '/api/v1/security/certificates/renew/:id',
    async (ctx: RouteContext, res: ServerResponse) => {
      const tenantId = requireOrgId(ctx);
      const existing = securityStore.getCertificateById(ctx.params['id']);
      if (!existing || existing.tenantId !== tenantId) {
        return apiError(res, 'Certificate not found', 404);
      }
      const cert = securityStore.renewCertificate(ctx.params['id']);
      if (!cert) return apiError(res, 'Certificate not found', 404);
      json(res, { certificate: cert });
    }
  );
}
