import { describe, it, expect, vi } from 'vitest';
import { SyncPipeline } from '../pipeline/sync-pipeline.js';
import type { PipelineContext, ExtractInput } from '../pipeline/sync-pipeline.js';
import { ValidationEngine } from '../validation/validation-engine.js';
import { CheckpointManager } from '../checkpoint/checkpoint-manager.js';
import { MetricsCollector } from '../metrics/metrics-collector.js';
import { Telemetry } from '../telemetry/telemetry.js';
import { CloudDispatcher } from '../dispatcher/cloud-dispatcher.js';
import { asSyncJobId, asCorrelationId, asTenantId, DEFAULT_BATCH_CONFIG } from '../types/index.js';
import type { TableSyncConfig, TableSchema, PipelineConfig } from '../types/index.js';

const TABLE_CFG: TableSyncConfig = {
  schema: 'public',
  table: 'produto',
  mode: 'FULL',
  detection: 'UPDATED_AT',
  conflict: 'OVERWRITE',
  priority: 1,
};

const BASE_CONFIG: PipelineConfig = {
  compression: { enabled: false, algorithm: 'gzip', level: 6 },
  encryption: { enabled: false, algorithm: 'aes-256-gcm', keyId: '' },
  validate: false,
  batchConfig: DEFAULT_BATCH_CONFIG,
};

function makeDispatcher(result?: object) {
  return {
    dispatch: vi.fn().mockResolvedValue(
      result ?? {
        ok: true,
        value: { accepted: 2, rejected: 0, batchId: 'b-1', latencyMs: 5, serverRef: 'srv-1' },
      }
    ),
  } as unknown as CloudDispatcher;
}

function makeContext(): PipelineContext {
  return {
    jobId: asSyncJobId('job-pipeline-001'),
    tableConfig: TABLE_CFG,
    dispatchOptions: {
      correlationId: asCorrelationId('corr-001'),
      tenantId: asTenantId('tenant-acme'),
    },
  };
}

function makePipeline(
  config = BASE_CONFIG,
  dispatcher?: CloudDispatcher,
  validator?: ValidationEngine
) {
  return new SyncPipeline(
    config,
    new MetricsCollector(asSyncJobId('job-001'), 'FULL'),
    new Telemetry({}, 'ERROR'),
    new CheckpointManager(),
    dispatcher ?? makeDispatcher(),
    validator
  );
}

describe('SyncPipeline', () => {
  it('processes a basic batch and returns dispatched record count', async () => {
    const dispatcher = makeDispatcher();
    const pipeline = makePipeline(BASE_CONFIG, dispatcher);

    const input: ExtractInput = {
      records: [
        { id: 1, nome: 'Produto A' },
        { id: 2, nome: 'Produto B' },
      ],
      schema: 'public',
      table: 'produto',
    };

    const result = await pipeline.processBatch(input, makeContext());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(2);
    expect(dispatcher.dispatch).toHaveBeenCalledOnce();
  });

  it('returns syncOk(0) for empty record list', async () => {
    const dispatcher = makeDispatcher();
    const pipeline = makePipeline(BASE_CONFIG, dispatcher);

    const input: ExtractInput = { records: [], schema: 'public', table: 'produto' };
    const result = await pipeline.processBatch(input, makeContext());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(0);
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('casts Date values to ISO strings during transform', async () => {
    const payloads: unknown[] = [];
    const dispatcher = {
      dispatch: vi.fn().mockImplementation(async (batch: { payload: Buffer }) => {
        payloads.push(JSON.parse(batch.payload.toString()));
        return {
          ok: true,
          value: { accepted: 1, rejected: 0, batchId: 'b', latencyMs: 0, serverRef: 's' },
        };
      }),
    } as unknown as CloudDispatcher;

    const pipeline = makePipeline(BASE_CONFIG, dispatcher);
    const ts = new Date('2024-01-15T10:00:00.000Z');
    const input: ExtractInput = {
      records: [{ id: 1, created_at: ts }],
      schema: 'public',
      table: 'produto',
    };

    await pipeline.processBatch(input, makeContext());
    // payload is JSON.stringify(valid.map(r => r.data)) — flat array of data objects
    const records = payloads[0] as Array<Record<string, unknown>>;
    expect(records[0]?.['created_at']).toBe('2024-01-15T10:00:00.000Z');
  });

  it('encrypts payload when encryptionKey is provided', async () => {
    const dispatcher = makeDispatcher();
    const pipeline = makePipeline(
      {
        ...BASE_CONFIG,
        encryption: { enabled: true, algorithm: 'aes-256-gcm' as const, keyId: 'key-1' },
      },
      dispatcher
    );

    const key = Buffer.alloc(32, 0x42); // 32-byte key
    const ctx: PipelineContext = { ...makeContext(), encryptionKey: key };
    const input: ExtractInput = {
      records: [{ id: 1, nome: 'Secret' }],
      schema: 'public',
      table: 'produto',
    };

    const result = await pipeline.processBatch(input, ctx);
    expect(result.ok).toBe(true);
    const dispatchedBatch = (dispatcher.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(dispatchedBatch.encrypted).toBe(true);
    expect(typeof dispatchedBatch.iv).toBe('string');
    expect(typeof dispatchedBatch.authTag).toBe('string');
  });

  it('propagates dispatch error with retryable flag', async () => {
    const dispatcher = makeDispatcher({
      ok: false,
      error: { code: 'HTTP_500', message: 'Server Error', retryable: true },
    });
    const pipeline = makePipeline(BASE_CONFIG, dispatcher);
    const input: ExtractInput = {
      records: [{ id: 1, nome: 'Produto' }],
      schema: 'public',
      table: 'produto',
    };

    const result = await pipeline.processBatch(input, makeContext());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('HTTP_500');
    expect(result.error.retryable).toBe(true);
  });

  it('skips all records when validation rejects them all', async () => {
    const validator = new ValidationEngine();
    const schema: TableSchema = {
      schema: 'public',
      table: 'produto',
      fields: [{ name: 'id', type: 'number', required: true, nullable: false }],
    };
    validator.registerSchema(schema);

    const dispatcher = makeDispatcher();
    const pipeline = makePipeline({ ...BASE_CONFIG, validate: true }, dispatcher, validator);

    const input: ExtractInput = {
      records: [{ id: null, nome: 'Invalido' }],
      schema: 'public',
      table: 'produto',
    };

    const result = await pipeline.processBatch(input, makeContext());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(0);
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('dispatches only valid records when batch has mixed valid/invalid', async () => {
    const validator = new ValidationEngine();
    const schema: TableSchema = {
      schema: 'public',
      table: 'produto',
      fields: [{ name: 'id', type: 'number', required: true, nullable: false }],
    };
    validator.registerSchema(schema);

    const dispatcher = makeDispatcher({
      ok: true,
      value: { accepted: 1, rejected: 0, batchId: 'b-1', latencyMs: 5, serverRef: 'srv-1' },
    });
    const pipeline = makePipeline({ ...BASE_CONFIG, validate: true }, dispatcher, validator);

    const input: ExtractInput = {
      records: [
        { id: 1, nome: 'Valido' },
        { id: null, nome: 'Invalido' },
      ],
      schema: 'public',
      table: 'produto',
    };

    const result = await pipeline.processBatch(input, makeContext());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(1);
    expect(dispatcher.dispatch).toHaveBeenCalledOnce();
  });
});
