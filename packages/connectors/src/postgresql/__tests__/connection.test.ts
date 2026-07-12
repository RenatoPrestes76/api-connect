/**
 * PostgreSQLConnectionManager — unit tests (mocked pg.Pool)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostgreSQLConnectionManager } from '../connection.js';
import { ConnectionError } from '../types.js';
import type { PostgreSQLConnectorConfig } from '../types.js';

// ─── Mock pg Pool ─────────────────────────────────────────────────────────────

const mockClient = {
  query: vi.fn().mockResolvedValue({ rows: [{ pid: 1 }], rowCount: 1 }),
  release: vi.fn(),
};

const mockPool = {
  connect: vi.fn().mockResolvedValue(mockClient),
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  end: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  totalCount: 2,
  idleCount: 1,
  waitingCount: 0,
};

vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => mockPool),
}));

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_CONFIG: PostgreSQLConnectorConfig = {
  id: 'test',
  name: 'test',
  type: 'database',
  host: 'localhost',
  port: 5432,
  database: 'testdb',
  user: 'test',
  password: 'secret',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PostgreSQLConnectionManager', () => {
  let manager: PostgreSQLConnectionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.query.mockResolvedValue({ rows: [{ pid: 1 }], rowCount: 1 });
    manager = new PostgreSQLConnectionManager();
  });

  describe('connect()', () => {
    it('connects and becomes connected', async () => {
      await manager.connect(BASE_CONFIG);
      expect(manager.isConnected).toBe(true);
    });

    it('is idempotent — second connect() is a no-op', async () => {
      await manager.connect(BASE_CONFIG);
      await manager.connect(BASE_CONFIG);
      // Pool should only be created once
      const { Pool } = await import('pg');
      expect(Pool).toHaveBeenCalledTimes(1);
    });

    it('sets connectedAt on successful connect', async () => {
      expect(manager.connectedAt).toBeNull();
      await manager.connect(BASE_CONFIG);
      expect(manager.connectedAt).toBeInstanceOf(Date);
    });

    it('throws ConnectionError when pool.connect() fails', async () => {
      mockPool.connect.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(manager.connect(BASE_CONFIG)).rejects.toThrow(ConnectionError);
      expect(manager.isConnected).toBe(false);
    });

    it('sets READ ONLY on acquired connection', async () => {
      await manager.connect(BASE_CONFIG);

      const readOnlyCalls = mockClient.query.mock.calls.filter((args) =>
        String(args[0]).includes('READ ONLY')
      );
      expect(readOnlyCalls.length).toBeGreaterThan(0);
    });
  });

  describe('disconnect()', () => {
    it('disconnects and becomes disconnected', async () => {
      await manager.connect(BASE_CONFIG);
      await manager.disconnect();
      expect(manager.isConnected).toBe(false);
    });

    it('is idempotent — disconnect when already disconnected is a no-op', async () => {
      await manager.disconnect();
      expect(mockPool.end).not.toHaveBeenCalled();
    });

    it('clears connectedAt', async () => {
      await manager.connect(BASE_CONFIG);
      await manager.disconnect();
      expect(manager.connectedAt).toBeNull();
    });
  });

  describe('ping()', () => {
    it('returns latencyMs and serverVersion', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ version: 'PostgreSQL 15.3 on ...' }],
        rowCount: 1,
      });

      await manager.connect(BASE_CONFIG);
      const result = await manager.ping();

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.serverVersion).toBe('PostgreSQL 15.3 on ...');
    });
  });

  describe('poolStats()', () => {
    it('returns pool counts when connected', async () => {
      await manager.connect(BASE_CONFIG);
      const stats = manager.poolStats();

      expect(stats).toEqual({ total: 2, idle: 1, waiting: 0 });
    });

    it('returns zeros when not connected', () => {
      const stats = manager.poolStats();
      expect(stats).toEqual({ total: 0, idle: 0, waiting: 0 });
    });
  });

  describe('onError()', () => {
    it('registers and fires error handler', async () => {
      await manager.connect(BASE_CONFIG);

      const handler = vi.fn();
      manager.onError(handler);

      // Simulate pool error event
      const errorEventHandler = mockPool.on.mock.calls.find((call) => call[0] === 'error')?.[1] as
        | ((err: Error) => void)
        | undefined;

      errorEventHandler?.(new Error('idle client error'));

      expect(handler).toHaveBeenCalledWith(expect.any(Error));
    });

    it('returns unsubscribe function', async () => {
      await manager.connect(BASE_CONFIG);

      const handler = vi.fn();
      const unsubscribe = manager.onError(handler);
      unsubscribe();

      const errorEventHandler = mockPool.on.mock.calls.find((call) => call[0] === 'error')?.[1] as
        | ((err: Error) => void)
        | undefined;

      errorEventHandler?.(new Error('idle client error'));
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('SSL config', () => {
    it('passes ssl:false when ssl is false', async () => {
      const { Pool } = await import('pg');
      await manager.connect({ ...BASE_CONFIG, ssl: false });

      const poolConfig = (Pool as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(poolConfig.ssl).toBe(false);
    });

    it('passes rejectUnauthorized:true when ssl is true', async () => {
      const { Pool } = await import('pg');
      await manager.connect({ ...BASE_CONFIG, ssl: true });

      const poolConfig = (Pool as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(poolConfig.ssl).toEqual({ rejectUnauthorized: true });
    });

    it('passes SSLConfig object through', async () => {
      const { Pool } = await import('pg');
      await manager.connect({
        ...BASE_CONFIG,
        ssl: { rejectUnauthorized: false, ca: 'cert-pem' },
      });

      const poolConfig = (Pool as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(poolConfig.ssl).toEqual({
        rejectUnauthorized: false,
        ca: 'cert-pem',
        cert: undefined,
        key: undefined,
      });
    });
  });
});
