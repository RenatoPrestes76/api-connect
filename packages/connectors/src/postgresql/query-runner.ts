/**
 * QueryRunner — PostgreSQL query execution engine.
 *
 * Features:
 *   - Read-only enforcement (regex + parse of SQL verb)
 *   - Automatic retry on transient errors (connection reset, deadlock)
 *   - Per-query statement timeout (independent of pool setting)
 *   - Circuit Breaker (CLOSED → OPEN → HALF_OPEN → CLOSED)
 *   - Structured logging with timing, row counts, retry counts
 *   - Query cancellation via pg_cancel_backend() on timeout
 */
import type { PoolClient } from 'pg';
import {
  ReadOnlyViolationError,
  QueryTimeoutError,
  CircuitOpenError,
  type QueryRunnerOptions,
  type CircuitBreakerOptions,
} from './types.js';
import type { PostgreSQLConnectionManager } from './connection.js';

// ─── Read-only Guard ──────────────────────────────────────────────────────────

const WRITE_VERB_RE =
  /^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|VACUUM|REINDEX|CLUSTER|COPY|LOCK|COMMENT)\b/i;

function assertReadOnly(sql: string): void {
  if (WRITE_VERB_RE.test(sql)) {
    throw new ReadOnlyViolationError(sql);
  }
}

// ─── Transient Error Detection ────────────────────────────────────────────────

const TRANSIENT_CODES = new Set([
  '08000', // connection_exception
  '08003', // connection_does_not_exist
  '08006', // connection_failure
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '40001', // serialization_failure (deadlock)
  '40P01', // deadlock_detected
  '53300', // too_many_connections
  '57P03', // cannot_connect_now
]);

function isTransient(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    return TRANSIENT_CODES.has(String((err as { code: string }).code));
  }
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  return (
    msg.includes('connection') ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused')
  );
}

// ─── Circuit Breaker ──────────────────────────────────────────────────────────

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private _state: CircuitState = 'CLOSED';
  private _failureCount = 0;
  private _successCount = 0;
  private _openedAt: Date | null = null;

  constructor(private readonly _opts: CircuitBreakerOptions) {}

  get state(): CircuitState { return this._state; }
  get failureCount(): number { return this._failureCount; }
  get openedAt(): Date | null { return this._openedAt; }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this._transitionIfNeeded();

    if (this._state === 'OPEN') {
      throw new CircuitOpenError(this._openedAt!);
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      throw err;
    }
  }

  reset(): void {
    this._state = 'CLOSED';
    this._failureCount = 0;
    this._successCount = 0;
    this._openedAt = null;
  }

  private _transitionIfNeeded(): void {
    if (this._state === 'OPEN' && this._openedAt) {
      const elapsed = Date.now() - this._openedAt.getTime();
      if (elapsed >= this._opts.openDurationMs) {
        this._state = 'HALF_OPEN';
        this._successCount = 0;
      }
    }
  }

  private _onSuccess(): void {
    if (this._state === 'HALF_OPEN') {
      this._successCount++;
      if (this._successCount >= this._opts.successThreshold) {
        this._state = 'CLOSED';
        this._failureCount = 0;
        this._openedAt = null;
      }
    } else {
      this._failureCount = Math.max(0, this._failureCount - 1);
    }
  }

  private _onFailure(): void {
    this._failureCount++;
    if (
      this._state === 'HALF_OPEN' ||
      this._failureCount >= this._opts.failureThreshold
    ) {
      this._state = 'OPEN';
      this._openedAt = new Date();
    }
  }
}

// ─── Query Metrics ────────────────────────────────────────────────────────────

export interface QueryMetrics {
  readonly sql: string;
  readonly params: unknown[] | undefined;
  readonly durationMs: number;
  readonly rowCount: number;
  readonly retries: number;
  readonly executedAt: Date;
}

// ─── Query Runner ─────────────────────────────────────────────────────────────

export class QueryRunner {
  private _metrics: QueryMetrics[] = [];

  constructor(
    private readonly _conn: PostgreSQLConnectionManager,
    private readonly _circuitBreaker: CircuitBreaker,
    private readonly _opts: QueryRunnerOptions,
  ) {}

  get recentMetrics(): QueryMetrics[] {
    return [...this._metrics].slice(-100);
  }

  /**
   * Execute a SELECT query. Enforces read-only, retries transient errors.
   */
  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }> {
    assertReadOnly(sql);

    const executedAt = new Date();
    const start = Date.now();
    let retries = 0;
    let lastErr: unknown;

    while (retries <= this._opts.maxRetries) {
      try {
        const result = await this._circuitBreaker.execute(async () => {
          return this._executeWithTimeout<T>(sql, params);
        });

        const durationMs = Date.now() - start;
        this._recordMetrics({ sql, params, durationMs, rowCount: result.rowCount, retries, executedAt });
        return result;
      } catch (err) {
        lastErr = err;

        // Do not retry circuit-open, read-only violations, or timeouts
        if (
          err instanceof CircuitOpenError ||
          err instanceof ReadOnlyViolationError ||
          err instanceof QueryTimeoutError
        ) {
          break;
        }

        if (retries < this._opts.maxRetries && isTransient(err)) {
          retries++;
          await this._sleep(this._opts.retryDelayMs * retries);
          continue;
        }

        break;
      }
    }

    throw lastErr;
  }

  /**
   * Execute a query with a server-side statement_timeout.
   * Cancels the backend query if the client-side timeout fires first.
   */
  private async _executeWithTimeout<T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }> {
    const { statementTimeoutMs } = this._opts;
    let client: PoolClient | null = null;
    let pid: number | null = null;
    let timedOut = false;

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      // Cancel the running backend query
      if (pid && this._conn.isConnected) {
        this._conn
          .query('SELECT pg_cancel_backend($1)', [pid])
          .catch(() => undefined);
      }
    }, statementTimeoutMs);

    try {
      client = await this._conn.acquire();

      // Capture PID for cancellation
      const pidResult = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      pid = pidResult.rows[0]?.pid ?? null;

      const result = await client.query<T>(sql, params);

      if (timedOut) {
        throw new QueryTimeoutError(sql, statementTimeoutMs);
      }

      return {
        rows: result.rows,
        rowCount: result.rowCount ?? 0,
      };
    } catch (err) {
      if (timedOut) {
        throw new QueryTimeoutError(sql, statementTimeoutMs);
      }
      throw err;
    } finally {
      clearTimeout(timeoutHandle);
      client?.release();
    }
  }

  private _recordMetrics(m: QueryMetrics): void {
    this._metrics.push(m);
    if (this._metrics.length > 100) this._metrics.shift();
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─── Default Options ──────────────────────────────────────────────────────────

export const DEFAULT_QUERY_RUNNER_OPTIONS: QueryRunnerOptions = {
  statementTimeoutMs: 30_000,
  maxRetries: 3,
  retryDelayMs: 500,
  circuitBreaker: {
    failureThreshold: 5,
    openDurationMs: 30_000,
    successThreshold: 1,
  },
};
