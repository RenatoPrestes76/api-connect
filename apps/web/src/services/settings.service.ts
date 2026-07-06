import { api } from './api-client';
import type { HubSettings } from '@/types/index';

export async function getSettings(signal?: AbortSignal): Promise<HubSettings> {
  return api.get<HubSettings>('/api/v1/hub/settings', signal);
}

export async function updateSettings(settings: Partial<HubSettings>): Promise<HubSettings> {
  return api.put<HubSettings>('/api/v1/hub/settings', settings);
}
