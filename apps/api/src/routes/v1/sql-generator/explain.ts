import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { sqlGeneratorStore } from '../../../modules/sql-generator/sql-generator-store.js';
import type { GenerateSqlInput } from '../../../modules/sql-generator/types.js';

/** POST /sql-generator/explain — dry-run: returns the SQL, parameters, dialect, estimated cost, and logical plan without persisting a GeneratedQuery. */
export function registerSqlGeneratorExplainRoute(router: Router): void {
  router.post(
    '/sql-generator/explain',
    requirePermission('sql-generator.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = (ctx.body as GenerateSqlInput | undefined) ?? {};
      if (!body.organizationId) {
        return apiError(res, 'organizationId is required', 422, 'VALIDATION_ERROR');
      }

      const outcome = await sqlGeneratorStore.explain(body, body.organizationId);
      if (!outcome.ok) {
        return json(res, { valid: false, errors: outcome.errors }, 422);
      }
      json(res, outcome.result);
    })
  );
}
