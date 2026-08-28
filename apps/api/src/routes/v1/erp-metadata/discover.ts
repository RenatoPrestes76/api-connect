import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { erpMetadataStore } from '../../../modules/erp-metadata/erp-metadata-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import type { CreateDiscoveryError } from '../../../modules/erp-metadata/types.js';
import { parseBody } from '../../../http/validation.js';
import { CreateDiscoveryBodySchema } from './schemas.js';

const CREATE_ERROR_STATUS: Record<CreateDiscoveryError, { status: number; message: string }> = {
  RUNTIME_NOT_FOUND: { status: 404, message: 'Runtime not found' },
  RUNTIME_ORGANIZATION_MISMATCH: {
    status: 403,
    message: 'This Runtime does not belong to the given organizationId',
  },
  PROFILE_NOT_FOUND: { status: 404, message: 'Connection profile not found' },
  PROFILE_RUNTIME_MISMATCH: {
    status: 409,
    message: 'This connection profile does not belong to the given Runtime',
  },
};

/** POST /erp-metadata/discover — requests a full schema scan; the Runtime performs the actual introspection and reports back. */
export function registerErpMetadataDiscoverRoute(router: Router): void {
  router.post(
    '/erp-metadata/discover',
    requirePermission('erp-metadata.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = parseBody(CreateDiscoveryBodySchema, ctx, res);
      if (!body) return;
      const { runtimeId, organizationId, profileId } = body;

      const result = await erpMetadataStore.createDiscoveryRequest({
        runtimeId,
        organizationId,
        profileId,
        timeoutMs: body.timeoutMs,
        maxAttempts: body.maxAttempts,
        createdBy: ctx.adminEmail ?? 'unknown',
      });
      if (!result.ok) {
        const mapped = CREATE_ERROR_STATUS[result.error];
        return apiError(res, mapped.message, mapped.status, result.error);
      }

      adminIdentityStore.recordAudit({
        action: 'METADATA_DISCOVERY_REQUESTED',
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: result.request.id,
        metadata: { runtimeId, organizationId, profileId },
      });
      json(res, { request: erpMetadataStore.toDTO(result.request) }, 201);
    })
  );
}
