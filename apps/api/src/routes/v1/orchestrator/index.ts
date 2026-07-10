/**
 * Sprint 29 — ORCHESTRATOR
 * Registers all orchestrator routes under /api/v1/orchestrator/**
 * Additive — does not modify Sprint 22–28 routes.
 */
import type { Router } from '../../../http/router.js';
import {
  listWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  activateWorkflow,
  deactivateWorkflow,
  runWorkflow,
  listWorkflowVersions,
} from './workflows.js';
import {
  listExecutions,
  getExecution,
  getExecutionSteps,
  cancelExecution,
  executionStats,
} from './executions.js';
import { getQueue, getDlq, retryDlqJob, purgeDlq } from './queue-routes.js';

export function registerOrchestratorRoutes(router: Router): void {
  // ── Workflows ──────────────────────────────────────────────────────────────
  router.get('/api/v1/orchestrator/workflows', listWorkflows);
  router.post('/api/v1/orchestrator/workflows', createWorkflow);
  router.get('/api/v1/orchestrator/workflows/:id', getWorkflow);
  router.put('/api/v1/orchestrator/workflows/:id', updateWorkflow);
  router.delete('/api/v1/orchestrator/workflows/:id', deleteWorkflow);
  router.post('/api/v1/orchestrator/workflows/:id/activate', activateWorkflow);
  router.post('/api/v1/orchestrator/workflows/:id/deactivate', deactivateWorkflow);
  router.post('/api/v1/orchestrator/workflows/:id/run', runWorkflow);
  router.get('/api/v1/orchestrator/workflows/:id/versions', listWorkflowVersions);

  // ── Executions ────────────────────────────────────────────────────────────
  router.get('/api/v1/orchestrator/executions', listExecutions);
  router.get('/api/v1/orchestrator/executions/stats', executionStats);
  router.get('/api/v1/orchestrator/executions/:id', getExecution);
  router.get('/api/v1/orchestrator/executions/:id/steps', getExecutionSteps);
  router.post('/api/v1/orchestrator/executions/:id/cancel', cancelExecution);

  // ── Queue ─────────────────────────────────────────────────────────────────
  router.get('/api/v1/orchestrator/queue', getQueue);
  router.get('/api/v1/orchestrator/queue/dlq', getDlq);
  router.post('/api/v1/orchestrator/queue/dlq/:jobId/retry', retryDlqJob);
  router.delete('/api/v1/orchestrator/queue/dlq', purgeDlq);
}
