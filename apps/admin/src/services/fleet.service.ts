import { fleetGet, fleetPost, fleetDelete } from '@/lib/fleet-client';
import type { FleetOverview, RuntimeDetail, RuntimeCommandType, RuntimeLog } from '@/types/fleet';

export async function getFleetOverview(): Promise<FleetOverview> {
  return fleetGet<FleetOverview>('');
}

export async function getFleetMetrics(): Promise<{
  metrics: Array<{ name: string; value: number }>;
}> {
  return fleetGet('/metrics');
}

export async function getRuntimeStatusFeed(): Promise<{
  runtimes: Array<{
    runtimeId: string;
    name: string;
    status: string;
    metric?: { cpuPct: number; memPct: number; diskPct: number; latencyMs: number };
  }>;
}> {
  return fleetGet('/runtime/status');
}

export async function getRuntimeDetail(runtimeId: string): Promise<RuntimeDetail> {
  return fleetGet<RuntimeDetail>(`/runtime/${runtimeId}`);
}

export async function getRuntimeLogs(runtimeId: string): Promise<RuntimeLog[]> {
  const data = await fleetGet<{ logs: RuntimeLog[] }>(`/runtime/${runtimeId}/logs`);
  return data.logs;
}

const ACTION_PATH: Record<RuntimeCommandType, string> = {
  RESTART: 'restart',
  UPDATE: 'update',
  REINSTALL: 'reinstall',
  SYNC_NOW: 'sync-now',
  CLEAR_CACHE: 'clear-cache',
  FORCE_HEARTBEAT: 'force-heartbeat',
  DISABLE: 'disable',
  ENABLE: 'enable',
};

export async function issueRuntimeCommand(runtimeId: string, type: RuntimeCommandType) {
  return fleetPost(`/runtime/${runtimeId}/${ACTION_PATH[type]}`);
}

// ─── Connector operations ───────────────────────────────────────────────────

export async function installConnector(
  connectorId: string,
  organizationId: string,
  version: string
) {
  return fleetPost(`/connectors/${connectorId}/install`, { organizationId, version });
}

export async function updateConnector(
  connectorId: string,
  organizationId: string,
  version: string
) {
  return fleetPost(`/connectors/${connectorId}/update`, { organizationId, version });
}

export async function restartConnector(connectorId: string, organizationId: string) {
  return fleetPost(`/connectors/${connectorId}/restart`, { organizationId });
}

export async function removeConnector(connectorId: string, organizationId: string): Promise<void> {
  await fleetDelete(`/connectors/${connectorId}?organizationId=${organizationId}`);
}

export async function getConnectorLogs(connectorId: string, organizationId: string) {
  const data = await fleetGet<{
    logs: Array<{ id: string; action: string; message: string; createdAt: string }>;
  }>(`/connectors/${connectorId}/logs?organizationId=${organizationId}`);
  return data.logs;
}
