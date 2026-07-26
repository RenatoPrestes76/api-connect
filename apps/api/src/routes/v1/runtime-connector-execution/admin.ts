import type { ServerResponse } from 'node:http';
import type { Router, RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { requirePermission } from '../../../middleware/admin-auth.js';
import { runtimeConnectorExecutionStore } from '../../../modules/runtime-connector-execution/runtime-connector-execution-store.js';
import type { ExecutionLifecycleStatus } from '../../../modules/runtime-connector-execution/types.js';

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
}
