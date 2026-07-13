import mssql from 'mssql';
import { SqlAdapter } from '../adapters/sql-adapter.js';
import type { DriverConfig } from '../connection/connection-options.js';
import type { DatabaseHealth } from '../health/database-health.js';
import type { DatabaseSchema, SchemaReader } from '../schema/schema-reader.js';
import type { Table } from '../schema/table.js';
import type { Query } from '../query/query-types.js';
import { ConnectionFailedError, QueryError } from '../errors/database-errors.js';
import { SQLServerSchemaReader } from '../schema/readers/sqlserver.reader.js';
import type { DbQueryClient, DbRow } from '../schema/readers/db-client.js';

export interface MssqlPool {
  connect(): Promise<void>;
  close(): Promise<void>;
  request(): MssqlRequest;
  connected: boolean;
}
export interface MssqlRequest {
  input(name: string, value: unknown): MssqlRequest;
  query(sql: string): Promise<{ recordset: DbRow[] }>;
}
export type MssqlPoolFactory = (config: mssql.config) => MssqlPool;

function makeMssqlPool(cfg: mssql.config): MssqlPool {
  return new mssql.ConnectionPool(cfg) as unknown as MssqlPool;
}

function poolToDbClient(pool: MssqlPool, params: unknown[]): DbQueryClient {
  return {
    async query(sql, queryParams = []) {
      const req = pool.request();
      const allParams = [...params, ...queryParams];
      allParams.forEach((p, i) => req.input(`p${i + 1}`, p));
      const result = await req.query(sql);
      return { rows: result.recordset };
    },
  };
}

export class SqlServerDriver extends SqlAdapter implements SchemaReader {
  static readonly VERSION = 'Microsoft SQL Server 2022';

  private _pool: MssqlPool | null = null;

  constructor(
    config: DriverConfig,
    private readonly _poolFactory: MssqlPoolFactory = makeMssqlPool,
    private readonly _schemaReaderFactory?: (client: DbQueryClient, schema: string) => SchemaReader
  ) {
    super(config, 'sqlserver');
  }

  async connect(): Promise<void> {
    this._pool = this._poolFactory({
      server: this._config.host,
      port: this._config.port,
      database: this._config.database,
      user: this._config.username,
      password: this._config.password,
      options: { encrypt: this._config.ssl ?? false, trustServerCertificate: true },
      connectionTimeout: this._config.timeout,
    });
    await this._pool.connect();
    this._isConnected = true;
  }

  async disconnect(): Promise<void> {
    await this._pool?.close();
    this._pool = null;
    this._isConnected = false;
  }

  async execute<T = unknown>(query: Query): Promise<T[]> {
    if (!this._pool) throw new ConnectionFailedError('Not connected to SQL Server');
    try {
      const { sql, params } = this._renderer.render(query);
      const req = this._pool.request();
      params.forEach((p, i) => req.input(`p${i + 1}`, p));
      const result = await req.query(sql);
      return result.recordset as T[];
    } catch (err) {
      if (err instanceof ConnectionFailedError) throw err;
      throw new QueryError(
        err instanceof Error ? err.message : String(err),
        err instanceof Error ? err : undefined
      );
    }
  }

  async health(): Promise<DatabaseHealth> {
    if (!this._pool) {
      return {
        connected: false,
        latency: 0,
        databaseVersion: '',
        activeConnections: 0,
        poolUsage: 0,
        status: 'unhealthy',
      };
    }
    try {
      const start = Date.now();
      const result = await this._pool
        .request()
        .query('SELECT @@VERSION AS version, @@CONNECTIONS AS conns');
      const latency = Date.now() - start;
      const row = result.recordset[0] as { version: string; conns: number } | undefined;
      return {
        connected: true,
        latency,
        databaseVersion: row?.version ?? '',
        activeConnections: row?.conns ?? 0,
        poolUsage: 0,
        status: 'healthy',
      };
    } catch {
      return {
        connected: false,
        latency: 0,
        databaseVersion: '',
        activeConnections: 0,
        poolUsage: 0,
        status: 'unhealthy',
      };
    }
  }

  async schema(): Promise<DatabaseSchema> {
    if (!this._pool) throw new ConnectionFailedError('Not connected to SQL Server');
    const schemaName = (this._config as { schema?: string }).schema ?? 'dbo';
    const client = poolToDbClient(this._pool, []);
    const reader = this._schemaReaderFactory
      ? this._schemaReaderFactory(client, schemaName)
      : new SQLServerSchemaReader(client, schemaName);
    return reader.readSchema();
  }

  async readSchema(): Promise<DatabaseSchema> {
    return this.schema();
  }
  async listTables(): Promise<string[]> {
    return (await this.schema()).tables.map((t) => t.name);
  }
  async readTable(name: string): Promise<Table | null> {
    return (await this.schema()).tables.find((t) => t.name === name) ?? null;
  }
}
