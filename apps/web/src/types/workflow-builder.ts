import type { WorkflowGraph, Workflow } from './workflow';

// ─── Plan ─────────────────────────────────────────────────────────────────────

export interface WorkflowPlan {
  name: string;
  description: string;
  graph: WorkflowGraph;
  reasoning: string;
  confidence: number;
}

export interface PlanRequest {
  prompt: string;
  context?: string;
}

export interface PlanResponse {
  plan: WorkflowPlan;
  model: string;
}

// ─── Validate ─────────────────────────────────────────────────────────────────

export interface ValidationError {
  code: string;
  message: string;
  nodeId?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// ─── Simulate ─────────────────────────────────────────────────────────────────

export interface SimulationStep {
  nodeId: string;
  nodeType: string;
  label: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: 'success' | 'skipped' | 'error';
  durationMs: number;
  error?: string;
}

export interface SimulationResult {
  success: boolean;
  steps: SimulationStep[];
  totalMs: number;
  finalOutput: Record<string, unknown>;
  warnings: string[];
}

// ─── Templates ────────────────────────────────────────────────────────────────

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  graph: WorkflowGraph;
  createdAt: string;
}

// ─── Versions ─────────────────────────────────────────────────────────────────

export interface VersionRecord {
  id: string;
  workflowId: string;
  version: number;
  graph: WorkflowGraph;
  note?: string;
  author: string;
  createdAt: string;
}
