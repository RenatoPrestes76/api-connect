import type { HealthStatusKind, ConnectorHealthStatus } from '../interfaces/connector.js';

/** Determine the overall health of a connector from its reported status. */
export function isHealthy(status: ConnectorHealthStatus): boolean {
  return status.status === 'healthy';
}

/** Aggregate multiple health statuses into the worst-case single status. */
export function aggregateStatus(statuses: HealthStatusKind[]): HealthStatusKind {
  if (statuses.some((s) => s === 'unhealthy')) return 'unhealthy';
  if (statuses.some((s) => s === 'degraded'))  return 'degraded';
  return 'healthy';
}

export interface HealthSnapshot {
  readonly connectorId: string;
  readonly status:      ConnectorHealthStatus;
  readonly snapshotAt:  Date;
}
