import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requireRuntimeAuth } from '../../../middleware/runtime-auth.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { queryExecutionStore } from '../../../modules/query-execution/query-execution-store.js';
import type { ReportExecutionResultInput } from '../../../modules/query-execution/types.js';

/**
 * Runtime-facing endpoints reuse the same JWT session auth (requireRuntimeAuth)
 * as runtime-connector-execution — the query execution's Runtime is resolved
 * from the underlying ERP connection profile, so a Runtime session token is
 * exactly the credential already in hand, matching that module's precedent.
 */
export function registerQueryExecutionRuntimeRoutes(router: Router): void {
  // ─── GET /runtime/query-execution/jobs ────────────────────────────────────
  router.get(
    '/runtime/query-execution/jobs',
    requireRuntimeAuth(async (ctx: RouteContext, res: ServerResponse) => {
      const executions = queryExecutionStore.claimExecutionsForRuntime(ctx.runtimeId as string);
      json(res, {
        total: executions.length,
        executions: executions.map((e) => ({
          id: e.id,
          sql: e.sql,
          dialect: e.dialect,
          parameters: e.parameters,
          timeoutMs: e.timeoutMs,
        })),
      });
    })
  );

  // ─── POST /runtime/query-execution/result ─────────────────────────────────
  router.post(
    '/runtime/query-execution/result',
    requireRuntimeAuth(async (ctx: RouteContext, res: ServerResponse) => {
      const body = (ctx.body as Partial<ReportExecutionResultInput> | undefined) ?? {};
      const { executionId, success } = body;
      if (!executionId || success === undefined) {
        return apiError(res, 'executionId and success are required', 422, 'VALIDATION_ERROR');
      }

      const result = await queryExecutionStore.reportResult({
        ...(body as ReportExecutionResultInput),
        runtimeId: ctx.runtimeId as string,
      });
      if (!result.ok) {
        const status = result.error === 'EXECUTION_NOT_FOUND' ? 404 : 409;
        return apiError(res, `Result report rejected: ${result.error}`, status, result.error);
      }

      if (
        !result.alreadyReported &&
        (result.execution.status === 'COMPLETED' || result.execution.status === 'FAILED')
      ) {
        adminIdentityStore.recordAudit({
          action:
            result.execution.status === 'COMPLETED'
              ? 'QUERY_EXECUTION_COMPLETED'
              : 'QUERY_EXECUTION_FAILED',
          actorEmail: 'runtime-installer@system',
          target: result.execution.id,
          metadata: { runtimeId: ctx.runtimeId, totalRows: result.execution.totalRows },
        });
      }
      json(res, {
        execution: queryExecutionStore.toDTO(result.execution),
        alreadyReported: result.alreadyReported,
      });
    })
  );
}
