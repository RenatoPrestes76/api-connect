import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { semanticMappingStore } from '../../../modules/semantic-mapping/semantic-mapping-store.js';
import type { MappingStatus } from '../../../modules/semantic-mapping/types.js';

const VALID_STATUSES: readonly MappingStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

/** GET /semantic-mapping/review — mappings awaiting a human decision (defaults to PENDING). */
export function registerSemanticMappingReviewRoute(router: Router): void {
  router.get(
    '/semantic-mapping/review',
    requirePermission('semantic-mapping.read')(async (ctx: RouteContext, res: ServerResponse) => {
      const profileId = ctx.query.get('profileId');
      if (!profileId) {
        return apiError(res, 'profileId query parameter is required', 422, 'VALIDATION_ERROR');
      }

      const statusParam = ctx.query.get('status');
      const status = (statusParam as MappingStatus | null) ?? 'PENDING';
      if (!VALID_STATUSES.includes(status)) {
        return apiError(
          res,
          `status must be one of: ${VALID_STATUSES.join(', ')}`,
          422,
          'VALIDATION_ERROR'
        );
      }

      const records = semanticMappingStore.listForReview(profileId, status);
      json(res, {
        profileId,
        status,
        total: records.length,
        mappings: records.map((r) => semanticMappingStore.toDTO(r)),
      });
    })
  );
}
