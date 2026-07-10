/**
 * Sprint 29 — ORCHESTRATOR
 * Core type definitions for the workflow engine.
 */

// ─── Node Types ──────────────────────────────────────────────────────────────

export type NodeType =
  // Sprint 29 — original 10
  | 'trigger'
  | 'transform'
  | 'validate'
  | 'http'
  | 'condition'
  | 'delay'
  | 'retry'
  | 'notification'
  | 'log'
  | 'dlq'
  // Sprint 32 — Entrada additions (7 new)
  | 'webhook'
  | 'schedule'
  | 'file-watch'
  | 'email-trigger'
  | 'api-trigger'
  | 'queue-trigger'
  | 'manual-trigger'
  // Sprint 32 — Processamento additions (6 new)
  | 'loop'
  | 'aggregate'
  | 'filter'
  | 'merge'
  | 'split'
  // Sprint 32 — IA nodes (6 new)
  | 'ai-classify'
  | 'ai-extract'
  | 'ai-generate'
  | 'ai-translate'
  | 'ai-summarize'
  | 'ai-embed'
  // Sprint 32 — Saída additions (2 new)
  | 'database-write'
  | 'file-write';

export type TriggerType = 'WEBHOOK' | 'CRON' | 'EVENT' | 'MANUAL';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type BackoffStrategy = 'fixed' | 'exponential' | 'linear';
export type NotificationChannel = 'email' | 'webhook' | 'slack';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ─── Node Configs ─────────────────────────────────────────────────────────────

export interface TriggerConfig {
  triggerType: TriggerType;
  cronExpr?: string; // e.g. "0 8 * * *"
  eventType?: string; // e.g. "product.updated"
  webhookPath?: string;
}

export interface TransformConfig {
  expression: string; // mapping expression / template
  outputVar?: string;
}

export interface ValidateConfig {
  schema: string; // schema name or inline JSON Schema
  failOnError: boolean;
}

export interface HttpConfig {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

export interface ConditionConfig {
  expression: string; // JS-like expression evaluated against context
  description?: string;
}

export interface DelayConfig {
  durationMs: number;
}

export interface RetryConfig {
  maxAttempts: number;
  backoffMs: number;
  strategy: BackoffStrategy;
  retryOn?: string[]; // error patterns
}

export interface NotificationConfig {
  channel: NotificationChannel;
  to: string;
  subject?: string;
  template?: string;
}

export interface LogConfig {
  level: LogLevel;
  message: string;
}

export interface DlqConfig {
  reason: string;
  alertOn?: boolean;
}

export type NodeConfig =
  | TriggerConfig
  | TransformConfig
  | ValidateConfig
  | HttpConfig
  | ConditionConfig
  | DelayConfig
  | RetryConfig
  | NotificationConfig
  | LogConfig
  | DlqConfig;

// ─── Workflow Graph ───────────────────────────────────────────────────────────

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  config: NodeConfig;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string; // node id
  target: string; // node id
  label?: string; // 'true' | 'false' for condition branches
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

// ─── Workflow ─────────────────────────────────────────────────────────────────

export interface Workflow {
  id: string;
  name: string;
  description: string;
  active: boolean;
  version: number;
  graph: WorkflowGraph;
  triggerType: TriggerType;
  createdAt: string;
  updatedAt: string;
  executionCount: number;
  lastExecutedAt?: string;
  successCount: number;
  failureCount: number;
  tags: string[];
}

export interface WorkflowVersion {
  id: string;
  workflowId: string;
  version: number;
  graph: WorkflowGraph;
  createdAt: string;
  note?: string;
  author: string;
}

// ─── Execution ────────────────────────────────────────────────────────────────

export type ExecutionStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMEOUT';
export type StepStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'RETRYING';

export interface ExecutionStep {
  id: string;
  nodeId: string;
  nodeType: NodeType;
  label: string;
  status: StepStatus;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  attempt: number;
  maxAttempts: number;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  workflowVersion: number;
  status: ExecutionStatus;
  triggerType: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  steps: ExecutionStep[];
  error?: string;
}

// ─── Queue ────────────────────────────────────────────────────────────────────

export type JobStatus = 'QUEUED' | 'PROCESSING' | 'FAILED';

export interface QueueJob {
  id: string;
  workflowId: string;
  workflowName: string;
  triggerType: string;
  input?: Record<string, unknown>;
  priority: number;
  enqueuedAt: string;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  status: JobStatus;
}

// ─── Retry Policy ─────────────────────────────────────────────────────────────

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  strategy: BackoffStrategy;
  retryOn?: string[];
}
