import mysql from 'mysql2/promise';
import { SqlAdapter } from '../adapters/sql-adapter.js';
import type { DriverConfig } from '../connection/connection-options.js';
import type { DatabaseHealth } from '../health/database-health.js';
import type { DatabaseSchema, SchemaReader } from '../schema/schema-reader.js';
import type { Table } from '../schema/table.js';
import type { Query } from '../query/query-types.js';
import { ConnectionFailedError, QueryError } from '../errors/database-errors.js';
import { MySQLSchemaReader } from '../schema/readers/mysql.reader.js';
import type { DbQueryClient } from '../schema/readers/db-client.js';

export type MySqlPool = Pick<mysql.Pool, 'query' | 'end' | 'pool'>;
export type MySqlPoolFactory = (config: mysql.PoolOptions) => MySqlPool;

const defaultMySqlFactory: MySqlPoolFactory = (cfg) => mysql.createPool(cfg);

export class MySqlDriver extends SqlAdapter implements SchemaReader {
  static readonly VERSION = 'MySQL 8.0';

  private _pool: MySqlPool | null = null;

  constructor(
    config: DriverConfig,
    private readonly _poolFactory: MySqlPoolFactory = defaultMySqlFactory,
    private readonly _schemaReaderFactory?: (client: DbQueryClient, database: string) => SchemaReader,
  ) {
    super(config, 'mysql');
  }

  async connect(): Promise<void> {
    this._pool = this._poolFactory({
      host:           this._config.host,
      port:           this._config.port,
      database:       this._config.database,
      user:           this._config.username,
      password:       this._config.password,
      ssl:            this._config.ssl ? {} : undefined,
      connectTimeout: this._config.timeout,
    });
    await this._pool.query('SELECT 1');
    this._isConnected = true;
  }

  async disconnect(): Promise<void> {
    await this._pool?.end();
    this._pool        = null;
    this._isConnected = false;
  }

  async execute<T = unknown>(query: Query): Promise<T[]> {
    if (!this._pool) throw new ConnectionFailedError('Not connected to MySQL');
    try {
      const { sql, params } = this._renderer.render(query);
      const [rows] = await this._pool.query(sql, params);
      return (Array.isArray(rows) ? rows : []) as T[];
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
      const [rows] = await this._pool.query('SELECT version() AS version') as [Array<{ version: string }>, unknown];
      const latency = Date.now() - start;
      const version = rows[0]?.version ?? '';
      const pool    = (this._pool as mysql.Pool).pool;
      const total   = (pool as { _allConnections?: unknown[] })._allConnections?.length ?? 0;
      const free    = (pool as { _freeConnections?: unknown[] })._freeConnections?.length ?? 0;
      return {
        connected:         true,
        latency,
        databaseVersion:   version,
        activeConnections: total - free,
        poolUsage:         total > 0 ? (total - free) / total : 0,
        status:            'healthy',
      };
    } catch {
      return { connected: false, latency: 0, databaseVersion: '', activeConnections: 0, poolUsage: 0, status: 'unhealthy' };
    }
  }

  async schema(): Promise<DatabaseSchema> {
    if (!this._pool) throw new ConnectionFailedError('Not connected to MySQL');
    const reader = this._schemaReaderFactory
      ? this._schemaReaderFactory(this._pool as unknown as DbQueryClient, this._config.database)
      : new MySQLSchemaReader(this._pool as unknown as DbQueryClient, this._config.database);
    return reader.readSchema();
  }

  async readSchema():            Promise<DatabaseSchema> { return this.schema(); }
  async listTables():            Promise<string[]>        { return (await this.schema()).tables.map((t) => t.name); }
  async readTable(name: string): Promise<Table | null> {
    return (await this.schema()).tables.find((t) => t.name === name) ?? null;
  }
}
