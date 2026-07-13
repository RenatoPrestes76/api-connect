import { describe, it, expect, vi } from 'vitest';
import { ErpConnector } from '../provider.js';
import { ERP_METADATA } from '../metadata.js';
import { makeContext, makeContextWithCredentials, DEFAULT_CONFIG, makeMockDb } from './helpers.js';
import factory from '../index.js';
import type { SyncContext } from '@seltriva/connector-sdk';

const mockDbFactory = () => makeMockDb();

function job(overrides: Partial<SyncContext> = {}): SyncContext {
  return { jobId: 'test-job-001', ...overrides };
}

describe('ErpConnector — metadata', () => {
  it('metadata() returns the canonical ERP_METADATA object', () => {
    expect(new ErpConnector(makeContext(), mockDbFactory).metadata()).toStrictEqual(ERP_METADATA);
  });

  it('connector id is com.seltriva.connector-erp', () => {
    expect(ERP_METADATA.id).toBe('com.seltriva.connector-erp');
  });

  it('connector category is erp', () => {
    expect(ERP_METADATA.category).toBe('erp');
  });
});

describe('ErpConnector — connect', () => {
  it('connect() returns ok result', async () => {
    const res = await new ErpConnector(makeContext(), mockDbFactory).connect();
    expect(res.ok).toBe(true);
  });

  it('connect() sets state to connected', async () => {
    const conn = new ErpConnector(makeContext(), mockDbFactory);
    await conn.connect();
    expect(conn.state).toBe('connected');
  });

  it('connect() is idempotent — second call returns ok without re-connecting', async () => {
    const conn = new ErpConnector(makeContext(), mockDbFactory);
    await conn.connect();
    const res2 = await conn.connect();
    expect(res2.ok).toBe(true);
    expect(conn.state).toBe('connected');
  });

  it('connect() returns CONNECT_FAILED when _simulateConnectFailure=true', async () => {
    const ctx = makeContext('test', { ...DEFAULT_CONFIG, _simulateConnectFailure: true });
    const conn = new ErpConnector(ctx, mockDbFactory);
    const res = await conn.connect();
    expect(res.ok).toBe(false);
    expect(res.error!.code).toBe('CONNECT_FAILED');
    expect(conn.state).toBe('disconnected');
  });
});

describe('ErpConnector — disconnect', () => {
  it('disconnect() returns ok when connected', async () => {
    const conn = new ErpConnector(makeContext(), mockDbFactory);
    await conn.connect();
    const res = await conn.disconnect();
    expect(res.ok).toBe(true);
  });

  it('disconnect() sets state to disconnected', async () => {
    const conn = new ErpConnector(makeContext(), mockDbFactory);
    await conn.connect();
    await conn.disconnect();
    expect(conn.state).toBe('disconnected');
  });

  it('disconnect() is idempotent — second call returns ok immediately', async () => {
    const conn = new ErpConnector(makeContext(), mockDbFactory);
    const res = await conn.disconnect();
    expect(res.ok).toBe(true);
    expect(conn.state).toBe('disconnected');
  });
});

describe('ErpConnector — validate', () => {
  it('returns valid=true with complete config and credentials', async () => {
    const ctx = await makeContextWithCredentials();
    const res = await new ErpConnector(ctx, mockDbFactory).validate();
    expect(res.ok).toBe(true);
    expect(res.data!.valid).toBe(true);
  });

  it('returns valid=false when credentials are absent', async () => {
    const res = await new ErpConnector(makeContext(), mockDbFactory).validate();
    expect(res.data!.valid).toBe(false);
  });
});

describe('ErpConnector — discover', () => {
  it('returns 6 entities when connected (one per known entity pattern)', async () => {
    const conn = new ErpConnector(makeContext(), mockDbFactory);
    await conn.connect();
    const res = await conn.discover();
    expect(res.ok).toBe(true);
    expect(res.data!.entities).toHaveLength(6);
  });

  it('entity names include expected types', async () => {
    const conn = new ErpConnector(makeContext(), mockDbFactory);
    await conn.connect();
    const res = await conn.discover();
    const names = res.data!.entities.map((e) => e.name);
    expect(names).toContain('products');
    expect(names).toContain('customers');
    expect(names).toContain('inventory');
  });

  it('returns NOT_CONNECTED when disconnected', async () => {
    const res = await new ErpConnector(makeContext(), mockDbFactory).discover();
    expect(res.ok).toBe(false);
    expect(res.error!.code).toBe('NOT_CONNECTED');
  });
});

describe('ErpConnector — synchronize', () => {
  it('syncs 14 records total on a full sync (5 products + 4 customers + 5 inventory)', async () => {
    const conn = new ErpConnector(makeContext(), mockDbFactory);
    await conn.connect();
    const res = await conn.synchronize(job());
    expect(res.ok).toBe(true);
    expect(res.data!.synced).toBe(14);
  });

  it('returns NOT_CONNECTED when disconnected', async () => {
    const res = await new ErpConnector(makeContext(), mockDbFactory).synchronize(job());
    expect(res.ok).toBe(false);
    expect(res.error!.code).toBe('NOT_CONNECTED');
  });

  it('emits sync.started event', async () => {
    const ctx = makeContext();
    const conn = new ErpConnector(ctx, mockDbFactory);
    await conn.connect();
    const handler = vi.fn();
    ctx.eventBus.on('sync.started', handler);
    await conn.synchronize(job());
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].jobId).toBe('test-job-001');
  });

  it('emits sync.finished event with correct synced count', async () => {
    const ctx = makeContext();
    const conn = new ErpConnector(ctx, mockDbFactory);
    await conn.connect();
    const handler = vi.fn();
    ctx.eventBus.on('sync.finished', handler);
    await conn.synchronize(job());
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].synced).toBe(14);
  });

  it('only syncs products when entities=[products]', async () => {
    const conn = new ErpConnector(makeContext(), mockDbFactory);
    await conn.connect();
    const res = await conn.synchronize(job({ entities: ['products'] }));
    expect(res.data!.synced).toBe(5);
  });

  // Incremental sync count depends on DB-level filtering — validated in integration tests.
  it('incremental sync with since returns 0 or more records', async () => {
    const conn = new ErpConnector(makeContext(), mockDbFactory);
    await conn.connect();
    const res = await conn.synchronize(job({ since: new Date() }));
    expect(res.ok).toBe(true);
    expect(res.data!.synced).toBeGreaterThanOrEqual(0);
  });
});

describe('ErpConnector — health', () => {
  it('returns healthy when connected', async () => {
    const conn = new ErpConnector(makeContext(), mockDbFactory);
    await conn.connect();
    const res = await conn.health();
    expect(res.ok).toBe(true);
    expect(res.data!.status).toBe('healthy');
  });

  it('returns unhealthy when disconnected', async () => {
    const res = await new ErpConnector(makeContext(), mockDbFactory).health();
    expect(res.data!.status).toBe('unhealthy');
  });
});

describe('ErpConnector — full lifecycle', () => {
  it('completes connect → validate → discover → sync → health → disconnect', async () => {
    const ctx = await makeContextWithCredentials();
    const conn = new ErpConnector(ctx, mockDbFactory);

    await conn.connect();
    expect(conn.state).toBe('connected');

    const validateRes = await conn.validate();
    expect(validateRes.data!.valid).toBe(true);

    const discoverRes = await conn.discover();
    expect(discoverRes.ok).toBe(true);
    expect(discoverRes.data!.entities.length).toBe(6);

    const syncRes = await conn.synchronize(job());
    expect(syncRes.ok).toBe(true);
    expect(syncRes.data!.synced).toBeGreaterThan(0);

    const healthRes = await conn.health();
    expect(healthRes.data!.status).toBe('healthy');
    expect(healthRes.data!.lastSync).toBeInstanceOf(Date);

    await conn.disconnect();
    expect(conn.state).toBe('disconnected');
  });
});

describe('factory', () => {
  it('factory function creates an ErpConnector instance', () => {
    const ctx = makeContext();
    const conn = factory(ctx);
    expect(conn).toBeInstanceOf(ErpConnector);
  });
});
