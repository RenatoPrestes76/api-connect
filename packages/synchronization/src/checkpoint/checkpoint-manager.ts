/**
 * CheckpointManager — persists and restores sync state.
 *
 * In this implementation the store is in-memory (Map).
 * A production deployment would swap it for a persistent adapter
 * (Redis, PostgreSQL, or file-based) via the CheckpointStore interface.
 */
import {
  type SyncCheckpoint,
  type TableCheckpoint,
  type SyncJobId,
  type TenantId,
  type CorrelationId,
  type SyncMode,
  type SyncStatus,
  type CheckpointId,
  type ChangeDetectionStrategyKind,
  type RecordValue,
  syncOk,
  syncFail,
  type SyncResult,
  asCheckpointId,
} from '../types/index.js';

// ─── Store interface (pluggable) ──────────────────────────────────────────────

export interface CheckpointStore {
  save(checkpoint: SyncCheckpoint): Promise<void>;
  load(jobId: SyncJobId): Promise<SyncCheckpoint | null>;
  delete(jobId: SyncJobId): Promise<void>;
  listByTenant(tenantId: TenantId): Promise<readonly SyncCheckpoint[]>;
}

// ─── Default in-memory store ──────────────────────────────────────────────────

class InMemoryCheckpointStore implements CheckpointStore {
  private readonly _store = new Map<string, SyncCheckpoint>();

  async save(checkpoint: SyncCheckpoint): Promise<void> {
    this._store.set(checkpoint.jobId, checkpoint);
  }

  async load(jobId: SyncJobId): Promise<SyncCheckpoint | null> {
    return this._store.get(jobId) ?? null;
  }

  async delete(jobId: SyncJobId): Promise<void> {
    this._store.delete(jobId);
  }

  async listByTenant(tenantId: TenantId): Promise<readonly SyncCheckpoint[]> {
    return [...this._store.values()].filter((c) => c.tenantId === tenantId);
  }

  get size(): number {
    return this._store.size;
  }
}

// ─── CheckpointManager ────────────────────────────────────────────────────────

export class CheckpointManager {
  private readonly _store: CheckpointStore;

  constructor(store?: CheckpointStore) {
    this._store = store ?? new InMemoryCheckpointStore();
  }

  /** Create a new checkpoint for a sync job. */
  async create(params: {
    jobId: SyncJobId;
    tenantId: TenantId;
    correlationId: CorrelationId;
    mode: SyncMode;
    tables: ReadonlyArray<{
      schema: string;
      table: string;
      detection: ChangeDetectionStrategyKind;
    }>;
  }): Promise<SyncResult<SyncCheckpoint>> {
    const now = new Date().toISOString();
    const tableMap = new Map<string, TableCheckpoint>();

    for (const t of params.tables) {
      const key = `${t.schema}.${t.table}`;
      tableMap.set(key, {
        schema: t.schema,
        table: t.table,
        lastSyncedAt: now,
        lastValue: null,
        lastOffset: 0,
        recordsSynced: 0,
        status: 'PENDING',
        detection: t.detection,
      });
    }

    const checkpoint: SyncCheckpoint = {
      id: asCheckpointId(`${params.jobId}:${Date.now()}`),
      jobId: params.jobId,
      tenantId: params.tenantId,
      correlationId: params.correlationId,
      createdAt: now,
      updatedAt: now,
      mode: params.mode,
      status: 'PENDING',
      totalTables: params.tables.length,
      completedTables: 0,
      totalRecords: 0,
      syncedRecords: 0,
      failedRecords: 0,
      tables: tableMap,
      lastError: null,
      retryCount: 0,
    };

    await this._store.save(checkpoint);
    return syncOk(checkpoint);
  }

  /** Load an existing checkpoint (for resume). */
  async load(jobId: SyncJobId): Promise<SyncResult<SyncCheckpoint | null>> {
    try {
      const checkpoint = await this._store.load(jobId);
      return syncOk(checkpoint);
    } catch (err) {
      return syncFail('CHECKPOINT_LOAD_FAILED', `Failed to load checkpoint for job ${jobId}`, {
        cause: err as Error,
      });
    }
  }

  /** Update table progress within a checkpoint. */
  async updateTable(
    jobId: SyncJobId,
    schema: string,
    table: string,
    update: Partial<Omit<TableCheckpoint, 'schema' | 'table'>>
  ): Promise<SyncResult<SyncCheckpoint>> {
    const checkpoint = await this._store.load(jobId);
    if (!checkpoint) {
      return syncFail('CHECKPOINT_NOT_FOUND', `No checkpoint found for job ${jobId}`);
    }

    const key = `${schema}.${table}`;
    const existing = checkpoint.tables.get(key);
    if (!existing) {
      return syncFail('TABLE_NOT_IN_CHECKPOINT', `Table ${key} not in checkpoint for job ${jobId}`);
    }

    const updated: TableCheckpoint = { ...existing, ...update };
    const newTables = new Map(checkpoint.tables);
    newTables.set(key, updated);

    const completedTables = [...newTables.values()].filter((t) => t.status === 'COMPLETED').length;

    const updatedCheckpoint: SyncCheckpoint = {
      ...checkpoint,
      updatedAt: new Date().toISOString(),
      tables: newTables,
      completedTables,
      syncedRecords: [...newTables.values()].reduce((s, t) => s + t.recordsSynced, 0),
    };

    await this._store.save(updatedCheckpoint);
    return syncOk(updatedCheckpoint);
  }

  /** Mark the sync job status (RUNNING, PAUSED, COMPLETED, etc.). */
  async updateStatus(
    jobId: SyncJobId,
    status: SyncStatus,
    extra?: { error?: string; totalRecords?: number; failedRecords?: number }
  ): Promise<SyncResult<SyncCheckpoint>> {
    const checkpoint = await this._store.load(jobId);
    if (!checkpoint) {
      return syncFail('CHECKPOINT_NOT_FOUND', `No checkpoint found for job ${jobId}`);
    }

    const updated: SyncCheckpoint = {
      ...checkpoint,
      status,
      updatedAt: new Date().toISOString(),
      lastError: extra?.error ?? checkpoint.lastError,
      totalRecords: extra?.totalRecords ?? checkpoint.totalRecords,
      failedRecords: extra?.failedRecords ?? checkpoint.failedRecords,
    };

    await this._store.save(updated);
    return syncOk(updated);
  }

  /** Increment retry count on a job checkpoint. */
  async incrementRetry(jobId: SyncJobId): Promise<SyncResult<SyncCheckpoint>> {
    const checkpoint = await this._store.load(jobId);
    if (!checkpoint) {
      return syncFail('CHECKPOINT_NOT_FOUND', `No checkpoint found for job ${jobId}`);
    }

    const updated: SyncCheckpoint = {
      ...checkpoint,
      retryCount: checkpoint.retryCount + 1,
      updatedAt: new Date().toISOString(),
      status: 'RECOVERING',
    };

    await this._store.save(updated);
    return syncOk(updated);
  }

  /** Get the last synced value for a table (for incremental detection). */
  getLastValue(checkpoint: SyncCheckpoint, schema: string, table: string): RecordValue {
    return checkpoint.tables.get(`${schema}.${table}`)?.lastValue ?? null;
  }

  /** Check if a table was already completed (for resume). */
  isTableComplete(checkpoint: SyncCheckpoint, schema: string, table: string): boolean {
    return checkpoint.tables.get(`${schema}.${table}`)?.status === 'COMPLETED';
  }

  async listByTenant(tenantId: TenantId): Promise<readonly SyncCheckpoint[]> {
    return this._store.listByTenant(tenantId);
  }

  async delete(jobId: SyncJobId): Promise<void> {
    await this._store.delete(jobId);
  }

  /** Expose store for testing. */
  get store(): CheckpointStore {
    return this._store;
  }
}
