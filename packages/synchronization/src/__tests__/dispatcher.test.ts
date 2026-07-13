import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CloudDispatcher } from '../dispatcher/cloud-dispatcher.js';
import type { DispatchOptions } from '../dispatcher/cloud-dispatcher.js';
import { asCorrelationId, asTenantId, asBatchId } from '../types/index.js';
import type { CompressedBatch } from '../types/index.js';

const TARGET = { url: 'https://atlas.seltriva.dev', apiKey: 'sk-test-123', timeout: 5_000 };

const OPTS: DispatchOptions = {
  correlationId: asCorrelationId('corr-001'),
  tenantId: asTenantId('tenant-acme'),
};

const BATCH: CompressedBatch = {
  batchId: asBatchId('batch-001'),
  schema: 'public',
  table: 'produto',
  records: 10,
  payload: Buffer.from('{"data":"test"}'),
  compressed: false,
  algorithm: 'none',
  originalSize: 100,
  compressedSize: 100,
};

describe('CloudDispatcher', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('dispatches batch and returns DispatchResult on success', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ serverRef: 'srv-abc', accepted: 10, rejected: 0 }),
    });
    const dispatcher = new CloudDispatcher(TARGET);
    const result = await dispatcher.dispatch(BATCH, OPTS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accepted).toBe(10);
    expect(result.value.rejected).toBe(0);
    expect(result.value.serverRef).toBe('srv-abc');
    expect(result.value.batchId).toBe(BATCH.batchId);
    expect(result.value.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('defaults missing serverRef to a generated UUID', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ accepted: 5 }),
    });
    const dispatcher = new CloudDispatcher(TARGET);
    const result = await dispatcher.dispatch(BATCH, OPTS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(typeof result.value.serverRef).toBe('string');
    expect(result.value.serverRef.length).toBeGreaterThan(0);
  });

  it('defaults accepted/rejected from batch.records when missing in response', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    const dispatcher = new CloudDispatcher(TARGET);
    const result = await dispatcher.dispatch(BATCH, OPTS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.accepted).toBe(BATCH.records);
    expect(result.value.rejected).toBe(0);
  });

  it('returns retryable error on HTTP 500', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });
    const dispatcher = new CloudDispatcher(TARGET);
    const result = await dispatcher.dispatch(BATCH, OPTS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('HTTP_500');
    expect(result.error.retryable).toBe(true);
  });

  it('returns retryable error on HTTP 429', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Too Many Requests',
    });
    const dispatcher = new CloudDispatcher(TARGET);
    const result = await dispatcher.dispatch(BATCH, OPTS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.retryable).toBe(true);
  });

  it('returns non-retryable error on HTTP 400', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Bad Request: invalid schema',
    });
    const dispatcher = new CloudDispatcher(TARGET);
    const result = await dispatcher.dispatch(BATCH, OPTS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('HTTP_400');
    expect(result.error.retryable).toBe(false);
  });

  it('returns NETWORK_ERROR on connection failure (ECONNRESET)', async () => {
    fetchMock.mockRejectedValue(new Error('fetch failed: ECONNRESET'));
    const dispatcher = new CloudDispatcher(TARGET);
    const result = await dispatcher.dispatch(BATCH, OPTS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NETWORK_ERROR');
    expect(result.error.retryable).toBe(true);
  });

  it('returns non-retryable NETWORK_ERROR for unexpected errors', async () => {
    fetchMock.mockRejectedValue(new Error('some unexpected failure'));
    const dispatcher = new CloudDispatcher(TARGET);
    const result = await dispatcher.dispatch(BATCH, OPTS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NETWORK_ERROR');
    expect(result.error.retryable).toBe(false);
  });

  it('sets Content-Encoding header for gzip-compressed batch', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ accepted: 5, rejected: 0 }),
    });
    const compressed: CompressedBatch = { ...BATCH, compressed: true, algorithm: 'gzip' };
    const dispatcher = new CloudDispatcher(TARGET);
    await dispatcher.dispatch(compressed, OPTS);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Encoding']).toBe('gzip');
  });

  it('does not set Content-Encoding for uncompressed batch', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ accepted: 10 }),
    });
    const dispatcher = new CloudDispatcher(TARGET);
    await dispatcher.dispatch(BATCH, OPTS);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Encoding']).toBeUndefined();
  });

  it('sets Authorization and X-Tenant-Id headers', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ accepted: 10 }),
    });
    const dispatcher = new CloudDispatcher(TARGET);
    await dispatcher.dispatch(BATCH, OPTS);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe(`Bearer ${TARGET.apiKey}`);
    expect(headers['X-Tenant-Id']).toBe(OPTS.tenantId);
    expect(headers['X-Correlation-Id']).toBe(OPTS.correlationId);
  });
});
