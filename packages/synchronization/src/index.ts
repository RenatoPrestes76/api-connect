/**
 * @seltriva/synchronization — HERMES Intelligent Synchronization Engine
 */

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  SyncJobId, TenantId, CorrelationId, TraceId, CheckpointId, BatchId,
  SyncMode, SyncStatus, ConflictResolutionStrategy, ChangeDetectionStrategyKind,
  BatchConfig, RetryConfig, PipelineConfig, CompressionConfig, EncryptionConfig,
  TableSyncConfig, SyncConfig,
  RecordValue, SyncRecord, RecordOperation,
  ExtractedRecord, ValidatedRecord, CompressedBatch, EncryptedBatch,
  TableCheckpoint, SyncCheckpoint,
  SyncEventKind, SyncEvent,
  LogLevel, StructuredLog,
  TableMetrics, SyncMetrics, SyncProgressDTO,
  SyncResult, SyncError,
  QueuePriority, QueueItem,
  DetectedChange,
  DispatchTarget, DispatchResult,
  FieldSchema, TableSchema, ValidationResult,
} from './types/index.js';

export {
  asSyncJobId, asTenantId, asCorrelationId, asTraceId, asCheckpointId, asBatchId,
  syncOk, syncFail,
  DEFAULT_BATCH_CONFIG, DEFAULT_RETRY_CONFIG, DEFAULT_PIPELINE_CONFIG,
} from './types/index.js';

// ─── Engine ───────────────────────────────────────────────────────────────────
export { SynchronizationEngine, type QueryFn, type EventHandler } from './engine/index.js';

// ─── Checkpoint ───────────────────────────────────────────────────────────────
export { CheckpointManager, type CheckpointStore } from './checkpoint/index.js';

// ─── Pipeline ─────────────────────────────────────────────────────────────────
export { SyncPipeline, type PipelineContext, type ExtractInput } from './pipeline/index.js';

// ─── Change Detection ────────────────────────────────────────────────────────
export {
  ChangeDetector, ReadOnlyViolationError, assertReadOnly,
  selectStrategy, buildExtractSql, hashRecord,
} from './detection/index.js';

// ─── Queue ────────────────────────────────────────────────────────────────────
export {
  PriorityQueue, RetryQueue, DeadLetterQueue, QueueManager,
  type DeadLetterEntry,
} from './queue/index.js';

// ─── Retry ────────────────────────────────────────────────────────────────────
export { RetryEngine, type RetryAttempt, type RetryObserver } from './retry/index.js';

// ─── Workers ─────────────────────────────────────────────────────────────────
export { WorkerPool, pMap, type WorkerPoolStats } from './workers/index.js';

// ─── Compression ─────────────────────────────────────────────────────────────
export { Compressor, type CompressResult } from './compression/index.js';

// ─── Encryption ──────────────────────────────────────────────────────────────
export { Encryptor, type EncryptResult } from './encryption/index.js';

// ─── Validation ──────────────────────────────────────────────────────────────
export { ValidationEngine } from './validation/index.js';

// ─── Conflict Resolution ─────────────────────────────────────────────────────
export {
  ConflictResolver,
  type ConflictContext, type ConflictResolutionResult, type CustomResolverFn,
} from './conflict/index.js';

// ─── Telemetry ────────────────────────────────────────────────────────────────
export { Telemetry, type LogObserver, type TelemetryContext } from './telemetry/index.js';

// ─── Metrics ─────────────────────────────────────────────────────────────────
export { MetricsCollector } from './metrics/index.js';

// ─── Dispatcher ───────────────────────────────────────────────────────────────
export { CloudDispatcher, type DispatchOptions } from './dispatcher/index.js';

// ─── Scheduler ───────────────────────────────────────────────────────────────
export {
  SyncScheduler,
  type ScheduledJob, type ScheduledJobRunner,
} from './scheduler/index.js';

// ─── Snapshot ────────────────────────────────────────────────────────────────
export {
  SnapshotManager,
  type DatabaseSnapshot, type TableSnapshot,
} from './snapshot/index.js';
