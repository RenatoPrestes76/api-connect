import type { ServerResponse } from 'node:http';
import type { RouteContext, Router } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { haStore } from '../../../modules/ha/ha-store.js';
import { recoveryService } from '../../../modules/ha/recovery-service.js';

interface RecoveryTestBody {
  tenantId?: string;
}

/**
 * ATLAS 46.26 — final hardening, Part 7 (final requireTenantId/tenantId
 * sweep). GET /ha/recovery is a staff-facing DR dashboard — `tenantId` is
 * just an optional filter, same accepted pattern as ops/*. POST
 * /ha/recovery-test previously had NO permission check at all — any
 * authenticated caller could trigger a real recovery test "for" any
 * tenant by naming it in the body. Fixed with the new `ha.manage`
 * permission (see billing/admin.ts and security/rotation.ts for the same
 * requirePermission idiom).
 */
export function registerHaRecoveryRoutes(router: Router): void {
  router.get('/api/v1/ha/recovery', async (ctx: RouteContext, res: ServerResponse) => {
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

  router.post(
    '/api/v1/ha/recovery-test',
    requirePermission('ha.manage')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = (ctx.body as RecoveryTestBody | undefined) ?? {};
      const { tenantId } = body;

      if (!tenantId) return apiError(res, '"tenantId" is required', 400, 'MISSING_FIELDS');
      if (!recoveryService.isKnownTenant(tenantId)) {
        return apiError(res, 'Tenant not found', 404, 'NOT_FOUND');
      }

      const test = recoveryService.runRecoveryTest(tenantId);
      json(res, test, 201);
    })
  );
}
