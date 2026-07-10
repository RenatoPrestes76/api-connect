/**
 * Sprint 29 — ORCHESTRATOR
 * Execution history, step logs and cancellation routes.
 */
import type { ServerResponse } from 'node:http';
import type { RouteContext } from '../../../http/router.js';
import { json, apiError } from '../../../http/router.js';
import { orchestratorStore } from '../../../modules/orchestrator/orchestrator-store.js';

// ─── List executions ──────────────────────────────────────────────────────────

export async function listExecutions(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const q = ctx.query;
  const workflowId = q.get('workflowId');
  const status = q.get('status');
  const limit = Math.min(100, Math.max(1, parseInt(q.get('limit') ?? '20', 10)));
  const offset = Math.max(0, parseInt(q.get('offset') ?? '0', 10));

  let execs = orchestratorStore.executions;
  if (workflowId) execs = execs.filter((e) => e.workflowId === workflowId);
  if (status) execs = execs.filter((e) => e.status === status);

  const total = execs.length;
  json(res, { data: execs.slice(offset, offset + limit), total });
}

// ─── Get execution ────────────────────────────────────────────────────────────

export async function getExecution(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const exec = orchestratorStore.executions.find((e) => e.id === ctx.params['id']);
  if (!exec) {
    apiError(res, 'Execution not found', 404, 'NOT_FOUND');
    return;
  }
  json(res, exec);
}

// ─── Get execution steps ──────────────────────────────────────────────────────

export async function getExecutionSteps(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const exec = orchestratorStore.executions.find((e) => e.id === ctx.params['id']);
  if (!exec) {
    apiError(res, 'Execution not found', 404, 'NOT_FOUND');
    return;
  }
  json(res, exec.steps);
}

// ─── Cancel execution ─────────────────────────────────────────────────────────

export async function cancelExecution(ctx: RouteContext, res: ServerResponse): Promise<void> {
  const exec = orchestratorStore.executions.find((e) => e.id === ctx.params['id']);
  if (!exec) {
    apiError(res, 'Execution not found', 404, 'NOT_FOUND');
    return;
  }
  if (exec.status !== 'RUNNING' && exec.status !== 'PENDING') {
    apiError(res, 'Execution is not running', 409, 'INVALID_STATE');
    return;
  }
  exec.status = 'CANCELLED';
  exec.finishedAt = new Date().toISOString();
  if (exec.startedAt) {
    exec.durationMs = Date.now() - Date.parse(exec.startedAt);
  }
  json(res, exec);
}

// ─── Execution stats ──────────────────────────────────────────────────────────

export async function executionStats(_ctx: RouteContext, res: ServerResponse): Promise<void> {
  const execs = orchestratorStore.executions;
  const total = execs.length;
  const running = execs.filter((e) => e.status === 'RUNNING').length;
  const completed = execs.filter((e) => e.status === 'COMPLETED').length;
  const failed = execs.filter((e) => e.status === 'FAILED').length;
  const cancelled = execs.filter((e) => e.status === 'CANCELLED').length;

  const completed24h = execs.filter((e) => {
    const age = Date.now() - Date.parse(e.startedAt);
    return e.status === 'COMPLETED' && age < 86_400_000;
  }).length;

  const failed24h = execs.filter((e) => {
    const age = Date.now() - Date.parse(e.startedAt);
    return e.status === 'FAILED' && age < 86_400_000;
  }).length;

  const withDuration = execs.filter((e) => e.durationMs);
  const avgDurationMs = withDuration.length
    ? Math.round(withDuration.reduce((s, e) => s + (e.durationMs ?? 0), 0) / withDuration.length)
    : 0;

  json(res, {
    total,
    running,
    completed,
    failed,
    cancelled,
    completed24h,
    failed24h,
    avgDurationMs,
  });
}
