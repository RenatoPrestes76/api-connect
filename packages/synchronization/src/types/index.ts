/**
 * HERMES — Intelligent Synchronization Engine
 * Core domain types. All values are immutable; mutations produce new instances.
 */

// ─── Identifiers ──────────────────────────────────────────────────────────────

export type SyncJobId = string & { readonly _brand: 'SyncJobId' };
export type TenantId = string & { readonly _brand: 'TenantId' };
export type CorrelationId = string & { readonly _brand: 'CorrelationId' };
export type TraceId = string & { readonly _brand: 'TraceId' };
export type CheckpointId = string & { readonly _brand: 'CheckpointId' };
export type BatchId = string & { readonly _brand: 'BatchId' };

export const asSyncJobId = (s: string): SyncJobId => s as SyncJobId;
export const asTenantId = (s: string): TenantId => s as TenantId;
export const asCorrelationId = (s: string): CorrelationId => s as CorrelationId;
export const asTraceId = (s: string): TraceId => s as TraceId;
export const asCheckpointId = (s: string): CheckpointId => s as CheckpointId;
export const asBatchId = (s: string): BatchId => s as BatchId;

// ─── Sync Modes ───────────────────────────────────────────────────────────────

export type SyncMode =
  | 'FULL' // All records, first sync or forced reset
  | 'INCREMENTAL' // Only changed records since last sync
  | 'SNAPSHOT' // Point-in-time snapshot, stored separately
  | 'SCHEDULED' // Triggered by the scheduler
  | 'MANUAL'; // Triggered by user/API

export type SyncStatus =
  | 'IDLE'
  | 'PENDING'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'RECOVERING';

// ─── Change Detection ─────────────────────────────────────────────────────────

export type ChangeDetectionStrategyKind =
  | 'UPDATED_AT' // updated_at / atualizado_em column
  | 'CREATED_AT' // created_at column (insert-only detection)
  | 'XMIN' // PostgreSQL system column xmin (transaction ID)
  | 'ROW_HASH' // MD5 hash of entire row
  | 'CHECKSUM' // CRC32 checksum
  | 'COMPARISON' // Full row comparison (last resort)
  | 'NONE'; // No change detection; always full-sync

// ─── Conflict Resolution ──────────────────────────────────────────────────────

export type ConflictResolutionStrategy =
  | 'SKIP' // Keep existing, discard incoming
  | 'OVERWRITE' // Replace existing with incoming
  | 'MERGE' // Merge fields (incoming wins on conflict)
  | 'VERSION' // Keep highest version number
  | 'CUSTOM'; // User-provided resolver function

// ─── Batch Configuration ──────────────────────────────────────────────────────

export interface BatchConfig {
  readonly size: number; // Records per batch
  readonly adaptive: boolean; // Auto-adjust based on throughput
  readonly minSize: number;
  readonly maxSize: number;
  readonly pauseMs: number; // Pause between batches (back-pressure)
}

export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  size: 1_000,
  adaptive: true,
  minSize: 100,
  maxSize: 10_000,
  pauseMs: 0,
};

// ─── Retry Configuration ──────────────────────────────────────────────────────

export interface RetryConfig {
  readonly maxAttempts: number;
  readonly initialDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffMultiplier: number;
  readonly jitterMs: number;
  readonly retryableErrors: readonly string[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 5_000,
  maxDelayMs: 60_000,
  backoffMultiplier: 3,
  jitterMs: 500,
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'NETWORK_ERROR', 'RATE_LIMIT'],
};

// ─── Pipeline Configuration ───────────────────────────────────────────────────

export interface CompressionConfig {
  readonly enabled: boolean;
  readonly algorithm: 'gzip' | 'brotli' | 'none';
  readonly level: number; // 1-9 for gzip, 0-11 for brotli
}

export interface EncryptionConfig {
  readonly enabled: boolean;
  readonly algorithm: 'aes-256-gcm';
  readonly keyId: string;
}

export interface PipelineConfig {
  readonly compression: CompressionConfig;
  readonly encryption: EncryptionConfig;
  readonly validate: boolean;
  readonly batchConfig: BatchConfig;
}

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  compression: { enabled: true, algorithm: 'gzip', level: 6 },
  encryption: { enabled: false, algorithm: 'aes-256-gcm', keyId: '' },
  validate: true,
  batchConfig: DEFAULT_BATCH_CONFIG,
};

// ─── Sync Configuration ───────────────────────────────────────────────────────

export interface TableSyncConfig {
  readonly schema: string;
  readonly table: string;
  readonly mode: SyncMode;
  readonly detection: ChangeDetectionStrategyKind;
  readonly conflict: ConflictResolutionStrategy;
  readonly batchConfig?: Partial<BatchConfig>;
  readonly filter?: string; // SQL WHERE clause fragment (READ-ONLY safe)
  readonly orderBy?: string; // column name for deterministic ordering
  readonly priority: number; // Lower = higher priority (1 = highest)
}

export interface SyncConfig {
  readonly jobId: SyncJobId;
  readonly tenantId: TenantId;
  readonly correlationId: CorrelationId;
  readonly mode: SyncMode;
  readonly tables: readonly TableSyncConfig[];
  readonly pipeline: PipelineConfig;
  readonly retry: RetryConfig;
  readonly workers: number;
  readonly scheduledAt?: string; // ISO 8601 for SCHEDULED mode
  readonly tags: Readonly<Record<string, string>>;
}

// ─── Records ──────────────────────────────────────────────────────────────────

export type RecordValue = string | number | boolean | null | Date;
export type SyncRecord = Readonly<Record<string, RecordValue>>;

export type RecordOperation = 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT';

export interface ExtractedRecord {
  readonly schema: string;
  readonly table: string;
  readonly operation: RecordOperation;
  readonly data: SyncRecord;
  readonly checksum?: string;
  readonly xmin?: string;
}

export interface ValidatedRecord extends ExtractedRecord {
  readonly validatedAt: string;
  readonly isValid: boolean;
  readonly violations: readonly string[];
}

export interface CompressedBatch {
  readonly batchId: BatchId;
  readonly schema: string;
  readonly table: string;
  readonly records: number;
  readonly payload: Buffer;
  readonly compressed: boolean;
  readonly algorithm: string;
  readonly originalSize: number;
  readonly compressedSize: number;
}

export interface EncryptedBatch extends Omit<CompressedBatch, 'payload'> {
  readonly payload: Buffer;
  readonly encrypted: boolean;
  readonly keyId: string;
  readonly iv: string;
  readonly authTag: string;
}

// ─── Checkpoint ───────────────────────────────────────────────────────────────

export interface TableCheckpoint {
  readonly schema: string;
  readonly table: string;
  readonly lastSyncedAt: string; // ISO 8601
  readonly lastValue: RecordValue; // Value of detection column (updated_at, xmin, etc.)
  readonly lastOffset: number; // Record offset within the table
  readonly recordsSynced: number;
  readonly status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  readonly detection: ChangeDetectionStrategyKind;
}

export interface SyncCheckpoint {
  readonly id: CheckpointId;
  readonly jobId: SyncJobId;
  readonly tenantId: TenantId;
  readonly correlationId: CorrelationId;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly mode: SyncMode;
  readonly status: SyncStatus;
  readonly totalTables: number;
  readonly completedTables: number;
  readonly totalRecords: number;
  readonly syncedRecords: number;
  readonly failedRecords: number;
  readonly tables: ReadonlyMap<string, TableCheckpoint>;
  readonly lastError: string | null;
  readonly retryCount: number;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export type SyncEventKind =
  | 'SyncStarted'
  | 'SyncPaused'
  | 'SyncResumed'
  | 'SyncCompleted'
  | 'SyncFailed'
  | 'SyncCancelled'
  | 'TableStarted'
  | 'TableCompleted'
  | 'TableFailed'
  | 'BatchDispatched'
  | 'BatchConfirmed'
  | 'BatchFailed'
  | 'CheckpointSaved'
  | 'RetryStarted'
  | 'RetryCompleted'
  | 'RetryExhausted'
  | 'ConflictDetected'
  | 'ConflictResolved';

export interface SyncEvent {
  readonly kind: SyncEventKind;
  readonly jobId: SyncJobId;
  readonly tenantId: TenantId;
  readonly correlationId: CorrelationId;
  readonly traceId: TraceId;
  readonly timestamp: string;
  readonly schema?: string;
  readonly table?: string;
  readonly batchId?: BatchId;
  readonly records?: number;
  readonly error?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

// ─── Telemetry ────────────────────────────────────────────────────────────────

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface StructuredLog {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: string;
  readonly jobId?: SyncJobId;
  readonly tenantId?: TenantId;
  readonly correlationId?: CorrelationId;
  readonly traceId?: TraceId;
  readonly schema?: string;
  readonly table?: string;
  readonly durationMs?: number;
  readonly error?: string;
  readonly stack?: string;
  readonly fields: Readonly<Record<string, unknown>>;
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

export interface TableMetrics {
  readonly schema: string;
  readonly table: string;
  readonly recordsTotal: number;
  readonly recordsSynced: number;
  readonly recordsFailed: number;
  readonly recordsSkipped: number;
  readonly batchCount: number;
  readonly bytesProcessed: number;
  readonly durationMs: number;
  readonly recordsPerSec: number;
  readonly mbPerSec: number;
}

export interface SyncMetrics {
  readonly jobId: SyncJobId;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly durationMs: number;
  readonly tables: readonly TableMetrics[];
  readonly totalRecords: number;
  readonly syncedRecords: number;
  readonly failedRecords: number;
  readonly skippedRecords: number;
  readonly totalBatches: number;
  readonly bytesProcessed: number;
  readonly bytesCompressed: number;
  readonly compressionRatio: number;
  readonly avgRecordsPerSec: number;
  readonly avgMbPerSec: number;
  readonly peakMemoryMb: number;
  readonly retryCount: number;
  readonly conflictsDetected: number;
  readonly conflictsResolved: number;
}

// ─── Dashboard DTOs ───────────────────────────────────────────────────────────

export interface SyncProgressDTO {
  readonly jobId: SyncJobId;
  readonly status: SyncStatus;
  readonly mode: SyncMode;
  readonly progressPercent: number;
  readonly currentSchema: string | null;
  readonly currentTable: string | null;
  readonly currentRecord: number;
  readonly totalRecords: number | null;
  readonly recordsPerSec: number;
  readonly elapsedMs: number;
  readonly estimatedRemainingMs: number | null;
  readonly completedTables: number;
  readonly totalTables: number;
  readonly errors: number;
}

// ─── Result Pattern ───────────────────────────────────────────────────────────

export type SyncResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: SyncError };

export interface SyncError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly cause?: Error;
  readonly context?: Readonly<Record<string, unknown>>;
}

export function syncOk<T>(value: T): SyncResult<T> {
  return { ok: true, value };
}

export function syncFail<T>(
  code: string,
  message: string,
  options: { retryable?: boolean; cause?: Error; context?: Record<string, unknown> } = {}
): SyncResult<T> {
  return {
    ok: false,
    error: {
      code,
      message,
      retryable: options.retryable ?? false,
      cause: options.cause,
      context: options.context,
    },
  };
}

// ─── Queue ────────────────────────────────────────────────────────────────────

export type QueuePriority = 1 | 2 | 3 | 4 | 5; // 1 = highest

export interface QueueItem<T> {
  readonly id: string;
  readonly payload: T;
  readonly priority: QueuePriority;
  readonly enqueuedAt: number;
  readonly attempts: number;
  readonly lastError?: string;
}

// ─── Change Detection Result ──────────────────────────────────────────────────

export interface DetectedChange {
  readonly schema: string;
  readonly table: string;
  readonly strategy: ChangeDetectionStrategyKind;
  readonly since: RecordValue;
  readonly until: RecordValue;
  readonly estimated: number | null;
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export interface DispatchTarget {
  readonly url: string;
  readonly apiKey: string;
  readonly timeout: number;
}

export interface DispatchResult {
  readonly batchId: BatchId;
  readonly accepted: number;
  readonly rejected: number;
  readonly serverRef: string;
  readonly latencyMs: number;
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface FieldSchema {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
  readonly nullable: boolean;
}

export interface TableSchema {
  readonly schema: string;
  readonly table: string;
  readonly fields: readonly FieldSchema[];
}

export interface ValidationResult {
  readonly record: SyncRecord;
  readonly isValid: boolean;
  readonly violations: readonly string[];
}
