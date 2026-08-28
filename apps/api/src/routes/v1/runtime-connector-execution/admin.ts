import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { runtimeConnectorExecutionStore } from '../../../modules/runtime-connector-execution/runtime-connector-execution-store.js';
import { adminIdentityStore } from '../../../modules/admin-identity/admin-identity-store.js';
import type {
  ExecutionLifecycleStatus,
  RollbackExecutionError,
} from '../../../modules/runtime-connector-execution/types.js';

const ROLLBACK_ERROR_STATUS: Record<RollbackExecutionError, { status: number; message: string }> = {
  EXECUTION_NOT_FOUND: { status: 404, message: 'Execution plan not found' },
  ACTION_NOT_REVERSIBLE: {
    status: 409,
    message: 'This action has no defined rollback behavior',
  },
  EXECUTION_NOT_TERMINAL_SUCCESS: {
    status: 409,
    message: 'Only a successfully completed execution can be rolled back',
  },
  ALREADY_ROLLED_BACK: { status: 409, message: 'This execution was already rolled back' },
};

export function registerConnectorExecutionAdminRoutes(router: Router): void {
  // ─── GET /runtime/connectors/executions ──────────────────────────────────
  router.get(
    '/runtime/connectors/executions',
    requirePermission('runtime-connector-execution.read')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const runtimeId = ctx.query.get('runtimeId') ?? undefined;
        const organizationId = ctx.query.get('organizationId') ?? undefined;
        const status = (ctx.query.get('status') as ExecutionLifecycleStatus | null) ?? undefined;
        const plans = runtimeConnectorExecutionStore.listExecutions({
          runtimeId,
          organizationId,
          status,
        });
        json(res, {
          total: plans.length,
          plans: plans.map((p) => runtimeConnectorExecutionStore.toDTO(p)),
        });
      }
    )
  );

  // ─── GET /runtime/connectors/executions/:id ──────────────────────────────
  router.get(
    '/runtime/connectors/executions/:id',
    requirePermission('runtime-connector-execution.read')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const plan = runtimeConnectorExecutionStore.getExecution(ctx.params['id'] as string);
        if (!plan) return apiError(res, 'Execution plan not found', 404, 'NOT_FOUND');
        json(res, { plan: runtimeConnectorExecutionStore.toDTO(plan) });
      }
    )
  );

  // ─── POST /runtime/connectors/executions/:id/rollback ────────────────────
  router.post(
    '/runtime/connectors/executions/:id/rollback',
    requirePermission('runtime-connector-execution.write')(
      async (ctx: RouteContext, res: ServerResponse) => {
        const id = ctx.params['id'] as string;
        const result = await runtimeConnectorExecutionStore.rollbackExecution(
          id,
          ctx.adminEmail ?? 'unknown'
        );
        if (!result.ok) {
          const mapped = ROLLBACK_ERROR_STATUS[result.error];
          return apiError(res, mapped.message, mapped.status, result.error);
        }

        adminIdentityStore.recordAudit({
          action: 'EXECUTION_ROLLED_BACK',
          actorEmail: ctx.adminEmail ?? 'unknown',
          target: id,
          metadata: { rollbackExecutionId: result.plan.id },
        });
        json(res, { plan: runtimeConnectorExecutionStore.toDTO(result.plan) }, 201);
      }
    )
  );
}
