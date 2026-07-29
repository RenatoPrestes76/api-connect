import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { queryExecutionStore } from '../../../modules/query-execution/query-execution-store.js';
import type { CreateExecutionError } from '../../../modules/query-execution/types.js';

const CREATE_ERROR_STATUS: Record<CreateExecutionError, { status: number; message: string }> = {
  GENERATED_QUERY_NOT_FOUND: { status: 404, message: 'No generated query found with that id' },
  GENERATED_QUERY_ORGANIZATION_MISMATCH: {
    status: 409,
    message: 'This generated query does not belong to this organization',
  },
  CONNECTION_PROFILE_NOT_FOUND: {
    status: 404,
    message: 'The ERP connection profile for this query no longer exists',
  },
  RUNTIME_NOT_FOUND: {
    status: 404,
    message: 'The Runtime for this ERP connection no longer exists',
  },
  RUNTIME_OFFLINE: {
    status: 503,
    message:
      'The Runtime for this ERP connection has not sent a heartbeat recently and is considered offline',
  },
};

interface ExecuteBody {
  organizationId?: string;
  generatedQueryId?: string;
  maxAttempts?: number;
  timeoutMs?: number;
}

/** POST /query-execution/execute — dispatches an already-generated SQL query (46.13) to the Runtime that owns its ERP connection. The Control Plane never talks to the ERP database directly. */
export function registerQueryExecutionExecuteRoute(router: Router): void {
  router.post(
    '/query-execution/execute',
    requirePermission('query-execution.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = (ctx.body as ExecuteBody | undefined) ?? {};
      if (!body.organizationId || !body.generatedQueryId) {
        return apiError(
          res,
          'organizationId and generatedQueryId are required',
          422,
          'VALIDATION_ERROR'
        );
      }

      const actorEmail = ctx.adminEmail ?? 'unknown';
      const result = queryExecutionStore.createExecution({
        organizationId: body.organizationId,
        generatedQueryId: body.generatedQueryId,
        requestedBy: actorEmail,
        maxAttempts: body.maxAttempts,
        timeoutMs: body.timeoutMs,
      });
      if (!result.ok) {
        const mapped = CREATE_ERROR_STATUS[result.error];
        return apiError(res, mapped.message, mapped.status, result.error);
      }

      adminIdentityStore.recordAudit({
        action: 'QUERY_EXECUTION_REQUESTED',
        actorEmail,
        target: result.execution.id,
        metadata: {
          organizationId: body.organizationId,
          generatedQueryId: body.generatedQueryId,
          runtimeId: result.execution.runtimeId,
        },
      });
      json(res, { execution: queryExecutionStore.toDTO(result.execution) }, 201);
    })
  );
}
