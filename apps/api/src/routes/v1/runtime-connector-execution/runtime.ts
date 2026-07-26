import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireRuntimeAuth } from '../../../middleware/runtime-auth.js';
import { runtimeConnectorExecutionStore } from '../../../modules/runtime-connector-execution/runtime-connector-execution-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import type { ReportExecutionResultInput } from '../../../modules/runtime-connector-execution/types.js';

/**
 * Runtime-facing endpoints reuse Sprint 46.7's JWT session auth
 * (requireRuntimeAuth) rather than per-request Ed25519 signing — the
 * explicit reuse this sprint calls for, since a Runtime already holds a
 * session token from GET /erp-connectivity/runtime/profiles-style flows.
 */
export function registerConnectorRuntimeRoutes(router: Router): void {
  // ─── GET /runtime/connectors/jobs ────────────────────────────────────────
  router.get(
    '/runtime/connectors/jobs',
    requireRuntimeAuth(async (ctx: RouteContext, res: ServerResponse) => {
      const plans = runtimeConnectorExecutionStore.claimExecutionsForRuntime(
        ctx.runtimeId as string
      );
      json(res, {
        total: plans.length,
        plans: plans.map((p) => runtimeConnectorExecutionStore.toDTO(p)),
      });
    })
  );

  // ─── POST /runtime/connectors/result ─────────────────────────────────────
  router.post(
    '/runtime/connectors/result',
    requireRuntimeAuth(async (ctx: RouteContext, res: ServerResponse) => {
      const body = (ctx.body as Partial<ReportExecutionResultInput> | undefined) ?? {};
      const { executionId, success } = body;
      if (!executionId || success === undefined) {
        return apiError(res, 'executionId and success are required', 422, 'VALIDATION_ERROR');
      }

      const result = await runtimeConnectorExecutionStore.reportResult({
        ...(body as ReportExecutionResultInput),
        runtimeId: ctx.runtimeId as string,
      });
      if (!result.ok) {
        const status = result.error === 'EXECUTION_NOT_FOUND' ? 404 : 409;
        return apiError(res, `Result report rejected: ${result.error}`, status, result.error);
      }

      if (!result.alreadyReported) {
        adminIdentityStore.recordAudit({
          action: 'EXECUTION_RESULT_REPORTED',
          actorEmail: 'runtime-installer@system',
          target: result.plan.id,
          metadata: { runtimeId: ctx.runtimeId, status: result.plan.status },
        });
      }
      json(res, {
        plan: runtimeConnectorExecutionStore.toDTO(result.plan),
        alreadyReported: result.alreadyReported,
      });
    })
  );
}
