import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { operationsStore } from '../../../modules/operations/operations-store.js';
import { healthEngine } from '../../../modules/operations/health-engine.js';
import type { ActionResult, ActionType } from '../../../modules/operations/types.js';

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildResult(
  action: ActionType,
  target: string,
  tenantId: string,
  message: string
): ActionResult {
  return {
    actionId: genId('act'),
    action,
    target,
    tenantId,
    success: true,
    message,
    executedAt: new Date().toISOString(),
    executedBy: 'admin',
  };
}

export function registerOperationsActionsRoutes(router: { post: Function }): void {
  // POST /restart-agent
  router.post(
    '/api/v1/operations/actions/restart-agent',
    (ctx: RouteContext, res: ServerResponse) => {
      const body = (ctx.body as any) ?? {};
      const { tenantId, agentId } = body;

      if (!tenantId) return apiError(res, '"tenantId" is required', 400, 'MISSING_FIELDS');
      if (!agentId) return apiError(res, '"agentId" is required', 400, 'MISSING_FIELDS');

      const tenant = operationsStore.getTenant(tenantId);
      if (!tenant) return apiError(res, 'Tenant not found', 404, 'NOT_FOUND');

      // Simulate restart — mark agent as healthy
      operationsStore.upsertHealthCheck({
        componentType: 'agent',
        componentId: agentId,
        tenantId,
        status: 'healthy',
        message: 'Restarted by admin',
      });

      // Resolve any critical alerts for this agent
      const agentAlerts = operationsStore
        .getAlerts(tenantId, { resolved: false })
        .filter((a) => a.componentId === agentId);
      agentAlerts.forEach((a) => operationsStore.resolveAlert(a.id));

      operationsStore.addEvent({
        tenantId,
        event: 'agent.restarted',
        severity: 'info',
        payload: { agentId, restartedBy: 'admin' },
      });

      const result = buildResult(
        'restart-agent',
        agentId,
        tenantId,
        `Agent ${agentId} restarted successfully`
      );
      operationsStore.addAction(result);
      json(res, result);
    }
  );

  // POST /retry
  router.post('/api/v1/operations/actions/retry', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { tenantId, connectorId, jobId } = body;

    if (!tenantId) return apiError(res, '"tenantId" is required', 400, 'MISSING_FIELDS');
    if (!connectorId && !jobId)
      return apiError(res, '"connectorId" or "jobId" is required', 400, 'MISSING_FIELDS');

    const tenant = operationsStore.getTenant(tenantId);
    if (!tenant) return apiError(res, 'Tenant not found', 404, 'NOT_FOUND');

    const target = connectorId ?? jobId;
    operationsStore.addEvent({
      tenantId,
      event: 'retry.initiated',
      severity: 'info',
      payload: { target, retriedBy: 'admin' },
    });

    const result = buildResult('retry', target, tenantId, `Retry initiated for ${target}`);
    operationsStore.addAction(result);
    json(res, result);
  });

  // POST /run-health
  router.post('/api/v1/operations/actions/run-health', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { tenantId } = body;

    const checks = healthEngine.runHealthCheck(tenantId ?? undefined);

    operationsStore.addEvent({
      tenantId: tenantId ?? 'system',
      event: 'health.check.ran',
      severity: 'info',
      payload: { checksRan: checks.length, tenantId: tenantId ?? 'all' },
    });

    const result = buildResult(
      'run-health',
      tenantId ?? 'all',
      tenantId ?? 'system',
      `Health check completed: ${checks.length} components checked`
    );
    operationsStore.addAction(result);
    json(res, { ...result, checksRan: checks.length, checks });
  });

  // POST /sync
  router.post('/api/v1/operations/actions/sync', (ctx: RouteContext, res: ServerResponse) => {
    const body = (ctx.body as any) ?? {};
    const { tenantId, scope = 'full' } = body;

    if (!tenantId) return apiError(res, '"tenantId" is required', 400, 'MISSING_FIELDS');

    const tenant = operationsStore.getTenant(tenantId);
    if (!tenant) return apiError(res, 'Tenant not found', 404, 'NOT_FOUND');

    operationsStore.addEvent({
      tenantId,
      event: 'sync.initiated',
      severity: 'info',
      payload: { scope, syncedBy: 'admin' },
    });

    const result = buildResult(
      'sync',
      tenantId,
      tenantId,
      `Configuration sync completed for ${tenant.name} (scope: ${scope})`
    );
    operationsStore.addAction(result);
    json(res, result);
  });
}
