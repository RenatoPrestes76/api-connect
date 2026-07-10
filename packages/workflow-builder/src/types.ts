// 30 node types across 4 categories
export type NodeType =
  // Entrada (8)
  | 'trigger'
  | 'webhook'
  | 'schedule'
  | 'file-watch'
  | 'email-trigger'
  | 'api-trigger'
  | 'queue-trigger'
  | 'manual-trigger'
  // Processamento (10)
  | 'transform'
  | 'validate'
  | 'condition'
  | 'loop'
  | 'aggregate'
  | 'filter'
  | 'merge'
  | 'split'
  | 'delay'
  | 'retry'
  // IA (6)
  | 'ai-classify'
  | 'ai-extract'
  | 'ai-generate'
  | 'ai-translate'
  | 'ai-summarize'
  | 'ai-embed'
  // Saída (6)
  | 'http'
  | 'notification'
  | 'log'
  | 'dlq'
  | 'database-write'
  | 'file-write';

export type NodeCategory = 'Entrada' | 'Processamento' | 'IA' | 'Saída';

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

export interface ValidationError {
  code: string;
  message: string;
  nodeId?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface SimulationStep {
  nodeId: string;
  nodeType: NodeType;
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

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  graph: WorkflowGraph;
  createdAt: string;
}

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
