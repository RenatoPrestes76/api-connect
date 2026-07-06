import { api } from './api-client';
import { buildQuery } from '@/lib/utils';
import type { SyncRecord, SyncRunRequest } from '@/types/index';

export interface SyncHistoryQuery {
  connector?: string;
  result?:    string;
  from?:      string;
  to?:        string;
  limit?:     number;
  offset?:    number;
}

export interface SyncHistoryResponse {
  data:  SyncRecord[];
  total: number;
}

export async function getSyncHistory(
  query: SyncHistoryQuery = {},
  signal?: AbortSignal,
): Promise<SyncHistoryResponse> {
  const qs = buildQuery(query as Record<string, string | number | boolean | undefined>);
  return api.get<SyncHistoryResponse>(`/api/v1/hub/sync/history${qs}`, signal);
}

export async function runSync(req: SyncRunRequest): Promise<SyncRecord> {
  return api.post<SyncRecord>('/api/v1/hub/sync/run', req);
}

export async function cancelSync(id: string): Promise<void> {
  return api.post(`/api/v1/hub/sync/${id}/cancel`);
}

export async function retrySync(id: string): Promise<SyncRecord> {
  return api.post<SyncRecord>(`/api/v1/hub/sync/${id}/retry`);
}
