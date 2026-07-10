/**
 * Sprint 29 — ORCHESTRATOR
 * Service layer for workflow API calls.
 */
import { api } from './api-client';
import type {
  Workflow,
  WorkflowVersion,
  WorkflowExecution,
  ExecutionStats,
  QueueState,
  TriggerType,
  WorkflowGraph,
} from '@/types/workflow';

const BASE = '/api/v1/orchestrator';

// ─── Workflows ────────────────────────────────────────────────────────────────

export function fetchWorkflows(): Promise<Workflow[]> {
  return api.get<Workflow[]>(`${BASE}/workflows`);
}

export function fetchWorkflow(id: string): Promise<Workflow> {
  return api.get<Workflow>(`${BASE}/workflows/${id}`);
}

export function createWorkflow(body: {
  name: string;
  description?: string;
  triggerType: TriggerType;
  graph?: WorkflowGraph;
  tags?: string[];
}): Promise<Workflow> {
  return api.post<Workflow>(`${BASE}/workflows`, body);
}

export function updateWorkflow(
  id: string,
  body: Partial<Workflow> & { graph?: WorkflowGraph; note?: string }
): Promise<Workflow> {
  return api.put<Workflow>(`${BASE}/workflows/${id}`, body);
}

export function deleteWorkflow(id: string): Promise<void> {
  return api.delete<void>(`${BASE}/workflows/${id}`);
}

export function activateWorkflow(id: string): Promise<Workflow> {
  return api.post<Workflow>(`${BASE}/workflows/${id}/activate`);
}

export function deactivateWorkflow(id: string): Promise<Workflow> {
  return api.post<Workflow>(`${BASE}/workflows/${id}/deactivate`);
}

export function runWorkflow(
  id: string,
  input?: Record<string, unknown>
): Promise<WorkflowExecution> {
  return api.post<WorkflowExecution>(`${BASE}/workflows/${id}/run`, { input });
}

export function fetchWorkflowVersions(id: string): Promise<WorkflowVersion[]> {
  return api.get<WorkflowVersion[]>(`${BASE}/workflows/${id}/versions`);
}

// ─── Executions ───────────────────────────────────────────────────────────────

export function fetchExecutions(params?: {
  workflowId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: WorkflowExecution[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.workflowId) qs.set('workflowId', params.workflowId);
  if (params?.status) qs.set('status', params.status);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  const query = qs.toString() ? `?${qs}` : '';
  return api.get<{ data: WorkflowExecution[]; total: number }>(`${BASE}/executions${query}`);
}

export function fetchExecution(id: string): Promise<WorkflowExecution> {
  return api.get<WorkflowExecution>(`${BASE}/executions/${id}`);
}

export function cancelExecution(id: string): Promise<WorkflowExecution> {
  return api.post<WorkflowExecution>(`${BASE}/executions/${id}/cancel`);
}

export function fetchExecutionStats(): Promise<ExecutionStats> {
  return api.get<ExecutionStats>(`${BASE}/executions/stats`);
}

// ─── Queue ────────────────────────────────────────────────────────────────────

export function fetchQueue(): Promise<QueueState> {
  return api.get<QueueState>(`${BASE}/queue`);
}

export function fetchDlq(): Promise<QueueState> {
  return api.get<QueueState>(`${BASE}/queue/dlq`);
}

export function retryDlqJob(jobId: string): Promise<unknown> {
  return api.post(`${BASE}/queue/dlq/${jobId}/retry`);
}

export function purgeDlq(): Promise<{ purged: number }> {
  return api.delete<{ purged: number }>(`${BASE}/queue/dlq`);
}
