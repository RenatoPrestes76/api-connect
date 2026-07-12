import { fleetGet, fleetPost } from '@/lib/fleet-client';
import type { RuntimeAlert } from '@/types/fleet';

export async function listAlerts(
  filters: { severity?: string; status?: string; type?: string } = {}
): Promise<RuntimeAlert[]> {
  const params = new URLSearchParams();
  if (filters.severity) params.set('severity', filters.severity);
  if (filters.status) params.set('status', filters.status);
  if (filters.type) params.set('type', filters.type);
  const qs = params.toString();
  const data = await fleetGet<{ alerts: RuntimeAlert[] }>(`/alerts${qs ? `?${qs}` : ''}`);
  return data.alerts;
}

export async function acknowledgeAlert(id: string): Promise<RuntimeAlert> {
  return fleetPost<RuntimeAlert>(`/alerts/${id}/acknowledge`);
}

export async function resolveAlert(id: string): Promise<RuntimeAlert> {
  return fleetPost<RuntimeAlert>(`/alerts/${id}/resolve`);
}
