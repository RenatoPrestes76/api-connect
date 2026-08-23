import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { semanticMappingStore } from '../../../modules/semantic-mapping/semantic-mapping-store.js';
import type { AnalyzeError } from '../../../modules/semantic-mapping/types.js';
import { parseBody } from '../../../http/validation.js';
import { AnalyzeBodySchema } from './schemas.js';

const ANALYZE_ERROR_STATUS: Record<AnalyzeError, { status: number; message: string }> = {
  NOT_DISCOVERED: {
    status: 404,
    message:
      'No schema has been discovered for this profile yet — run POST /erp-metadata/discover first',
  },
};

/** POST /semantic-mapping/analyze — refines the erp-metadata (46.9) classification into business-entity suggestions. */
export function registerSemanticMappingAnalyzeRoute(router: Router): void {
  router.post(
    '/semantic-mapping/analyze',
    requirePermission('semantic-mapping.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = parseBody(AnalyzeBodySchema, ctx, res);
      if (!body) return;

      const actorEmail = ctx.adminEmail ?? 'unknown';
      const result = semanticMappingStore.analyze(body.profileId, actorEmail);
      if (!result.ok) {
        const mapped = ANALYZE_ERROR_STATUS[result.error];
        return apiError(res, mapped.message, mapped.status, result.error);
      }

      adminIdentityStore.recordAudit({
        action: 'SEMANTIC_MAPPING_ANALYZED',
        actorEmail,
        target: body.profileId,
        metadata: { summary: result.summary },
      });
      json(res, { summary: result.summary });
    })
  );
}
