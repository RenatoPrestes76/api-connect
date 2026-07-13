/**
 * @seltriva/agent — sync
 * Metadata synchronization engine with incremental support and offline queue.
 *
 * Sync pipeline:
 *   1. Schema discovery — read current database structure
 *   2. Checkpoint comparison — diff against last known state
 *   3. Payload assembly — build a minimal sync payload
 *   4. Cloud transmission — send via CloudConnector
 *   5. Checkpoint commit — record new sync state
 *
 * Offline support:
 *   When the cloud is unreachable, payloads are persisted to the
 *   OfflineQueue (SQLite). On reconnect, queued payloads are flushed
 *   in order, respecting the max_age configuration.
 *
 * Incremental sync:
 *   Each sync records a checkpoint containing schema fingerprints.
 *   The next sync computes a diff and transmits only changes.
 */

import type { AgentResult, ConnectorId, SyncJobId, AgentId } from '../configuration/index';
import type { SchemaDescriptor, TableDescriptor, ColumnDescriptor } from '../connectors/index';

// ─── Sync Engine ──────────────────────────────────────────────────────────

export interface SyncEngine {
  /**
   * Run a full sync for a connector (all schemas, all tables)
   */
  syncFull(connectorId: ConnectorId): Promise<AgentResult<SyncResult>>;

  /**
   * Run an incremental sync — sends only changed entities
   */
  syncIncremental(connectorId: ConnectorId): Promise<AgentResult<SyncResult>>;

  /**
   * Sync a specific schema
   */
  syncSchema(connectorId: ConnectorId, schemaName: string): Promise<AgentResult<SyncResult>>;

  /**
   * Get the current sync status for a connector
   */
  getStatus(connectorId: ConnectorId): SyncStatus;

  /**
   * Get the last sync checkpoint for a connector
   */
  getCheckpoint(connectorId: ConnectorId): SyncCheckpoint | null;

  /**
   * Get sync history (last N runs)
   */
  getHistory(connectorId: ConnectorId, limit?: number): SyncHistoryEntry[];

  /**
   * Cancel an in-progress sync
   */
  cancel(jobId: SyncJobId): AgentResult<void>;

  /**
   * Subscribe to sync events
   */
  onEvent(handler: SyncEventHandler): SyncEventSubscription;
}

// ─── Sync Result ──────────────────────────────────────────────────────────

export interface SyncResult {
  readonly jobId: SyncJobId;
  readonly connectorId: ConnectorId;
  readonly mode: SyncRunMode;
  readonly status: SyncRunStatus;
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly durationMs?: number;
  readonly entitiesSynced: number;
  readonly bytesTransferred: number;
  readonly schemasProcessed: string[];
  readonly tablesProcessed: number;
  readonly changesSent?: SyncChangeSummary;
  readonly error?: string;
  readonly queued?: boolean;
}

export type SyncRunMode = 'full' | 'incremental' | 'schema-only';

export type SyncRunStatus =
  | 'running'
  | 'completed'
  | 'completed-with-warnings'
  | 'failed'
  | 'cancelled'
  | 'queued-offline';

export interface SyncChangeSummary {
  readonly schemasAdded: number;
  readonly schemasModified: number;
  readonly schemasRemoved: number;
  readonly tablesAdded: number;
  readonly tablesModified: number;
  readonly tablesRemoved: number;
  readonly columnsAdded: number;
  readonly columnsModified: number;
  readonly columnsRemoved: number;
}

// ─── Sync Status ──────────────────────────────────────────────────────────

export interface SyncStatus {
  readonly connectorId: ConnectorId;
  readonly isRunning: boolean;
  readonly currentJobId?: SyncJobId;
  readonly lastSyncAt?: Date;
  readonly lastSyncStatus?: SyncRunStatus;
  readonly nextScheduledAt?: Date;
  readonly consecutiveFailures: number;
  readonly isHealthy: boolean;
}

// ─── Sync Checkpoint ──────────────────────────────────────────────────────

export interface SyncCheckpoint {
  readonly connectorId: ConnectorId;
  readonly recordedAt: Date;
  readonly schemaFingerprints: Record<string, SchemaFingerprint>;
  readonly serverVersion?: string;
}

export interface SchemaFingerprint {
  readonly schemaName: string;
  readonly fingerprint: string;
  readonly tableFingerprints: Record<string, string>;
  readonly computedAt: Date;
}

// ─── Sync Diff Engine ─────────────────────────────────────────────────────

export interface SyncDiffEngine {
  /**
   * Compare two checkpoints and return what changed
   */
  diff(previous: SyncCheckpoint, current: SyncCheckpoint): SyncDiff;

  /**
   * Compute a fingerprint for a schema snapshot
   */
  fingerprint(schema: SchemaSnapshot): string;
}

export interface SyncDiff {
  readonly hasChanges: boolean;
  readonly addedSchemas: string[];
  readonly removedSchemas: string[];
  readonly modifiedSchemas: string[];
  readonly changeSummary: SyncChangeSummary;
  readonly changes: SchemaDiff[];
}

export interface SchemaDiff {
  readonly schemaName: string;
  readonly kind: 'added' | 'removed' | 'modified';
  readonly addedTables: string[];
  readonly removedTables: string[];
  readonly modifiedTables: TableDiff[];
}

export interface TableDiff {
  readonly tableName: string;
  readonly kind: 'added' | 'removed' | 'modified';
  readonly addedColumns: string[];
  readonly removedColumns: string[];
  readonly modifiedColumns: string[];
}

// ─── Schema Snapshot ──────────────────────────────────────────────────────

export interface SchemaSnapshot {
  readonly connectorId: ConnectorId;
  readonly capturedAt: Date;
  readonly schemas: SchemaSnapshotEntry[];
}

export interface SchemaSnapshotEntry {
  readonly descriptor: SchemaDescriptor;
  readonly tables: TableSnapshotEntry[];
}

export interface TableSnapshotEntry {
  readonly descriptor: TableDescriptor;
  readonly columns: ColumnDescriptor[];
}

// ─── Offline Queue ────────────────────────────────────────────────────────

export interface OfflineQueue {
  /**
   * Enqueue a payload for later transmission
   */
  enqueue(entry: OfflineQueueEntry): Promise<AgentResult<void>>;

  /**
   * Dequeue and return the next N entries (oldest first)
   */
  dequeue(count?: number): Promise<AgentResult<OfflineQueueEntry[]>>;

  /**
   * Mark an entry as successfully transmitted (removes it)
   */
  acknowledge(entryId: string): Promise<AgentResult<void>>;

  /**
   * Mark an entry as failed (increments retry count)
   */
  nack(entryId: string, reason: string): Promise<AgentResult<void>>;

  /**
   * Get queue statistics
   */
  getStats(): OfflineQueueStats;

  /**
   * Flush all expired entries
   */
  pruneExpired(): Promise<AgentResult<number>>;

  /**
   * Clear all entries (dangerous — prompts for confirmation in CLI)
   */
  clear(): Promise<AgentResult<void>>;

  /**
   * True if the queue has entries waiting
   */
  readonly hasPending: boolean;

  /**
   * Total number of pending entries
   */
  readonly pendingCount: number;
}

export interface OfflineQueueEntry {
  readonly id: string;
  readonly connectorId: ConnectorId;
  readonly agentId: AgentId;
  readonly kind: string;
  readonly payload: unknown;
  readonly enqueuedAt: Date;
  readonly expiresAt: Date;
  readonly retryCount: number;
  readonly maxRetries: number;
  readonly lastError?: string;
}

export interface OfflineQueueStats {
  readonly pendingCount: number;
  readonly totalEnqueued: number;
  readonly totalDelivered: number;
  readonly totalExpired: number;
  readonly totalFailed: number;
  readonly oldestEntryAge?: number;
  readonly estimatedSizeBytes: number;
}

// ─── Sync History ─────────────────────────────────────────────────────────

export interface SyncHistoryEntry {
  readonly jobId: SyncJobId;
  readonly connectorId: ConnectorId;
  readonly mode: SyncRunMode;
  readonly status: SyncRunStatus;
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly durationMs: number;
  readonly entitiesSynced: number;
  readonly bytesTransferred: number;
  readonly errorMessage?: string;
}

// ─── Sync Events ──────────────────────────────────────────────────────────

export type SyncEventKind =
  | 'sync-started'
  | 'sync-completed'
  | 'sync-failed'
  | 'sync-cancelled'
  | 'schema-discovered'
  | 'diff-computed'
  | 'payload-sent'
  | 'payload-queued'
  | 'queue-flushing'
  | 'queue-flushed'
  | 'checkpoint-saved';

export interface SyncEvent {
  readonly kind: SyncEventKind;
  readonly jobId?: SyncJobId;
  readonly connectorId: ConnectorId;
  readonly timestamp: Date;
  readonly data?: Record<string, unknown>;
}

export type SyncEventHandler = (event: SyncEvent) => void;

export interface SyncEventSubscription {
  unsubscribe(): void;
}

// ─── Sync Retry Policy ────────────────────────────────────────────────────

export interface SyncRetryPolicy {
  readonly maxAttempts: number;
  readonly initialDelayMs: number;
  readonly backoffMultiplier: number;
  readonly maxDelayMs: number;
  readonly jitter: boolean;
  readonly retryOn: string[];
}

export const DEFAULT_SYNC_RETRY_POLICY: SyncRetryPolicy = {
  maxAttempts: 5,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 60_000,
  jitter: true,
  retryOn: ['CLOUD_UNREACHABLE', 'NETWORK_ERROR', 'TIMEOUT'],
} as const;
