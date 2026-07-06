/**
 * SnapshotManager — creates and stores point-in-time database snapshots.
 *
 * A snapshot is an indexed catalog of what was synced, when, and from where.
 * It is NOT a full data copy; it is metadata that Atlas Cloud uses
 * to diff against future syncs.
 *
 * Storage: in-memory Map (pluggable via SnapshotStore interface).
 */
import { randomUUID } from 'crypto';
import type {
  SyncJobId,
  TenantId,
  CorrelationId,
} from '../types/index.js';

export interface TableSnapshot {
  readonly schema:       string;
  readonly table:        string;
  readonly rowCount:     number;
  readonly checksum:     string;
  readonly snapshotAt:   string;
}

export interface DatabaseSnapshot {
  readonly id:            string;
  readonly jobId:         SyncJobId;
  readonly tenantId:      TenantId;
  readonly correlationId: CorrelationId;
  readonly createdAt:     string;
  readonly database:      string;
  readonly host:          string;
  readonly tables:        readonly TableSnapshot[];
  readonly totalRows:     number;
  readonly note?:         string;
}

export class SnapshotManager {
  private readonly _snapshots = new Map<string, DatabaseSnapshot>();

  create(params: Omit<DatabaseSnapshot, 'id' | 'createdAt' | 'totalRows'>): DatabaseSnapshot {
    const snapshot: DatabaseSnapshot = {
      ...params,
      id:        randomUUID(),
      createdAt: new Date().toISOString(),
      totalRows: params.tables.reduce((s, t) => s + t.rowCount, 0),
    };
    this._snapshots.set(snapshot.id, snapshot);
    return snapshot;
  }

  get(id: string): DatabaseSnapshot | null {
    return this._snapshots.get(id) ?? null;
  }

  latest(tenantId: TenantId, database: string): DatabaseSnapshot | null {
    const matching = [...this._snapshots.values()]
      .filter((s) => s.tenantId === tenantId && s.database === database);
    // Map iterates in insertion order; newest snapshot is always last
    return matching.at(-1) ?? null;
  }

  listByTenant(tenantId: TenantId): readonly DatabaseSnapshot[] {
    return [...this._snapshots.values()].filter((s) => s.tenantId === tenantId);
  }

  delete(id: string): boolean {
    return this._snapshots.delete(id);
  }

  /** Compare two snapshots and return tables that changed. */
  diff(before: DatabaseSnapshot, after: DatabaseSnapshot): readonly string[] {
    const changed: string[] = [];
    const beforeMap = new Map(before.tables.map((t) => [`${t.schema}.${t.table}`, t]));

    for (const afterTable of after.tables) {
      const key    = `${afterTable.schema}.${afterTable.table}`;
      const before = beforeMap.get(key);

      if (!before || before.checksum !== afterTable.checksum || before.rowCount !== afterTable.rowCount) {
        changed.push(key);
      }
    }

    return changed;
  }

  get size(): number { return this._snapshots.size; }
}
