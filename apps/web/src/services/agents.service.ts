import { api } from './api-client';
import type { AgentSummary } from '@/types/index';

export async function listAgents(signal?: AbortSignal): Promise<AgentSummary[]> {
  return api.get<AgentSummary[]>('/api/v1/hub/agents', signal);
}

export async function getAgent(id: string, signal?: AbortSignal): Promise<AgentSummary> {
  return api.get<AgentSummary>(`/api/v1/hub/agents/${id}`, signal);
}

export async function disableAgent(id: string): Promise<void> {
  return api.patch(`/admin/agents/${id}/disable`);
}

export async function enableAgent(id: string): Promise<void> {
  return api.patch(`/admin/agents/${id}/enable`);
}

export async function restartAgent(id: string): Promise<void> {
  return api.post(`/api/v1/hub/agents/${id}/restart`);
}
