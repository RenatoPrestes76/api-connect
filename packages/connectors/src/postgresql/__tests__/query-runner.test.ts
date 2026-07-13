/**
 * QueryRunner + CircuitBreaker — unit tests (no real DB needed)
 *
 * Tests: read-only enforcement, circuit breaker state machine,
 * retry logic, timeout propagation, metrics recording.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryRunner, CircuitBreaker, DEFAULT_QUERY_RUNNER_OPTIONS } from '../query-runner.js';
import { ReadOnlyViolationError, QueryTimeoutError, CircuitOpenError } from '../types.js';
import type { PostgreSQLConnectionManager } from '../connection.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeConn(
  queryImpl?: (sql: string) => Promise<{ rows: unknown[]; rowCount: number }>
): PostgreSQLConnectionManager {
  const clientMock = {
    query: vi
      .fn()
      .mockImplementation((sql: string) =>
        queryImpl ? queryImpl(sql) : Promise.resolve({ rows: [], rowCount: 0 })
      ),
    release: vi.fn(),
  };

  return {
    isConnected: true,
    acquire: vi.fn().mockResolvedValue(clientMock),
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  } as unknown as PostgreSQLConnectionManager;
}

// ─── Read-only Enforcement ────────────────────────────────────────────────────

describe('ReadOnly enforcement', () => {
  const dml = [
    'INSERT INTO t VALUES (1)',
    'UPDATE t SET x = 1',
    'DELETE FROM t',
    'DROP TABLE t',
    'ALTER TABLE t ADD COLUMN x INT',
    'TRUNCATE TABLE t',
    'CREATE TABLE t (id INT)',
    'GRANT SELECT ON t TO user',
    'REVOKE SELECT ON t FROM user',
    'VACUUM t',
    'REINDEX TABLE t',
    '  insert into t values (1)', // leading whitespace
    '\nDELETE FROM t',
  ];

  it.each(dml)('blocks: %s', async (sql) => {
    const cb = new CircuitBreaker(DEFAULT_QUERY_RUNNER_OPTIONS.circuitBreaker);
    const runner = new QueryRunner(makeConn(), cb, DEFAULT_QUERY_RUNNER_OPTIONS);
    await expect(runner.query(sql)).rejects.toThrow(ReadOnlyViolationError);
  });

  const safe = [
    'SELECT * FROM t',
    'SELECT 1',
    '  SELECT id FROM users',
    'WITH cte AS (SELECT 1) SELECT * FROM cte',
    'EXPLAIN SELECT * FROM t',
    'SHOW server_version',
  ];

  it.each(safe)('allows: %s', async (sql) => {
    const cb = new CircuitBreaker(DEFAULT_QUERY_RUNNER_OPTIONS.circuitBreaker);
    const runner = new QueryRunner(makeConn(), cb, DEFAULT_QUERY_RUNNER_OPTIONS);
    await expect(runner.query(sql)).resolves.toBeDefined();
  });
});

// ─── Circuit Breaker ──────────────────────────────────────────────────────────

describe('CircuitBreaker', () => {
  it('starts CLOSED', () => {
    const cb = new CircuitBreaker({
      failureThreshold: 3,
      openDurationMs: 1000,
      successThreshold: 1,
    });
    expect(cb.state).toBe('CLOSED');
  });

  it('stays CLOSED below failure threshold', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 3,
      openDurationMs: 1000,
      successThreshold: 1,
    });
    const fail = () => Promise.reject(new Error('fail'));

    await cb.execute(fail).catch(() => undefined);
    await cb.execute(fail).catch(() => undefined);
    expect(cb.state).toBe('CLOSED');
  });

  it('opens after reaching failure threshold', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 3,
      openDurationMs: 1000,
      successThreshold: 1,
    });
    const fail = () => Promise.reject(new Error('fail'));

    for (let i = 0; i < 3; i++) {
      await cb.execute(fail).catch(() => undefined);
    }
    expect(cb.state).toBe('OPEN');
  });

  it('throws CircuitOpenError when OPEN', async () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      openDurationMs: 60_000,
      successThreshold: 1,
    });
    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => undefined);

    expect(cb.state).toBe('OPEN');
    await expect(cb.execute(() => Promise.resolve('ok'))).rejects.toThrow(CircuitOpenError);
  });

  it('transitions OPEN → HALF_OPEN after openDurationMs', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, openDurationMs: 10, successThreshold: 1 });
    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => undefined);
    expect(cb.state).toBe('OPEN');

    await new Promise((r) => setTimeout(r, 20));
    // Trigger transition check by attempting an execute
    await cb.execute(() => Promise.resolve('ok'));
    expect(cb.state).toBe('CLOSED');
  });

  it('goes HALF_OPEN → OPEN on failure', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, openDurationMs: 10, successThreshold: 2 });
    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => undefined);

    await new Promise((r) => setTimeout(r, 20));

    // One failure in HALF_OPEN → back to OPEN
    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => undefined);
    expect(cb.state).toBe('OPEN');
  });

  it('resets to CLOSED on manual reset()', () => {
    const cb = new CircuitBreaker({
      failureThreshold: 1,
      openDurationMs: 1000,
      successThreshold: 1,
    });
    cb.reset();
    expect(cb.state).toBe('CLOSED');
    expect(cb.failureCount).toBe(0);
  });
});

// ─── Query Runner ─────────────────────────────────────────────────────────────

describe('QueryRunner', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker(DEFAULT_QUERY_RUNNER_OPTIONS.circuitBreaker);
  });

  it('returns rows on successful query', async () => {
    const expectedRows = [{ id: 1, name: 'test' }];
    const conn = makeConn(async (sql) => {
      if (sql.includes('pg_backend_pid')) return { rows: [{ pid: 1234 }], rowCount: 1 };
      return { rows: expectedRows, rowCount: 1 };
    });

    const runner = new QueryRunner(conn, cb, DEFAULT_QUERY_RUNNER_OPTIONS);
    const result = await runner.query('SELECT id, name FROM t');
    expect(result.rows).toEqual(expectedRows);
    expect(result.rowCount).toBe(1);
  });

  it('records metrics after execution', async () => {
    const conn = makeConn(async (sql) => {
      if (sql.includes('pg_backend_pid')) return { rows: [{ pid: 99 }], rowCount: 1 };
      return { rows: [{ x: 1 }], rowCount: 1 };
    });

    const runner = new QueryRunner(conn, cb, DEFAULT_QUERY_RUNNER_OPTIONS);
    await runner.query('SELECT 1 AS x');

    const metrics = runner.recentMetrics;
    expect(metrics).toHaveLength(1);
    expect(metrics[0]!.rowCount).toBe(1);
    expect(metrics[0]!.durationMs).toBeGreaterThanOrEqual(0);
    expect(metrics[0]!.retries).toBe(0);
  });

  it('does not retry ReadOnlyViolationError', async () => {
    const conn = makeConn();
    const runner = new QueryRunner(conn, cb, {
      ...DEFAULT_QUERY_RUNNER_OPTIONS,
      maxRetries: 3,
    });

    let callCount = 0;
    const origAcquire = (conn as { acquire: () => unknown }).acquire;
    (conn as { acquire: () => unknown }).acquire = vi.fn().mockImplementation(() => {
      callCount++;
      return origAcquire();
    });

    await runner.query('DELETE FROM t').catch(() => undefined);
    // Should have thrown before even acquiring a client
    expect(callCount).toBe(0);
  });
});
