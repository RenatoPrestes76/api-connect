// ─── Core types ───────────────────────────────────────────────────────────────

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface CopilotContext {
  tenantId?: string;
  environmentId?: string;
  connectorId?: string;
  workflowId?: string;
}

export interface CopilotConversation {
  id: string;
  title: string;
  context: CopilotContext;
  messages: CopilotMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface CopilotConversationSummary {
  id: string;
  title: string;
  context: CopilotContext;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage?: string;
}

export type CopilotAction = 'chat' | 'diagnose' | 'generate' | 'explain' | 'search';

export interface CopilotAuditLog {
  id: string;
  timestamp: string;
  action: CopilotAction;
  conversationId?: string;
  prompt: string;
  responsePreview: string;
  context: CopilotContext;
  modelUsed: string;
  durationMs?: number;
}

// ─── API request/response types ──────────────────────────────────────────────

export interface ChatRequest {
  message: string;
  conversationId?: string;
  context?: CopilotContext;
}

export interface ChatResponse {
  conversationId: string;
  messageId: string;
  content: string;
  model: string;
}

export type DiagnosisSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface DiagnoseRequest {
  question: string;
  context?: {
    workflowId?: string;
    connectorId?: string;
    agentId?: string;
    executionId?: string;
  };
}

export interface DiagnoseResponse {
  diagnosis: string;
  rootCause?: string;
  severity: DiagnosisSeverity;
  suggestions: Array<{
    step: number;
    action: string;
    description: string;
    command?: string;
  }>;
  relatedResources?: string[];
  model: string;
}

export type GenerateType = 'mapping' | 'sql' | 'flow';

export interface GenerateRequest {
  type: GenerateType;
  description: string;
  context?: {
    sourceSchema?: Record<string, unknown>;
    targetSchema?: Record<string, unknown>;
    tenantId?: string;
  };
}

export interface GenerateResponse {
  type: GenerateType;
  title: string;
  description: string;
  result: Record<string, unknown> | string;
  code?: string;
  language?: string;
  model: string;
}

export type ExplainType = 'mapping' | 'pipeline' | 'workflow' | 'query';

export interface ExplainRequest {
  type: ExplainType;
  id?: string;
  content?: Record<string, unknown>;
  description?: string;
}

export interface ExplainResponse {
  summary: string;
  explanation: string;
  components?: Array<{ name: string; description: string; type?: string }>;
  warnings?: string[];
  model: string;
}

export type EntityType =
  | 'apis'
  | 'connectors'
  | 'logs'
  | 'pipelines'
  | 'schemas'
  | 'workflows'
  | 'agents';

export interface SearchRequest {
  query: string;
  entities?: EntityType[];
  limit?: number;
}

export interface SearchResult {
  id: string;
  type: EntityType;
  title: string;
  description: string;
  relevance: number;
  metadata?: Record<string, unknown>;
  lastUpdated?: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
  model: string;
}

export interface PaginatedAudit {
  items: CopilotAuditLog[];
  total: number;
  offset: number;
  limit: number;
}

export interface ConversationList {
  items: CopilotConversationSummary[];
  total: number;
}
