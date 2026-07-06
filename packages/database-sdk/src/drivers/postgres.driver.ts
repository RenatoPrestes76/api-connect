import pg from 'pg';
import { SqlAdapter } from '../adapters/sql-adapter.js';
import type { DriverConfig } from '../connection/connection-options.js';
import type { DatabaseHealth } from '../health/database-health.js';
import type { DatabaseSchema, SchemaReader } from '../schema/schema-reader.js';
import type { Table } from '../schema/table.js';
import type { Query } from '../query/query-types.js';
import { ConnectionFailedError, QueryError } from '../errors/database-errors.js';
import { PostgresSchemaReader } from '../schema/readers/postgres.reader.js';
import type { DbQueryClient } from '../schema/readers/db-client.js';

export type PgPool = Pick<pg.Pool, 'connect' | 'query' | 'end' | 'totalCount' | 'idleCount' | 'waitingCount'>;
export type PgPoolFactory = (config: pg.PoolConfig) => PgPool;

const defaultPgFactory: PgPoolFactory = (cfg) => new pg.Pool(cfg);

export class PostgresDriver extends SqlAdapter implements SchemaReader {
  static readonly VERSION = 'PostgreSQL 16';

  private _pool: PgPool | null = null;

  constructor(
    config: DriverConfig,
    private readonly _poolFactory: PgPoolFactory = defaultPgFactory,
    private readonly _schemaReaderFactory?: (client: DbQueryClient, schema: string) => SchemaReader,
  ) {
    super(config, 'postgres');
  }

  async connect(): Promise<void> {
    this._pool = this._poolFactory({
      host:                    this._config.host,
      port:                    this._config.port,
      database:                this._config.database,
      user:                    this._config.username,
      password:                this._config.password,
      ssl:                     this._config.ssl,
      connectionTimeoutMillis: this._config.timeout,
    });
    const client = await this._pool.connect();
    (client as pg.PoolClient).release();
    this._isConnected = true;
  }

  async disconnect(): Promise<void> {
    await this._pool?.end();
    this._pool        = null;
    this._isConnected = false;
  }

  async execute<T = unknown>(query: Query): Promise<T[]> {
    if (!this._pool) throw new ConnectionFailedError('Not connected to PostgreSQL');
    try {
      const { sql, params } = this._renderer.render(query);
      const result = await this._pool.query(sql, params as pg.QueryConfigValues<unknown[]>);
      return (result as pg.QueryResult).rows as T[];
    } catch (err) {
      if (err instanceof ConnectionFailedError) throw err;
      throw new QueryError(
        err instanceof Error ? err.message : String(err),
        err instanceof Error ? err : undefined,
      );
    }
  }

  async health(): Promise<DatabaseHealth> {
    if (!this._pool) {
      return { connected: false, latency: 0, databaseVersion: '', activeConnections: 0, poolUsage: 0, status: 'unhealthy' };
    }
    try {
      const start  = Date.now();
      const result = await this._pool.query('SELECT version()') as pg.QueryResult<{ version: string }>;
      const latency = Date.now() - start;
      const total  = this._pool.totalCount;
      const idle   = this._pool.idleCount;
      return {
        connected:         true,
        latency,
        databaseVersion:   result.rows[0]?.version ?? '',
        activeConnections: total - idle,
        poolUsage:         total > 0 ? (total - idle) / total : 0,
        status:            'healthy',
      };
    } catch {
      return { connected: false, latency: 0, databaseVersion: '', activeConnections: 0, poolUsage: 0, status: 'unhealthy' };
    }
  }

  async schema(): Promise<DatabaseSchema> {
    if (!this._pool) throw new ConnectionFailedError('Not connected to PostgreSQL');
    const schemaName = (this._config as { schema?: string }).schema ?? 'public';
    const reader = this._schemaReaderFactory
      ? this._schemaReaderFactory(this._pool as unknown as DbQueryClient, schemaName)
      : new PostgresSchemaReader(this._pool as unknown as DbQueryClient, schemaName);
    return reader.readSchema();
  }

  async readSchema():            Promise<DatabaseSchema> { return this.schema(); }
  async listTables():            Promise<string[]>        { return (await this.schema()).tables.map((t) => t.name); }
  async readTable(name: string): Promise<Table | null> {
    return (await this.schema()).tables.find((t) => t.name === name) ?? null;
  }
}
