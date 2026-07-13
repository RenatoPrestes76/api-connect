/**
 * MetricsCollector — accumulates real-time sync metrics.
 *
 * Provides:
 *  - Per-table metrics (records, bytes, timing)
 *  - Overall job metrics
 *  - Dashboard DTO (progress + ETA)
 *  - Throughput calculation (sliding window, last 10 seconds)
 */
import type {
  SyncJobId,
  SyncMode,
  SyncStatus,
  SyncMetrics,
  TableMetrics,
  SyncProgressDTO,
} from '../types/index.js';

interface TableAccumulator {
  schema: string;
  table: string;
  startedAt: number;
  completedAt: number | null;
  recordsTotal: number;
  recordsSynced: number;
  recordsFailed: number;
  recordsSkipped: number;
  batchCount: number;
  bytesProcessed: number;
}

interface ThroughputSample {
  at: number;
  records: number;
  bytes: number;
}

export class MetricsCollector {
  private readonly _jobId: SyncJobId;
  private readonly _mode: SyncMode;
  private readonly _startedAt: number;
  private _status: SyncStatus = 'RUNNING';
  private _completedAt: number | null = null;

  private readonly _tables = new Map<string, TableAccumulator>();
  private _retryCount = 0;
  private _conflictsDetected = 0;
  private _conflictsResolved = 0;
  private _peakMemoryMb = 0;
  private _totalBatches = 0;
  private _bytesProcessed = 0;
  private _bytesCompressed = 0;
  private readonly _samples: ThroughputSample[] = [];
  private _totalRecords: number | null = null;
  private _currentTable: string | null = null;
  private _currentSchema: string | null = null;

  constructor(jobId: SyncJobId, mode: SyncMode) {
    this._jobId = jobId;
    this._mode = mode;
    this._startedAt = Date.now();
  }

  // ─── Table lifecycle ──────────────────────────────────────────────────────

  startTable(schema: string, table: string, estimatedRows?: number): void {
    const key = `${schema}.${table}`;
    this._tables.set(key, {
      schema,
      table,
      startedAt: Date.now(),
      completedAt: null,
      recordsTotal: estimatedRows ?? 0,
      recordsSynced: 0,
      recordsFailed: 0,
      recordsSkipped: 0,
      batchCount: 0,
      bytesProcessed: 0,
    });
    this._currentSchema = schema;
    this._currentTable = table;
  }

  completeTable(schema: string, table: string): void {
    const acc = this._tables.get(`${schema}.${table}`);
    if (acc) acc.completedAt = Date.now();
  }

  // ─── Record / batch ───────────────────────────────────────────────────────

  recordSynced(schema: string, table: string, count = 1, bytes = 0): void {
    const acc = this._tables.get(`${schema}.${table}`);
    if (acc) {
      acc.recordsSynced += count;
      acc.bytesProcessed += bytes;
    }
    this._bytesProcessed += bytes;
    this._addSample(count, bytes);
    this._sampleMemory();
  }

  recordFailed(schema: string, table: string, count = 1): void {
    const acc = this._tables.get(`${schema}.${table}`);
    if (acc) acc.recordsFailed += count;
  }

  recordSkipped(schema: string, table: string, count = 1): void {
    const acc = this._tables.get(`${schema}.${table}`);
    if (acc) acc.recordsSkipped += count;
  }

  batchDispatched(
    schema: string,
    table: string,
    originalBytes: number,
    compressedBytes: number
  ): void {
    const acc = this._tables.get(`${schema}.${table}`);
    if (acc) acc.batchCount++;
    this._totalBatches++;
    this._bytesCompressed += compressedBytes;
    if (originalBytes > 0) this._bytesProcessed = Math.max(this._bytesProcessed, originalBytes);
  }

  // ─── Job level ────────────────────────────────────────────────────────────

  setTotalRecords(n: number): void {
    this._totalRecords = n;
  }
  retryOccurred(): void {
    this._retryCount++;
  }
  conflictDetected(): void {
    this._conflictsDetected++;
  }
  conflictResolved(): void {
    this._conflictsResolved++;
  }
  complete(): void {
    this._completedAt = Date.now();
    this._status = 'COMPLETED';
  }
  fail(): void {
    this._status = 'FAILED';
  }
  pause(): void {
    this._status = 'PAUSED';
  }
  resume(): void {
    this._status = 'RUNNING';
  }

  // ─── Snapshots ────────────────────────────────────────────────────────────

  metrics(): SyncMetrics {
    const tables: TableMetrics[] = [];
    for (const acc of this._tables.values()) {
      const duration = (acc.completedAt ?? Date.now()) - acc.startedAt;
      tables.push({
        schema: acc.schema,
        table: acc.table,
        recordsTotal: acc.recordsTotal,
        recordsSynced: acc.recordsSynced,
        recordsFailed: acc.recordsFailed,
        recordsSkipped: acc.recordsSkipped,
        batchCount: acc.batchCount,
        bytesProcessed: acc.bytesProcessed,
        durationMs: duration,
        recordsPerSec: duration > 0 ? (acc.recordsSynced / duration) * 1000 : 0,
        mbPerSec: duration > 0 ? acc.bytesProcessed / duration / 1000 : 0,
      });
    }

    const totalDuration = (this._completedAt ?? Date.now()) - this._startedAt;
    const totalSynced = tables.reduce((s, t) => s + t.recordsSynced, 0);
    const totalFailed = tables.reduce((s, t) => s + t.recordsFailed, 0);
    const totalSkipped = tables.reduce((s, t) => s + t.recordsSkipped, 0);
    const avgRps = totalDuration > 0 ? (totalSynced / totalDuration) * 1000 : 0;
    const avgMbps = totalDuration > 0 ? this._bytesProcessed / totalDuration / 1000 : 0;
    const compressionRatio =
      this._bytesProcessed > 0 ? this._bytesCompressed / this._bytesProcessed : 1;

    return {
      jobId: this._jobId,
      startedAt: new Date(this._startedAt).toISOString(),
      completedAt: this._completedAt ? new Date(this._completedAt).toISOString() : undefined,
      durationMs: totalDuration,
      tables,
      totalRecords: this._totalRecords ?? tables.reduce((s, t) => s + t.recordsTotal, 0),
      syncedRecords: totalSynced,
      failedRecords: totalFailed,
      skippedRecords: totalSkipped,
      totalBatches: this._totalBatches,
      bytesProcessed: this._bytesProcessed,
      bytesCompressed: this._bytesCompressed,
      compressionRatio,
      avgRecordsPerSec: avgRps,
      avgMbPerSec: avgMbps,
      peakMemoryMb: this._peakMemoryMb,
      retryCount: this._retryCount,
      conflictsDetected: this._conflictsDetected,
      conflictsResolved: this._conflictsResolved,
    };
  }

  progress(): SyncProgressDTO {
    const elapsed = Date.now() - this._startedAt;
    const metrics = this.metrics();
    const synced = metrics.syncedRecords;
    const total = this._totalRecords;
    const pct = total != null && total > 0 ? Math.min(100, Math.round((synced / total) * 100)) : 0;
    const rps = this._calcThroughputRps();
    const remaining = total != null && rps > 0 ? Math.round(((total - synced) / rps) * 1000) : null;

    return {
      jobId: this._jobId,
      status: this._status,
      mode: this._mode,
      progressPercent: pct,
      currentSchema: this._currentSchema,
      currentTable: this._currentTable,
      currentRecord: synced,
      totalRecords: total,
      recordsPerSec: rps,
      elapsedMs: elapsed,
      estimatedRemainingMs: remaining,
      completedTables: [...this._tables.values()].filter((t) => t.completedAt !== null).length,
      totalTables: this._tables.size,
      errors: metrics.failedRecords,
    };
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private _addSample(records: number, bytes: number): void {
    const now = Date.now();
    this._samples.push({ at: now, records, bytes });
    // Keep only last 10 seconds of samples
    const cutoff = now - 10_000;
    while (this._samples.length > 0 && this._samples[0]!.at < cutoff) {
      this._samples.shift();
    }
  }

  private _calcThroughputRps(): number {
    if (this._samples.length === 0) return 0;
    const windowMs = Date.now() - (this._samples[0]?.at ?? Date.now());
    if (windowMs < 100) return 0;
    const totalRecords = this._samples.reduce((s, x) => s + x.records, 0);
    return Math.round((totalRecords / windowMs) * 1000);
  }

  private _sampleMemory(): void {
    try {
      const { heapUsed } = process.memoryUsage();
      const mb = heapUsed / 1_048_576;
      if (mb > this._peakMemoryMb) this._peakMemoryMb = mb;
    } catch {
      /* process may not be available in all environments */
    }
  }
}
