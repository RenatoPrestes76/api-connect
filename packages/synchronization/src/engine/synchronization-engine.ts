/**
 * SynchronizationEngine — HERMES top-level orchestrator.
 *
 * Lifecycle:
 *   start() → runs Full or Incremental sync
 *   pause()  → marks status PAUSED; workers finish current batch before stopping
 *   resume() → continues from checkpoint
 *   cancel() → aborts all in-flight work
 *
 * Every operation is READ-ONLY safe.
 * Every failure is checkpointed so resume() can continue from the exact record.
 */
import { randomUUID } from 'crypto';
import {
  type SyncConfig,
  type SyncJobId,
  type SyncStatus,
  type SyncEvent,
  type SyncEventKind,
  type SyncResult,
  type SyncRecord,
  type TableSyncConfig,
  type RecordValue,
  type TraceId,
  type TenantId,
  type CorrelationId,
  asSyncJobId,
  asTenantId,
  asCorrelationId,
  asTraceId,
  syncOk,
  syncFail,
  DEFAULT_BATCH_CONFIG,
} from '../types/index.js';
import { CheckpointManager } from '../checkpoint/checkpoint-manager.js';
import { RetryEngine } from '../retry/retry-engine.js';
import { assertReadOnly, buildExtractSql } from '../detection/change-detector.js';
import { CloudDispatcher } from '../dispatcher/cloud-dispatcher.js';
import { SyncPipeline } from '../pipeline/sync-pipeline.js';
import { MetricsCollector } from '../metrics/metrics-collector.js';
import { Telemetry } from '../telemetry/telemetry.js';
import { WorkerPool } from '../workers/worker-pool.js';

// ─── Query function interface (injected; decoupled from pg) ───────────────────

export type QueryFn = (
  sql: string,
  params: readonly RecordValue[]
) => Promise<readonly SyncRecord[]>;

export type EventHandler = (event: SyncEvent) => void;

// ─── Internal event context kept during a sync run ───────────────────────────

interface RunContext {
  jobId: SyncJobId;
  tenantId: TenantId;
  correlationId: CorrelationId;
  traceId: TraceId;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class SynchronizationEngine {
  private readonly _checkpoint = new CheckpointManager();
  private readonly _events: EventHandler[] = [];
  private _status: SyncStatus = 'IDLE';
  private _abortCtrl: AbortController = new AbortController();
  private _runCtx: RunContext | null = null;

  constructor(
    private readonly _dispatcher: CloudDispatcher,
    private readonly _log: Telemetry = new Telemetry({}, 'INFO')
  ) {}

  // ─── Public API ─────────────────────────────────────────────────────────

  on(handler: EventHandler): () => void {
    this._events.push(handler);
    return () => {
      const idx = this._events.indexOf(handler);
      if (idx !== -1) this._events.splice(idx, 1);
    };
  }

  get status(): SyncStatus {
    return this._status;
  }

  async start(config: SyncConfig, queryFn: QueryFn): Promise<SyncResult<void>> {
    if (this._status === 'RUNNING') {
      return syncFail('ALREADY_RUNNING', 'A sync job is already running for this engine');
    }

    this._abortCtrl = new AbortController();
    this._status = 'RUNNING';

    const traceId = asTraceId(randomUUID());
    this._runCtx = {
      jobId: config.jobId,
      tenantId: config.tenantId,
      correlationId: config.correlationId,
      traceId,
    };

    const log = this._log.child({
      jobId: config.jobId,
      tenantId: config.tenantId,
      correlationId: config.correlationId,
      traceId,
    });

    log.info(`HERMES: Starting ${config.mode} sync`, { tables: config.tables.length });

    const cpResult = await this._checkpoint.create({
      jobId: config.jobId,
      tenantId: config.tenantId,
      correlationId: config.correlationId,
      mode: config.mode,
      tables: config.tables.map((t) => ({
        schema: t.schema,
        table: t.table,
        detection: t.detection,
      })),
    });

    if (!cpResult.ok) return cpResult;

    this._emit({ kind: 'SyncStarted' });
    await this._checkpoint.updateStatus(config.jobId, 'RUNNING');

    const metrics = new MetricsCollector(config.jobId, config.mode);
    const retry = new RetryEngine(config.retry);

    const tables = [...config.tables].sort((a, b) => a.priority - b.priority);

    const pool = new WorkerPool<TableSyncConfig, void>(
      config.workers,
      async (tableConfig, signal) => {
        if (signal.aborted || this._abortCtrl.signal.aborted) return;

        const cpLoad = await this._checkpoint.load(config.jobId);
        const cp = cpLoad.ok ? cpLoad.value : null;

        if (cp && this._checkpoint.isTableComplete(cp, tableConfig.schema, tableConfig.table)) {
          log.info(`HERMES: Skipping completed table ${tableConfig.schema}.${tableConfig.table}`);
          return;
        }

        metrics.startTable(tableConfig.schema, tableConfig.table);

        const pipeline = new SyncPipeline(
          config.pipeline,
          metrics,
          log.child({ schema: tableConfig.schema, table: tableConfig.table }),
          this._checkpoint,
          this._dispatcher
        );

        await this._syncTable(tableConfig, config, queryFn, pipeline, metrics, retry, log, traceId);

        metrics.completeTable(tableConfig.schema, tableConfig.table);
      },
      this._abortCtrl.signal
    );

    try {
      await pool.runAll(tables);
    } catch (err) {
      log.error('HERMES: Sync failed', err);
      await this._checkpoint.updateStatus(config.jobId, 'FAILED', {
        error: (err as Error).message,
      });
      this._status = 'FAILED';
      this._emit({ kind: 'SyncFailed', error: (err as Error).message });
      return syncFail('SYNC_FAILED', (err as Error).message, { cause: err as Error });
    }

    if (this._abortCtrl.signal.aborted) {
      this._status = 'CANCELLED';
      this._emit({ kind: 'SyncCancelled' });
      await this._checkpoint.updateStatus(config.jobId, 'CANCELLED');
      return syncOk(undefined);
    }

    metrics.complete();
    this._status = 'COMPLETED';
    await this._checkpoint.updateStatus(config.jobId, 'COMPLETED');
    this._emit({ kind: 'SyncCompleted', metadata: { metrics: metrics.metrics() } });
    log.info('HERMES: Sync completed', { durationMs: metrics.metrics().durationMs });

    return syncOk(undefined);
  }

  async pause(jobId: SyncJobId): Promise<SyncResult<void>> {
    if (this._status !== 'RUNNING') {
      return syncFail('NOT_RUNNING', 'No running sync to pause');
    }
    this._status = 'PAUSED';
    await this._checkpoint.updateStatus(jobId, 'PAUSED');
    this._emit({ kind: 'SyncPaused' });
    return syncOk(undefined);
  }

  async resume(config: SyncConfig, queryFn: QueryFn): Promise<SyncResult<void>> {
    const existing = await this._checkpoint.load(config.jobId);
    if (!existing.ok || !existing.value) {
      return syncFail('NO_CHECKPOINT', `No checkpoint found for job ${config.jobId}`);
    }
    if (existing.value.status !== 'PAUSED' && existing.value.status !== 'FAILED') {
      return syncFail('CANNOT_RESUME', `Job is in status ${existing.value.status}, cannot resume`);
    }

    this._emit({ kind: 'SyncResumed' });
    await this._checkpoint.updateStatus(config.jobId, 'RUNNING');
    return this.start(config, queryFn);
  }

  cancel(jobId: SyncJobId): void {
    this._abortCtrl.abort();
    this._status = 'CANCELLED';
    void this._checkpoint.updateStatus(jobId, 'CANCELLED');
    this._emit({ kind: 'SyncCancelled' });
  }

  progress(jobId: SyncJobId): Promise<SyncResult<unknown>> {
    return this._checkpoint.load(jobId).then((r) => {
      if (!r.ok || !r.value) return syncFail('NOT_FOUND', `No checkpoint for job ${jobId}`);
      return syncOk(r.value);
    });
  }

  // ─── Table sync ─────────────────────────────────────────────────────────

  private async _syncTable(
    tableConfig: TableSyncConfig,
    config: SyncConfig,
    queryFn: QueryFn,
    pipeline: SyncPipeline,
    metrics: MetricsCollector,
    retry: RetryEngine,
    log: Telemetry,
    traceId: TraceId
  ): Promise<void> {
    const { schema, table } = tableConfig;
    const batchCfg = { ...DEFAULT_BATCH_CONFIG, ...(tableConfig.batchConfig ?? {}) };

    const cpLoad = await this._checkpoint.load(config.jobId);
    const cp = cpLoad.ok ? cpLoad.value : null;
    const since: RecordValue = cp ? this._checkpoint.getLastValue(cp, schema, table) : null;

    await this._checkpoint.updateTable(config.jobId, schema, table, { status: 'IN_PROGRESS' });
    this._emit({ kind: 'TableStarted', schema, table });

    const colSql = `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`;
    assertReadOnly(colSql);
    const colRows = await queryFn(colSql, [schema, table]);
    const columns = colRows.map((r) => String(r['column_name'] ?? ''));

    let offset = cp?.tables.get(`${schema}.${table}`)?.lastOffset ?? 0;
    let lastValue: RecordValue = since;
    let totalSynced = 0;

    while (!this._abortCtrl.signal.aborted && this._status !== 'PAUSED') {
      const { sql, params, sinceCol } = buildExtractSql(
        schema,
        table,
        tableConfig,
        columns,
        since,
        offset,
        batchCfg.size
      );

      const result = await retry.execute(
        async () => queryFn(sql, params),
        `${schema}.${table} offset=${offset}`
      );

      if (!result.ok) {
        log.error(`HERMES: Extract failed for ${schema}.${table}`, undefined, {
          error: result.error.message,
        });
        await this._checkpoint.updateTable(config.jobId, schema, table, { status: 'FAILED' });
        this._emit({ kind: 'TableFailed', schema, table, error: result.error.message });
        throw new Error(result.error.message);
      }

      const rows = result.value;
      if (rows.length === 0) break;

      if (sinceCol) {
        const lastRow = rows[rows.length - 1];
        if (lastRow) lastValue = (lastRow[sinceCol] as RecordValue) ?? lastValue;
      }

      const batchResult = await pipeline.processBatch(
        { records: rows, schema, table },
        {
          jobId: config.jobId,
          tableConfig,
          dispatchOptions: {
            correlationId: config.correlationId,
            tenantId: config.tenantId,
          },
        }
      );

      if (!batchResult.ok) {
        log.error(`HERMES: Batch pipeline failed`, undefined, { error: batchResult.error.message });
        if (!batchResult.error.retryable) throw new Error(batchResult.error.message);
      }

      const dispatched = batchResult.ok ? batchResult.value : 0;
      totalSynced += dispatched;
      offset += rows.length;

      await this._checkpoint.updateTable(config.jobId, schema, table, {
        lastOffset: offset,
        lastValue,
        recordsSynced: totalSynced,
      });
      this._emit({ kind: 'CheckpointSaved', schema, table, records: totalSynced });

      if (batchCfg.pauseMs > 0) {
        await new Promise((r) => setTimeout(r, batchCfg.pauseMs));
      }

      if (rows.length < batchCfg.size) break;
    }

    await this._checkpoint.updateTable(config.jobId, schema, table, {
      status: 'COMPLETED',
      lastValue,
      recordsSynced: totalSynced,
    });
    this._emit({ kind: 'TableCompleted', schema, table, records: totalSynced });
  }

  // ─── Event emission ──────────────────────────────────────────────────────

  private _emit(partial: {
    kind: SyncEventKind;
    schema?: string;
    table?: string;
    records?: number;
    error?: string;
    metadata?: Readonly<Record<string, unknown>>;
  }): void {
    const ctx = this._runCtx;
    const event: SyncEvent = {
      kind: partial.kind,
      jobId: ctx?.jobId ?? asSyncJobId(''),
      tenantId: ctx?.tenantId ?? asTenantId(''),
      correlationId: ctx?.correlationId ?? asCorrelationId(''),
      traceId: ctx?.traceId ?? asTraceId(''),
      timestamp: new Date().toISOString(),
      schema: partial.schema,
      table: partial.table,
      records: partial.records,
      error: partial.error,
      metadata: partial.metadata ?? {},
    };

    for (const handler of this._events) {
      try {
        handler(event);
      } catch {
        /* observer errors must not affect sync logic */
      }
    }
  }
}
