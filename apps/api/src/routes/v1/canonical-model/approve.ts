import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { canonicalModelStore } from '../../../modules/canonical-model/canonical-model-store.js';
import type { ApproveModelError } from '../../../modules/canonical-model/types.js';
import { serializeModel } from './serialize.js';

const APPROVE_ERROR_STATUS: Record<ApproveModelError, { status: number; message: string }> = {
  MODEL_NOT_FOUND: { status: 404, message: 'No canonical model found with that id' },
  MODEL_ORGANIZATION_MISMATCH: {
    status: 409,
    message: 'This canonical model does not belong to the given organizationId',
  },
};

interface ApproveBody {
  organizationId?: string;
  modelId?: string;
}

/** POST /canonical-model/approve — marks a built model version as the official one other Atlas modules should consume. */
export function registerCanonicalModelApproveRoute(router: Router): void {
  router.post(
    '/canonical-model/approve',
    requirePermission('canonical-model.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = (ctx.body as ApproveBody | undefined) ?? {};
      if (!body.organizationId || !body.modelId) {
        return apiError(res, 'organizationId and modelId are required', 422, 'VALIDATION_ERROR');
      }

      const result = await canonicalModelStore.approve(body.organizationId, body.modelId);
      if (!result.ok) {
        const mapped = APPROVE_ERROR_STATUS[result.error];
        return apiError(res, mapped.message, mapped.status, result.error);
      }

      adminIdentityStore.recordAudit({
        action: 'CANONICAL_MODEL_APPROVED',
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: `${body.organizationId}:${body.modelId}`,
        metadata: { version: result.model.version },
      });
      json(res, { model: serializeModel(result.model) });
    })
  );
}
