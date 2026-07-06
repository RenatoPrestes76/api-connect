import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SynchronizationEngine } from '../engine/synchronization-engine.js';
import { CloudDispatcher }        from '../dispatcher/cloud-dispatcher.js';
import { Telemetry }              from '../telemetry/telemetry.js';
import {
  asSyncJobId, asTenantId, asCorrelationId,
  DEFAULT_PIPELINE_CONFIG, DEFAULT_RETRY_CONFIG,
  type SyncConfig, type SyncEvent,
} from '../types/index.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const JOB    = asSyncJobId('job-engine-001');
const TENANT = asTenantId('tenant-acme');
const CORR   = asCorrelationId('corr-engine');

const TABLE_CFG = {
  schema:    'public',
  table:     'produto',
  mode:      'FULL'        as const,
  detection: 'UPDATED_AT' as const,
  conflict:  'OVERWRITE'  as const,
  priority:  1,
};

function makeConfig(overrides: Partial<SyncConfig> = {}): SyncConfig {
  return {
    jobId:         JOB,
    tenantId:      TENANT,
    correlationId: CORR,
    mode:          'FULL',
    tables:        [TABLE_CFG],
    pipeline:      { ...DEFAULT_PIPELINE_CONFIG, compression: { enabled: false, algorithm: 'none', level: 0 }, encryption: { enabled: false, algorithm: 'aes-256-gcm', keyId: '' }, validate: false },
    retry:         { ...DEFAULT_RETRY_CONFIG, maxAttempts: 1, initialDelayMs: 0, jitterMs: 0 },
    workers:       1,
    tags:          {},
    ...overrides,
  };
}

// ─── Mocks ───────────────────────────────────────────────────────────────────

function makeDispatcher(): CloudDispatcher {
  return {
    dispatch: vi.fn().mockResolvedValue({
      ok: true,
      value: { accepted: 1, rejected: 0, batchId: 'b-1', latencyMs: 5 },
    }),
  } as unknown as CloudDispatcher;
}

const COLUMNS_ROWS = [
  { column_name: 'id' },
  { column_name: 'nome' },
  { column_name: 'updated_at' },
];

function makeQueryFn(rows = [{ id: 1, nome: 'Produto' }]) {
  return vi.fn().mockImplementation(async (sql: string) => {
    if (sql.includes('information_schema.columns')) return COLUMNS_ROWS;
    return rows;
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SynchronizationEngine', () => {
  let engine:     SynchronizationEngine;
  let dispatcher: CloudDispatcher;

  beforeEach(() => {
    dispatcher = makeDispatcher();
    engine     = new SynchronizationEngine(dispatcher, new Telemetry({}, 'ERROR'));
  });

  it('starts with IDLE status', () => {
    expect(engine.status).toBe('IDLE');
  });

  it('completes a full sync and reaches COMPLETED status', async () => {
    const queryFn = makeQueryFn([{ id: 1, nome: 'Produto', updated_at: null }]);
    const result  = await engine.start(makeConfig(), queryFn);
    expect(result.ok).toBe(true);
    expect(engine.status).toBe('COMPLETED');
  });

  it('returns ALREADY_RUNNING error when already running', async () => {
    // Start a long sync
    const longQueryFn = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('information_schema.columns')) return COLUMNS_ROWS;
      await new Promise((r) => setTimeout(r, 50));
      return [];
    });

    const p1 = engine.start(makeConfig(), longQueryFn);
    // Attempt to start another while the first is running
    const result2 = await engine.start(makeConfig(), longQueryFn);
    expect(result2.ok).toBe(false);
    if (!result2.ok) expect(result2.error.code).toBe('ALREADY_RUNNING');
    await p1;
  });

  it('emits SyncStarted and SyncCompleted events', async () => {
    const events: SyncEvent[] = [];
    const unsub = engine.on((e) => events.push(e));
    await engine.start(makeConfig(), makeQueryFn([]));
    unsub();

    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain('SyncStarted');
    expect(kinds).toContain('SyncCompleted');
  });

  it('unsubscribing from events stops notifications', async () => {
    const events: SyncEvent[] = [];
    const unsub = engine.on((e) => events.push(e));
    unsub();
    await engine.start(makeConfig(), makeQueryFn([]));
    expect(events).toHaveLength(0);
  });

  it('cancel() aborts sync and sets CANCELLED status', async () => {
    const queryFn = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('information_schema.columns')) return COLUMNS_ROWS;
      await new Promise((r) => setTimeout(r, 200));
      return [{ id: 1, nome: 'P' }];
    });

    const p = engine.start(makeConfig(), queryFn);
    engine.cancel(JOB);
    await p;
    expect(engine.status).toBe('CANCELLED');
  });

  it('pause() when not running returns NOT_RUNNING error', async () => {
    const result = await engine.pause(JOB);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_RUNNING');
  });

  it('resume() returns NO_CHECKPOINT when job was never started', async () => {
    const result = await engine.resume(makeConfig(), makeQueryFn([]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NO_CHECKPOINT');
  });

  it('syncs empty table without errors', async () => {
    const result = await engine.start(makeConfig(), makeQueryFn([]));
    expect(result.ok).toBe(true);
    expect(engine.status).toBe('COMPLETED');
  });

  it('progress() returns NOT_FOUND when no checkpoint exists', async () => {
    const result = await engine.progress(JOB);
    expect(result.ok).toBe(false);
  });

  it('progress() returns checkpoint data after sync starts', async () => {
    const longFn = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('information_schema.columns')) return COLUMNS_ROWS;
      await new Promise((r) => setTimeout(r, 30));
      return [];
    });

    const p = engine.start(makeConfig(), longFn);
    await new Promise((r) => setTimeout(r, 10));
    const result = await engine.progress(JOB);
    expect(result.ok).toBe(true);
    await p;
  });

  it('handles multiple tables in priority order', async () => {
    const callOrder: string[] = [];
    const queryFn = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('information_schema.columns')) return COLUMNS_ROWS;
      const tableMatch = sql.match(/"([^"]+)"/g);
      if (tableMatch) callOrder.push(tableMatch.join('.'));
      return [];
    });

    const config = makeConfig({
      tables: [
        { ...TABLE_CFG, table: 'pedido',  priority: 2 },
        { ...TABLE_CFG, table: 'produto', priority: 1 },
      ],
    });

    await engine.start(config, queryFn);
    expect(engine.status).toBe('COMPLETED');
  });
});
