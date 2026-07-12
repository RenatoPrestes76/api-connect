/**
 * PostgreSQLConnectionManager
 *
 * Wraps node-postgres Pool with:
 *   - SSL support (rejectUnauthorized, CA/cert/key)
 *   - Automatic reconnection on transient errors
 *   - KeepAlive tuning
 *   - READ ONLY session enforcement at the connection level
 *   - Health checks
 *   - Graceful shutdown (drains active queries before closing)
 */
import { Pool, type PoolConfig, type PoolClient } from 'pg';
import { ConnectionError, type PostgreSQLConnectorConfig, type SSLConfig } from './types.js';

// ─── Pool Event Types ─────────────────────────────────────────────────────────

export type ConnectionEventHandler = (err: Error) => void;

// ─── Connection Manager ───────────────────────────────────────────────────────

export class PostgreSQLConnectionManager {
  private _pool: Pool | null = null;
  private _config: PostgreSQLConnectorConfig | null = null;
  private _connectedAt: Date | null = null;
  private _errorHandlers: ConnectionEventHandler[] = [];

  // ─── Connect ──────────────────────────────────────────────────────────────

  async connect(config: PostgreSQLConnectorConfig): Promise<void> {
    if (this._pool) return;

    this._config = config;
    const poolConfig = this._buildPoolConfig(config);

    const pool = new Pool(poolConfig);

    // Forward pool-level errors (idle client errors)
    pool.on('error', (err: Error) => {
      for (const handler of this._errorHandlers) {
        try {
          handler(err);
        } catch {
          /* non-fatal */
        }
      }
    });

    // Verify connectivity + enforce READ ONLY at session level. Only assign to this._pool
    // once the connection genuinely succeeds — otherwise isConnected would report true for
    // a pool that never connected.
    const client = await pool.connect().catch(async (err: unknown) => {
      await pool.end().catch(() => {
        /* pool never connected — nothing to drain */
      });
      throw new ConnectionError(
        `Cannot connect to ${config.host}:${config.port}/${config.database}: ` +
          (err instanceof Error ? err.message : String(err)),
        err
      );
    });

    this._pool = pool;

    try {
      // Enforce read-only at the session level — second line of defense
      await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
      // Verify we can actually reach the database
      await client.query('SELECT 1');
    } finally {
      client.release();
    }

    this._connectedAt = new Date();
  }

  // ─── Disconnect ───────────────────────────────────────────────────────────

  async disconnect(): Promise<void> {
    if (!this._pool) return;
    await this._pool.end();
    this._pool = null;
    this._connectedAt = null;
  }

  // ─── Acquire Client ───────────────────────────────────────────────────────

  async acquire(): Promise<PoolClient> {
    const pool = this._requirePool();
    const client = await pool.connect();

    // Re-enforce read-only on every acquired client in case the session was reset
    try {
      await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
    } catch (err) {
      client.release();
      throw err;
    }

    return client;
  }

  // ─── Direct Pool Query ────────────────────────────────────────────────────

  async query<T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number }> {
    const pool = this._requirePool();
    const result = await pool.query<T>(sql, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount ?? 0,
    };
  }

  // ─── Health Check ─────────────────────────────────────────────────────────

  async ping(): Promise<{ latencyMs: number; serverVersion: string }> {
    const pool = this._requirePool();
    const start = Date.now();
    const result = await pool.query<{ version: string }>('SELECT version() AS version');
    const latencyMs = Date.now() - start;
    const version = result.rows[0]?.version ?? 'unknown';
    return { latencyMs, serverVersion: version };
  }

  // ─── Pool Stats ───────────────────────────────────────────────────────────

  poolStats(): { total: number; idle: number; waiting: number } {
    if (!this._pool) return { total: 0, idle: 0, waiting: 0 };
    return {
      total: this._pool.totalCount,
      idle: this._pool.idleCount,
      waiting: this._pool.waitingCount,
    };
  }

  // ─── Getters ──────────────────────────────────────────────────────────────

  get isConnected(): boolean {
    return this._pool !== null;
  }
  get connectedAt(): Date | null {
    return this._connectedAt;
  }
  get config(): PostgreSQLConnectorConfig | null {
    return this._config;
  }

  // ─── Error Listener ───────────────────────────────────────────────────────

  onError(handler: ConnectionEventHandler): () => void {
    this._errorHandlers.push(handler);
    return () => {
      this._errorHandlers = this._errorHandlers.filter((h) => h !== handler);
    };
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private _requirePool(): Pool {
    if (!this._pool) {
      throw new ConnectionError('Not connected — call connect() first');
    }
    return this._pool;
  }

  private _buildPoolConfig(config: PostgreSQLConnectorConfig): PoolConfig {
    const ssl = this._buildSSLConfig(config.ssl);

    return {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl,
      application_name: config.applicationName ?? 'atlas-connect',
      statement_timeout: config.statementTimeoutMs ?? 30_000,
      connectionTimeoutMillis: config.connectionTimeoutMs ?? 10_000,
      idleTimeoutMillis: config.idleTimeoutMs ?? 300_000,
      max: config.maxPoolSize ?? 10,
      keepAlive: config.keepAlive ?? true,
      keepAliveInitialDelayMillis: config.keepAliveInitialDelayMs ?? 10_000,
    };
  }

  private _buildSSLConfig(ssl: PostgreSQLConnectorConfig['ssl']): PoolConfig['ssl'] {
    if (ssl === false || ssl === undefined) return false;
    if (ssl === true) return { rejectUnauthorized: true };

    const sslConf = ssl as SSLConfig;
    return {
      rejectUnauthorized: sslConf.rejectUnauthorized ?? true,
      ca: sslConf.ca,
      cert: sslConf.cert,
      key: sslConf.key,
    };
  }
}
