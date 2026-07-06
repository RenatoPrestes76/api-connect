import { api } from './api-client';
import { buildQuery } from '@/lib/utils';
import type { LogEntry, LogQuery } from '@/types/index';

export interface LogsResponse {
  data:  LogEntry[];
  total: number;
}

export async function getLogs(query: LogQuery = {}, signal?: AbortSignal): Promise<LogsResponse> {
  const qs = buildQuery(query as Record<string, string | number | boolean | undefined>);
  return api.get<LogsResponse>(`/api/v1/hub/logs${qs}`, signal);
}

export async function exportLogs(query: LogQuery = {}): Promise<Blob> {
  const qs = buildQuery({ ...query, export: 'true' } as Record<string, string | number | boolean | undefined>);
  const res = await fetch(`${'/api/v1/hub/logs'}${qs}`, {
    headers: { Accept: 'text/plain' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Export failed');
  return res.blob();
}
