import { api } from './api-client';
import type {
  PlanRequest,
  PlanResponse,
  ValidationResult,
  SimulationResult,
  WorkflowTemplate,
  VersionRecord,
} from '@/types/workflow-builder';
import type { Workflow, WorkflowGraph } from '@/types/workflow';

const BASE_WB = '/api/v1/workflow-builder';
const BASE_OR = '/api/v1/orchestrator/workflows';

// ─── Plan ─────────────────────────────────────────────────────────────────────

export const planWorkflow = (body: PlanRequest): Promise<PlanResponse> =>
  api.post(`${BASE_OR}/plan`, body);

// ─── Validate ─────────────────────────────────────────────────────────────────

export const validateGraph = (graph: WorkflowGraph): Promise<ValidationResult> =>
  api.post(`${BASE_OR}/validate`, { graph });

// ─── Simulate ─────────────────────────────────────────────────────────────────

export const simulateWorkflow = (
  id: string,
  input?: Record<string, unknown>
): Promise<SimulationResult> => api.post(`${BASE_OR}/${id}/simulate`, { input: input ?? {} });

// ─── Templates ────────────────────────────────────────────────────────────────

export const fetchTemplates = (category?: string): Promise<WorkflowTemplate[]> =>
  api.get(`${BASE_WB}/templates${category ? `?category=${encodeURIComponent(category)}` : ''}`);

export const fetchTemplate = (id: string): Promise<WorkflowTemplate> =>
  api.get(`${BASE_WB}/templates/${id}`);

export const useTemplate = (id: string, body?: { name?: string; description?: string }) =>
  api.post<Workflow>(`${BASE_WB}/templates/${id}/use`, body ?? {});

// ─── Versions ─────────────────────────────────────────────────────────────────

export const fetchVersions = (workflowId: string): Promise<VersionRecord[]> =>
  api.get(`${BASE_OR}/${workflowId}/wb-versions`);

export const saveVersion = (
  workflowId: string,
  note?: string,
  author?: string
): Promise<VersionRecord> => api.post(`${BASE_OR}/${workflowId}/wb-versions`, { note, author });

export const rollbackWorkflow = (workflowId: string, version: number) =>
  api.post(`${BASE_OR}/${workflowId}/versions/${version}/rollback`, {});
