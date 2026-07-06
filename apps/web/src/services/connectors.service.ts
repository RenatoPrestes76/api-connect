import { api } from './api-client';
import type { ConnectorInstance } from '@/types/index';

export async function listConnectors(signal?: AbortSignal): Promise<ConnectorInstance[]> {
  return api.get<ConnectorInstance[]>('/api/v1/hub/connectors', signal);
}

export async function getConnector(id: string, signal?: AbortSignal): Promise<ConnectorInstance> {
  return api.get<ConnectorInstance>(`/api/v1/hub/connectors/${id}`, signal);
}

export async function startConnector(id: string): Promise<void> {
  return api.post(`/api/v1/hub/connectors/${id}/start`);
}

export async function stopConnector(id: string): Promise<void> {
  return api.post(`/api/v1/hub/connectors/${id}/stop`);
}

export async function restartConnector(id: string): Promise<void> {
  return api.post(`/api/v1/hub/connectors/${id}/restart`);
}
