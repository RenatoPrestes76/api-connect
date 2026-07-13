import type { HealthStatusKind, ConnectorHealthStatus } from '../interfaces/connector.js';
import type { HealthSnapshot } from './health-status.js';
import { aggregateStatus } from './health-status.js';

/**
 * Aggregates the latest health snapshots from all registered connectors.
 * Updated by the ConnectorHost after each health poll.
 */
export class HealthRegistry {
  private readonly _snapshots = new Map<string, HealthSnapshot>();

  update(connectorId: string, status: ConnectorHealthStatus): void {
    this._snapshots.set(connectorId, {
      connectorId,
      status,
      snapshotAt: new Date(),
    });
  }

  get(connectorId: string): HealthSnapshot | null {
    return this._snapshots.get(connectorId) ?? null;
  }

  remove(connectorId: string): void {
    this._snapshots.delete(connectorId);
  }

  all(): HealthSnapshot[] {
    return Array.from(this._snapshots.values());
  }

  overallStatus(): HealthStatusKind {
    const statuses = this.all().map((s) => s.status.status);
    if (statuses.length === 0) return 'healthy';
    return aggregateStatus(statuses);
  }

  get size(): number {
    return this._snapshots.size;
  }
}
