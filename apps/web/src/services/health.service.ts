import { api } from './api-client';
import type { SystemHealth } from '@/types/index';

export async function getSystemHealth(signal?: AbortSignal): Promise<SystemHealth> {
  return api.get<SystemHealth>('/api/v1/hub/health', signal);
}
