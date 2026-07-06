import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionManager } from '../connection/connection-manager.js';
import { ConnectionFailedError, TimeoutError } from '../errors/database-errors.js';
import type { DatabaseAdapter, DatabaseHealth } from '../adapters/database-adapter.js';
import type { Query } from '../query/query-types.js';
import type { DatabaseSchema } from '../schema/schema-reader.js';
import type { RetryPolicy } from '../connection/retry-policy.js';

function makeMockAdapter(opts?: { failTimes?: number; connectDelay?: number }): DatabaseAdapter {
  let callCount = 0;
  return {
    connect: vi.fn(async () => {
      callCount++;
      if (opts?.connectDelay) {
        await new Promise((r) => setTimeout(r, opts.connectDelay));
      }
      if (opts?.failTimes !== undefined && callCount <= opts.failTimes) {
        throw new ConnectionFailedError(`Simulated failure #${callCount}`);
      }
    }),
    disconnect: vi.fn(async () => {}),
    reconnect:  vi.fn(async () => {}),
    execute:    vi.fn(async () => []),
    transaction: vi.fn(async <T>(cb: () => Promise<T>): Promise<T> => cb()) as unknown as DatabaseAdapter['transaction'],
    health: vi.fn(async (): Promise<DatabaseHealth> => ({
      connected: true, latency: 1, databaseVersion: 'mock 1.0',
      activeConnections: 1, poolUsage: 0, status: 'healthy',
    })),
    schema: vi.fn(async (): Promise<DatabaseSchema> => ({
      name: 'mock', tables: [], relations: [], discoveredAt: new Date(),
    })),
  };
}

describe('ConnectionManager — connect (legacy options)', () => {
  it('connects on first attempt', async () => {
    const adapter = makeMockAdapter();
    const manager = new ConnectionManager(adapter, { retryDelayMs: 0 });
    await manager.connect();
    expect(manager.isConnected).toBe(true);
    expect(manager.retryCount).toBe(0);
  });

  it('retries on failure and succeeds', async () => {
    const adapter = makeMockAdapter({ failTimes: 1 });
    const manager = new ConnectionManager(adapter, { maxRetries: 3, retryDelayMs: 0 });
    await manager.connect();
    expect(manager.isConnected).toBe(true);
    expect(manager.retryCount).toBe(1);
  });

  it('throws ConnectionFailedError after exhausting retries', async () => {
    const adapter = makeMockAdapter({ failTimes: 999 });
    const manager = new ConnectionManager(adapter, { maxRetries: 2, retryDelayMs: 0 });
    await expect(manager.connect()).rejects.toThrow(ConnectionFailedError);
    expect(manager.isConnected).toBe(false);
  });

  it('throws TimeoutError when connection exceeds timeout', async () => {
    const adapter = makeMockAdapter({ connectDelay: 500 });
    const manager = new ConnectionManager(adapter, { maxRetries: 0, timeoutMs: 50, retryDelayMs: 0 });
    await expect(manager.connect()).rejects.toThrow(TimeoutError);
  });
});

describe('ConnectionManager — connect (RetryPolicy)', () => {
  it('connects using fixed retry policy', async () => {
    const adapter = makeMockAdapter();
    const policy: RetryPolicy = { attempts: 3, backoff: 'fixed', initialDelay: 0 };
    const manager = new ConnectionManager(adapter, { retryPolicy: policy });
    await manager.connect();
    expect(manager.isConnected).toBe(true);
  });

  it('retries with exponential backoff policy and succeeds', async () => {
    const adapter = makeMockAdapter({ failTimes: 1 });
    const policy: RetryPolicy = { attempts: 3, backoff: 'exponential', initialDelay: 0, factor: 2 };
    const manager = new ConnectionManager(adapter, { retryPolicy: policy });
    await manager.connect();
    expect(manager.isConnected).toBe(true);
    expect(manager.retryCount).toBe(1);
  });

  it('retries with linear backoff policy', async () => {
    const adapter = makeMockAdapter({ failTimes: 1 });
    const policy: RetryPolicy = { attempts: 4, backoff: 'linear', initialDelay: 0 };
    const manager = new ConnectionManager(adapter, { retryPolicy: policy });
    await manager.connect();
    expect(manager.isConnected).toBe(true);
  });

  it('exhausts all attempts with RetryPolicy', async () => {
    const adapter = makeMockAdapter({ failTimes: 999 });
    const policy: RetryPolicy = { attempts: 2, backoff: 'fixed', initialDelay: 0 };
    const manager = new ConnectionManager(adapter, { retryPolicy: policy });
    await expect(manager.connect()).rejects.toThrow(ConnectionFailedError);
  });
});

describe('ConnectionManager — disconnect', () => {
  it('disconnects successfully', async () => {
    const adapter = makeMockAdapter();
    const manager = new ConnectionManager(adapter);
    await manager.connect();
    await manager.disconnect();
    expect(manager.isConnected).toBe(false);
  });

  it('noop disconnect when already disconnected', async () => {
    const adapter = makeMockAdapter();
    const manager = new ConnectionManager(adapter);
    await manager.disconnect();
    expect(adapter.disconnect).not.toHaveBeenCalled();
  });
});

describe('ConnectionManager — reconnect', () => {
  it('reconnect disconnects then connects', async () => {
    const adapter = makeMockAdapter();
    const manager = new ConnectionManager(adapter, { retryDelayMs: 0 });
    await manager.connect();
    await manager.reconnect();
    expect(manager.isConnected).toBe(true);
    expect(adapter.disconnect).toHaveBeenCalledOnce();
    expect(adapter.connect).toHaveBeenCalledTimes(2);
  });
});

describe('ConnectionManager — defaults', () => {
  it('uses defaults when no options provided', async () => {
    const adapter = makeMockAdapter();
    const manager = new ConnectionManager(adapter);
    await manager.connect();
    expect(manager.isConnected).toBe(true);
  });
});
