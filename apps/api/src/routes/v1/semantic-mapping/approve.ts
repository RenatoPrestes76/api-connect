import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { semanticMappingStore } from '../../../modules/semantic-mapping/semantic-mapping-store.js';
import { ALL_BUSINESS_ENTITY_TYPES } from '../../../modules/semantic-mapping/types.js';
import type {
  ApproveDecision,
  ApproveError,
  BusinessEntityType,
} from '../../../modules/semantic-mapping/types.js';

const APPROVE_ERROR_STATUS: Record<ApproveError, { status: number; message: string }> = {
  NOT_ANALYZED: {
    status: 404,
    message:
      'No mapping suggestion exists for this table — run POST /semantic-mapping/analyze first',
  },
  INVALID_ENTITY: {
    status: 422,
    message: `entity must be one of: ${ALL_BUSINESS_ENTITY_TYPES.join(', ')}`,
  },
};

interface ApproveBody {
  profileId?: string;
  schema?: string;
  table?: string;
  decision?: ApproveDecision;
  entity?: BusinessEntityType;
}

/** POST /semantic-mapping/approve — human decision on a suggested mapping (approve as-is, override, or reject). */
export function registerSemanticMappingApproveRoute(router: Router): void {
  router.post(
    '/semantic-mapping/approve',
    requirePermission('semantic-mapping.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = (ctx.body as ApproveBody | undefined) ?? {};
      const { profileId, schema, table, decision } = body;
      if (!profileId || !schema || !table || !decision) {
        return apiError(
          res,
          'profileId, schema, table, and decision are required',
          422,
          'VALIDATION_ERROR'
        );
      }
      if (decision !== 'APPROVE' && decision !== 'REJECT') {
        return apiError(res, "decision must be 'APPROVE' or 'REJECT'", 422, 'VALIDATION_ERROR');
      }

      const actorEmail = ctx.adminEmail ?? 'unknown';
      const result = semanticMappingStore.decide({
        profileId,
        schema,
        table,
        decision,
        entity: body.entity,
        actorEmail,
      });
      if (!result.ok) {
        const mapped = APPROVE_ERROR_STATUS[result.error];
        return apiError(res, mapped.message, mapped.status, result.error);
      }

      adminIdentityStore.recordAudit({
        action: decision === 'APPROVE' ? 'SEMANTIC_MAPPING_APPROVED' : 'SEMANTIC_MAPPING_REJECTED',
        actorEmail,
        target: `${profileId}:${schema}.${table}`,
        metadata: { entity: result.record.approvedEntity ?? result.record.suggestedEntity },
      });
      json(res, { mapping: semanticMappingStore.toDTO(result.record) });
    })
  );
}
