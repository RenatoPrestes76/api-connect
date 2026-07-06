import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectionPool } from '../connection/pool.js';
import { ConnectionFailedError } from '../errors/database-errors.js';
import type { DatabaseAdapter, DatabaseHealth } from '../adapters/database-adapter.js';
import type { Query } from '../query/query-types.js';
import type { DatabaseSchema } from '../schema/schema-reader.js';

function makeMockAdapter(): DatabaseAdapter {
  let connected = false;
  return {
    connect:    async () => { connected = true; },
    disconnect: async () => { connected = false; },
    reconnect:  async () => { connected = false; connected = true; },
    execute:    async (_q: Query) => [],
    transaction: <T>(cb: () => Promise<T>): Promise<T> => cb(),
    health: async (): Promise<DatabaseHealth> => ({
      connected, latency: 0, databaseVersion: 'test',
      activeConnections: 1, poolUsage: 0, status: connected ? 'healthy' : 'unhealthy',
    }),
    schema: async (): Promise<DatabaseSchema> => ({
      name: 'test', tables: [], relations: [], discoveredAt: new Date(),
    }),
  };
}

describe('ConnectionPool', () => {
  let pool: ConnectionPool;

  beforeEach(async () => {
    pool = new ConnectionPool(makeMockAdapter, 3);
    await pool.initialize();
  });

  it('initializes with correct pool size', () => {
    expect(pool.size).toBe(3);
    expect(pool.available).toBe(3);
    expect(pool.inUse).toBe(0);
  });

  it('acquire reduces available count', async () => {
    await pool.acquire();
    expect(pool.available).toBe(2);
    expect(pool.inUse).toBe(1);
  });

  it('release restores available count', async () => {
    const conn = await pool.acquire();
    pool.release(conn);
    expect(pool.available).toBe(3);
    expect(pool.inUse).toBe(0);
  });

  it('acquire throws when pool is exhausted', async () => {
    await pool.acquire();
    await pool.acquire();
    await pool.acquire();
    await expect(pool.acquire()).rejects.toThrow(ConnectionFailedError);
  });

  it('release throws for external connection', async () => {
    const external = makeMockAdapter();
    await external.connect();
    expect(() => pool.release(external)).toThrow(ConnectionFailedError);
  });

  it('drainAll empties pool', async () => {
    await pool.drainAll();
    expect(pool.size).toBe(0);
    expect(pool.available).toBe(0);
  });

  it('double-release is idempotent', async () => {
    const conn = await pool.acquire();
    pool.release(conn);
    pool.release(conn);
    expect(pool.available).toBe(3);
  });

  it('poolUsage is 0 when nothing is in use', () => {
    expect(pool.poolUsage).toBe(0);
  });

  it('poolUsage reflects in-use ratio', async () => {
    await pool.acquire();
    expect(pool.poolUsage).toBeCloseTo(1 / 3);
  });
});
