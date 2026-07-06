import { api } from './api-client';
import type { DashboardMetrics } from '@/types/index';

export async function getDashboardMetrics(signal?: AbortSignal): Promise<DashboardMetrics> {
  return api.get<DashboardMetrics>('/api/v1/hub/dashboard', signal);
}
