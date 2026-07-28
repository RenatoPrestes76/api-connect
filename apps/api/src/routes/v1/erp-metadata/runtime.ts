import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireRuntimeAuth } from '../../../middleware/runtime-auth.js';
import { erpMetadataStore } from '../../../modules/erp-metadata/erp-metadata-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import type { ReportSchemaInput } from '../../../modules/erp-metadata/types.js';

/**
 * Runtime-facing endpoints — JWT session auth (Sprint 46.7's
 * requireRuntimeAuth), matching runtime-connector-execution's convention for
 * "Runtime executes something complex and reports back" rather than
 * per-request Ed25519 signing.
 */
export function registerErpMetadataRuntimeRoutes(router: Router): void {
  // ─── GET /erp-metadata/runtime/jobs ──────────────────────────────────────
  router.get(
    '/erp-metadata/runtime/jobs',
    requireRuntimeAuth(async (ctx: RouteContext, res: ServerResponse) => {
      const requests = erpMetadataStore.claimRequestsForRuntime(ctx.runtimeId as string);
      json(res, {
        total: requests.length,
        requests: requests.map((r) => erpMetadataStore.toDTO(r)),
      });
    })
  );

  // ─── POST /erp-metadata/runtime/result ───────────────────────────────────
  router.post(
    '/erp-metadata/runtime/result',
    requireRuntimeAuth(async (ctx: RouteContext, res: ServerResponse) => {
      const body = (ctx.body as Partial<ReportSchemaInput> | undefined) ?? {};
      const { requestId, success } = body;
      if (!requestId || success === undefined) {
        return apiError(res, 'requestId and success are required', 422, 'VALIDATION_ERROR');
      }

      const result = await erpMetadataStore.reportSchema({
        ...(body as ReportSchemaInput),
        runtimeId: ctx.runtimeId as string,
      });
      if (!result.ok) {
        const status = result.error === 'REQUEST_NOT_FOUND' ? 404 : 409;
        return apiError(res, `Schema report rejected: ${result.error}`, status, result.error);
      }

      if (result.request.status === 'COMPLETED') {
        adminIdentityStore.recordAudit({
          action: 'METADATA_DISCOVERY_COMPLETED',
          actorEmail: 'runtime-installer@system',
          target: result.request.id,
          metadata: { runtimeId: ctx.runtimeId, reused: result.reused },
        });
      } else if (result.request.status === 'FAILED' || result.request.status === 'TIMEOUT') {
        adminIdentityStore.recordAudit({
          action: 'METADATA_DISCOVERY_FAILED',
          actorEmail: 'runtime-installer@system',
          target: result.request.id,
          metadata: { runtimeId: ctx.runtimeId, error: result.request.error },
        });
      }
      json(res, { request: erpMetadataStore.toDTO(result.request), reused: result.reused });
    })
  );
}
