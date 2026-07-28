import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { canonicalModelStore } from '../../../modules/canonical-model/canonical-model-store.js';
import type { RollbackError } from '../../../modules/canonical-model/types.js';
import { serializeModel } from './serialize.js';

const ROLLBACK_ERROR_STATUS: Record<RollbackError, { status: number; message: string }> = {
  MODEL_NOT_FOUND: { status: 404, message: 'No canonical model version found with that id' },
  MODEL_ORGANIZATION_MISMATCH: {
    status: 409,
    message: 'This canonical model version does not belong to the given organizationId',
  },
};

interface RollbackBody {
  organizationId?: string;
  targetModelId?: string;
}

/**
 * POST /canonical-model/rollback — restores an older model version as the
 * new latest (and immediately re-approves it). Nothing is destroyed: every
 * version, including the one just superseded, stays in history. Not part of
 * the literal spec's endpoint list, but explicitly required by its own test
 * coverage ("rollback"), so exposed as a small additive endpoint alongside
 * GET .../history.
 */
export function registerCanonicalModelRollbackRoute(router: Router): void {
  router.post(
    '/canonical-model/rollback',
    requirePermission('canonical-model.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = (ctx.body as RollbackBody | undefined) ?? {};
      if (!body.organizationId || !body.targetModelId) {
        return apiError(
          res,
          'organizationId and targetModelId are required',
          422,
          'VALIDATION_ERROR'
        );
      }

      const result = await canonicalModelStore.rollback(body.organizationId, body.targetModelId);
      if (!result.ok) {
        const mapped = ROLLBACK_ERROR_STATUS[result.error];
        return apiError(res, mapped.message, mapped.status, result.error);
      }

      adminIdentityStore.recordAudit({
        action: 'CANONICAL_MODEL_ROLLED_BACK',
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: `${body.organizationId}:${result.model.id}`,
        metadata: {
          restoredFrom: body.targetModelId,
          version: result.model.version,
          diffHasChanges: result.diff.hasChanges,
        },
      });
      json(res, { model: serializeModel(result.model), diff: result.diff });
    })
  );
}
