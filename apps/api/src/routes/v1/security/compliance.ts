import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireTenantId } from '../../../http/tenant.js';
import { securityStore } from '../../../modules/security/security-store.js';
import type { DataRequestType } from '@seltriva/aegis';

export function registerComplianceRoutes(router: { get: Function; post: Function }): void {
  // GET /api/v1/security/compliance
  router.get('/api/v1/security/compliance', async (ctx: RouteContext, res: ServerResponse) => {
    const framework = ctx.query.get('framework') || undefined;
    const controls = securityStore.getComplianceControls(framework);
    const byFramework = controls.reduce<Record<string, typeof controls>>((acc, c) => {
      (acc[c.framework] ||= []).push(c);
      return acc;
    }, {});
    const summary = Object.entries(byFramework).map(([fw, ctrls]) => ({
      framework: fw,
      total: ctrls.length,
      compliant: ctrls.filter((c) => c.status === 'compliant').length,
      partial: ctrls.filter((c) => c.status === 'partial').length,
      nonCompliant: ctrls.filter((c) => c.status === 'non_compliant').length,
    }));
    json(res, { controls, summary, total: controls.length });
  });

  // GET /api/v1/security/compliance/data-requests
  router.get(
    '/api/v1/security/compliance/data-requests',
    async (ctx: RouteContext, res: ServerResponse) => {
      const tenantId = requireTenantId(ctx);
      const requests = securityStore.getDataRequests(tenantId);
      json(res, { requests, total: requests.length });
    }
  );

  // POST /api/v1/security/compliance/data-request
  router.post(
    '/api/v1/security/compliance/data-request',
    async (ctx: RouteContext, res: ServerResponse) => {
      const tenantId = requireTenantId(ctx);
      const body = (ctx.body ?? {}) as Record<string, unknown>;
      const type = body['type'] as DataRequestType | undefined;
      const requestorEmail = body['requestorEmail'] as string | undefined;
      const framework = body['framework'] as 'LGPD' | 'GDPR' | undefined;
      const notes = (body['notes'] as string | undefined) ?? '';
      if (!type || !requestorEmail || !framework)
        return apiError(res, 'type, requestorEmail, framework required', 400);
      const req = securityStore.createDataRequest({
        type,
        requestorEmail,
        framework,
        notes,
        status: 'pending',
        tenantId,
      });
      json(res, { request: req }, 201);
    }
  );
}
