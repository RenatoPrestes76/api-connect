import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { haStore } from '../../../modules/ha/ha-store.js';
import { recoveryService } from '../../../modules/ha/recovery-service.js';

export function registerHaRecoveryRoutes(router: { get: Function; post: Function }): void {
  router.get('/api/v1/ha/recovery', (ctx: RouteContext, res: ServerResponse) => {
    const tenantId = ctx.query.get('tenantId') ?? undefined;
    const tests = haStore.getRecoveryTests(tenantId);
    const passed = tests.filter((t) => t.result === 'passed').length;
    const rtoMap = recoveryService.getRtoByTenant();
    const rpoMap = recoveryService.getRpoByTenant();
    json(res, {
      total: tests.length,
      passed,
      failed: tests.length - passed,
      rtoByTenant: tenantId ? { [tenantId]: rtoMap[tenantId] } : rtoMap,
      rpoByTenant: tenantId ? { [tenantId]: rpoMap[tenantId] } : rpoMap,
      tests,
    });
  });

  router.post('/api/v1/ha/recovery-test', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { tenantId } = body;

    if (!tenantId) return apiError(res, '"tenantId" is required', 400, 'MISSING_FIELDS');
    if (!recoveryService.isKnownTenant(tenantId)) {
      return apiError(res, 'Tenant not found', 404, 'NOT_FOUND');
    }

    const test = recoveryService.runRecoveryTest(tenantId);
    json(res, test, 201);
  });
}
