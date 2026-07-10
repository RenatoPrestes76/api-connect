/**
 * Sprint 29 — ORCHESTRATOR
 * Frontend workflow types (mirrors apps/api/src/modules/orchestrator/types.ts)
 */

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
  // Sprint 32 — Entrada (7 new)
  | 'webhook'
  | 'schedule'
  | 'file-watch'
  | 'email-trigger'
  | 'api-trigger'
  | 'queue-trigger'
  | 'manual-trigger'
  // Sprint 32 — Processamento (5 new)
  | 'loop'
  | 'aggregate'
  | 'filter'
  | 'merge'
  | 'split'
  // Sprint 32 — IA (6 new)
  | 'ai-classify'
  | 'ai-extract'
  | 'ai-generate'
  | 'ai-translate'
  | 'ai-summarize'
  | 'ai-embed'
  // Sprint 32 — Saída (2 new)
  | 'database-write'
  | 'file-write';

export type TriggerType = 'WEBHOOK' | 'CRON' | 'EVENT' | 'MANUAL';
export type BackoffStrategy = 'fixed' | 'exponential' | 'linear';
export type NotificationChannel = 'email' | 'webhook' | 'slack';
export type ExecutionStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMEOUT';
export type StepStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'RETRYING';
export type JobStatus = 'QUEUED' | 'PROCESSING' | 'FAILED';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

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

export interface ExecutionStats {
  total: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
  completed24h: number;
  failed24h: number;
  avgDurationMs: number;
}

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

export interface QueueState {
  queue: QueueJob[];
  depth: number;
}

// ─── Node palette metadata ────────────────────────────────────────────────────

export interface NodePaletteItem {
  type: NodeType;
  label: string;
  description: string;
  color: string;
  category: 'Entrada' | 'Processamento' | 'IA' | 'Saída';
}

export const NODE_PALETTE: NodePaletteItem[] = [
  // Entrada
  {
    type: 'trigger',
    label: 'Trigger',
    description: 'Evento de entrada genérico',
    color: '#6366f1',
    category: 'Entrada',
  },
  {
    type: 'webhook',
    label: 'Webhook',
    description: 'Recebe chamadas HTTP externas',
    color: '#6366f1',
    category: 'Entrada',
  },
  {
    type: 'schedule',
    label: 'Schedule',
    description: 'Agendamento por expressão cron',
    color: '#7c3aed',
    category: 'Entrada',
  },
  {
    type: 'file-watch',
    label: 'File Watch',
    description: 'Monitora criação/modificação de arquivo',
    color: '#7c3aed',
    category: 'Entrada',
  },
  {
    type: 'email-trigger',
    label: 'Email',
    description: 'Dispara ao receber e-mail',
    color: '#8b5cf6',
    category: 'Entrada',
  },
  {
    type: 'api-trigger',
    label: 'API Trigger',
    description: 'Endpoint HTTP para iniciar o fluxo',
    color: '#8b5cf6',
    category: 'Entrada',
  },
  {
    type: 'queue-trigger',
    label: 'Queue',
    description: 'Consome mensagem de fila',
    color: '#a78bfa',
    category: 'Entrada',
  },
  {
    type: 'manual-trigger',
    label: 'Manual',
    description: 'Início manual via painel',
    color: '#a78bfa',
    category: 'Entrada',
  },
  // Processamento
  {
    type: 'transform',
    label: 'Transform',
    description: 'Mapeia e transforma campos',
    color: '#0ea5e9',
    category: 'Processamento',
  },
  {
    type: 'validate',
    label: 'Validate',
    description: 'Valida payload contra schema',
    color: '#0284c7',
    category: 'Processamento',
  },
  {
    type: 'condition',
    label: 'Condition',
    description: 'Ramifica com expressão booleana',
    color: '#f59e0b',
    category: 'Processamento',
  },
  {
    type: 'loop',
    label: 'Loop',
    description: 'Itera sobre uma lista',
    color: '#d97706',
    category: 'Processamento',
  },
  {
    type: 'aggregate',
    label: 'Aggregate',
    description: 'Agrega valores (sum, avg, count)',
    color: '#b45309',
    category: 'Processamento',
  },
  {
    type: 'filter',
    label: 'Filter',
    description: 'Filtra registros por critério',
    color: '#92400e',
    category: 'Processamento',
  },
  {
    type: 'merge',
    label: 'Merge',
    description: 'Consolida múltiplas fontes',
    color: '#78716c',
    category: 'Processamento',
  },
  {
    type: 'split',
    label: 'Split',
    description: 'Distribui para múltiplos ramos',
    color: '#64748b',
    category: 'Processamento',
  },
  {
    type: 'delay',
    label: 'Delay',
    description: 'Aguarda antes de continuar',
    color: '#475569',
    category: 'Processamento',
  },
  {
    type: 'retry',
    label: 'Retry',
    description: 'Reexecuta com backoff em falha',
    color: '#f97316',
    category: 'Processamento',
  },
  // IA
  {
    type: 'ai-classify',
    label: 'AI Classify',
    description: 'Classifica dados com Claude',
    color: '#22c55e',
    category: 'IA',
  },
  {
    type: 'ai-extract',
    label: 'AI Extract',
    description: 'Extrai campos com IA',
    color: '#16a34a',
    category: 'IA',
  },
  {
    type: 'ai-generate',
    label: 'AI Generate',
    description: 'Gera conteúdo com Claude',
    color: '#15803d',
    category: 'IA',
  },
  {
    type: 'ai-translate',
    label: 'AI Translate',
    description: 'Traduz texto com IA',
    color: '#166534',
    category: 'IA',
  },
  {
    type: 'ai-summarize',
    label: 'AI Summarize',
    description: 'Resume e analisa dados com IA',
    color: '#14532d',
    category: 'IA',
  },
  {
    type: 'ai-embed',
    label: 'AI Embed',
    description: 'Gera embeddings vetoriais',
    color: '#4ade80',
    category: 'IA',
  },
  // Saída
  {
    type: 'http',
    label: 'HTTP Request',
    description: 'Chama endpoint REST externo',
    color: '#10b981',
    category: 'Saída',
  },
  {
    type: 'notification',
    label: 'Notification',
    description: 'Envia email, webhook ou Slack',
    color: '#ec4899',
    category: 'Saída',
  },
  {
    type: 'database-write',
    label: 'Database Write',
    description: 'Grava no banco de dados',
    color: '#db2777',
    category: 'Saída',
  },
  {
    type: 'file-write',
    label: 'File Write',
    description: 'Escreve arquivo de saída',
    color: '#be185d',
    category: 'Saída',
  },
  {
    type: 'log',
    label: 'Log',
    description: 'Registra entrada de log estruturado',
    color: '#14b8a6',
    category: 'Saída',
  },
  {
    type: 'dlq',
    label: 'Dead Letter',
    description: 'Move para DLQ em falha irrecuperável',
    color: '#ef4444',
    category: 'Saída',
  },
];
