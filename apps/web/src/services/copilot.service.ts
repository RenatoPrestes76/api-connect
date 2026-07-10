import { api } from './api-client';
import type {
  ChatRequest,
  ChatResponse,
  DiagnoseRequest,
  DiagnoseResponse,
  GenerateRequest,
  GenerateResponse,
  ExplainRequest,
  ExplainResponse,
  SearchRequest,
  SearchResponse,
  CopilotConversation,
  ConversationList,
  PaginatedAudit,
} from '@/types/copilot';

const BASE = '/api/v1/copilot';

// ─── Chat ─────────────────────────────────────────────────────────────────────

export const sendMessage = (body: ChatRequest): Promise<ChatResponse> =>
  api.post(`${BASE}/chat`, body);
export const fetchConversations = (): Promise<ConversationList> => api.get(`${BASE}/conversations`);
export const fetchConversation = (id: string): Promise<CopilotConversation> =>
  api.get(`${BASE}/conversations/${id}`);
export const deleteConversation = (id: string): Promise<void> =>
  api.delete(`${BASE}/conversations/${id}`);

// ─── AI features ──────────────────────────────────────────────────────────────

export const diagnose = (body: DiagnoseRequest): Promise<DiagnoseResponse> =>
  api.post(`${BASE}/diagnose`, body);
export const generate = (body: GenerateRequest): Promise<GenerateResponse> =>
  api.post(`${BASE}/generate`, body);
export const explain = (body: ExplainRequest): Promise<ExplainResponse> =>
  api.post(`${BASE}/explain`, body);
export const search = (body: SearchRequest): Promise<SearchResponse> =>
  api.post(`${BASE}/search`, body);

// ─── Audit ────────────────────────────────────────────────────────────────────

export const fetchCopilotAudit = (params?: {
  action?: string;
  conversationId?: string;
  limit?: number;
  offset?: number;
}): Promise<PaginatedAudit> => {
  const qs = new URLSearchParams();
  if (params?.action) qs.set('action', params.action);
  if (params?.conversationId) qs.set('conversationId', params.conversationId);
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  if (params?.offset !== undefined) qs.set('offset', String(params.offset));
  const query = qs.toString();
  return api.get(`${BASE}/audit${query ? `?${query}` : ''}`);
};
