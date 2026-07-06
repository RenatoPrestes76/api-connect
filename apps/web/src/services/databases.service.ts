import { api } from './api-client';
import type { DatabaseConnection } from '@/types/index';

export async function listDatabases(signal?: AbortSignal): Promise<DatabaseConnection[]> {
  return api.get<DatabaseConnection[]>('/api/v1/hub/databases', signal);
}

export async function getDatabase(id: string, signal?: AbortSignal): Promise<DatabaseConnection> {
  return api.get<DatabaseConnection>(`/api/v1/hub/databases/${id}`, signal);
}
