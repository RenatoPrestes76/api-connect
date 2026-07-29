import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import { queryExecutionStore } from '../../../modules/query-execution/query-execution-store.js';
import type { CancelExecutionError } from '../../../modules/query-execution/types.js';

const CANCEL_ERROR_STATUS: Record<CancelExecutionError, { status: number; message: string }> = {
  EXECUTION_NOT_FOUND: { status: 404, message: 'Execution not found' },
  EXECUTION_ORGANIZATION_MISMATCH: { status: 404, message: 'Execution not found' },
  EXECUTION_ALREADY_TERMINAL: {
    status: 409,
    message: 'This execution has already finished and cannot be cancelled',
  },
};

interface CancelBody {
  organizationId?: string;
}

/** POST /query-execution/:id/cancel — best-effort: marks a non-terminal execution CANCELLED so a late Runtime result is ignored. Cannot force-kill an already-running query on the ERP itself. */
export function registerQueryExecutionCancelRoute(router: Router): void {
  router.post(
    '/query-execution/:id/cancel',
    requirePermission('query-execution.write')(async (ctx: RouteContext, res: ServerResponse) => {
      const body = (ctx.body as CancelBody | undefined) ?? {};
      if (!body.organizationId) {
        return apiError(res, 'organizationId is required', 422, 'VALIDATION_ERROR');
      }

      const result = queryExecutionStore.cancelExecution(
        ctx.params['id'] as string,
        body.organizationId
      );
      if (!result.ok) {
        const mapped = CANCEL_ERROR_STATUS[result.error];
        return apiError(res, mapped.message, mapped.status, result.error);
      }

      adminIdentityStore.recordAudit({
        action: 'QUERY_EXECUTION_CANCELLED',
        actorEmail: ctx.adminEmail ?? 'unknown',
        target: result.execution.id,
        metadata: { organizationId: body.organizationId },
      });
      json(res, { execution: queryExecutionStore.toDTO(result.execution) });
    })
  );
}
