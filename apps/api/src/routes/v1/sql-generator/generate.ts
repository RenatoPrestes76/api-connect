import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { sqlGeneratorStore } from '../../../modules/sql-generator/sql-generator-store.js';
import type { GenerateSqlInput } from '../../../modules/sql-generator/types.js';

/** POST /sql-generator/generate — turns a Universal Query Plan into native, parameterized SQL. Nothing is executed here — that's Sprint 46.14. */
export function registerSqlGeneratorGenerateRoute(router: Router): void {
  router.post(
    '/sql-generator/generate',
    requirePermission('sql-generator.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = (ctx.body as GenerateSqlInput | undefined) ?? {};
      if (!body.organizationId) {
        return apiError(res, 'organizationId is required', 422, 'VALIDATION_ERROR');
      }

      const actorEmail = ctx.adminEmail ?? 'unknown';
      const result = await sqlGeneratorStore.generate(body, body.organizationId, actorEmail);
      if (!result.ok) {
        return json(res, { valid: false, errors: result.errors }, 422);
      }

      adminIdentityStore.recordAudit({
        action: 'SQL_QUERY_GENERATED',
        actorEmail,
        target: result.record.id,
        metadata: {
          organizationId: result.record.organizationId,
          queryPlanId: result.record.queryPlanId,
          dialect: result.record.dialect,
          canonicalVersion: result.record.canonicalVersion,
        },
      });
      json(res, { query: result.record }, 201);
    })
  );
}
